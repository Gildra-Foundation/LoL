// riftmodel: League skinned mesh (.skn + .skl + .anm + .tex) -> glTF binary.
// Batch mode reads one JSON job per line and prints one JSON result per line,
// so a whole champion is converted in a single process.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using CommunityToolkit.HighPerformance;
using LeagueToolkit.Core.Animation;
using LeagueToolkit.Core.Mesh;
using LeagueToolkit.IO.SimpleSkinFile;
using LeagueToolkit.Toolkit;
using SixLabors.ImageSharp;
using LeagueTexture = LeagueToolkit.Core.Renderer.Texture;

public class AnimJob { public string name { get; set; } public string path { get; set; } }
public class TexJob { public string material { get; set; } public string tex { get; set; } }
public class PngJob { public string tex { get; set; } public string png { get; set; } }

public class Job
{
    public string id { get; set; }
    public string skn { get; set; }
    public string skl { get; set; }
    public string @out { get; set; }
    public string defaultTex { get; set; }
    public List<TexJob> textures { get; set; } = new();
    public List<AnimJob> anims { get; set; } = new();
    public List<PngJob> pngs { get; set; } = new();
}

public class Result
{
    public string id { get; set; }
    public bool ok { get; set; }
    public string error { get; set; }
    public List<string> materials { get; set; } = new();
    public List<string> anims { get; set; } = new();
    public Dictionary<string, string> animErrors { get; set; } = new();
    public Dictionary<string, string> texErrors { get; set; } = new();
}

static class Program
{
    static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "batch")
        {
            foreach (string line in File.ReadLines(args[1]))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                Job job = JsonSerializer.Deserialize<Job>(line);
                Console.WriteLine(JsonSerializer.Serialize(Run(job), Json));
                Console.Out.Flush();
            }
            return 0;
        }
        if (args.Length == 3 && args[0] == "tex2png")
        {
            TexToPng(args[1], args[2]);
            return 0;
        }
        Console.Error.WriteLine("usage: riftmodel batch <jobs.jsonl> | tex2png <in.tex> <out.png>");
        return 2;
    }

    static void TexToPng(string texPath, string pngPath)
    {
        using FileStream s = File.OpenRead(texPath);
        LeagueTexture texture = LeagueTexture.Load(s);
        using var image = texture.Mips[0].ToImage();
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(pngPath)));
        image.SaveAsPng(pngPath);
    }

    static MemoryStream TexStream(string texPath)
    {
        using FileStream s = File.OpenRead(texPath);
        LeagueTexture texture = LeagueTexture.Load(s);
        using var image = texture.Mips[0].ToImage();
        MemoryStream ms = new();
        image.SaveAsPng(ms);
        ms.Seek(0, SeekOrigin.Begin);
        return ms;
    }

    static Result Run(Job job)
    {
        Result res = new() { id = job.id };
        try
        {
            foreach (PngJob p in job.pngs)
            {
                try { TexToPng(p.tex, p.png); }
                catch (Exception e) { res.texErrors[p.tex] = e.Message; }
            }
            if (string.IsNullOrEmpty(job.skn))
            {
                res.ok = true;
                return res;
            }

            SkinnedMesh mesh = SkinnedMesh.ReadFromSimpleSkin(job.skn);
            using FileStream sklStream = File.OpenRead(job.skl);
            RigResource rig = new(sklStream);

            var overrides = job.textures.Where(t => t.tex != null)
                .GroupBy(t => t.material, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().tex, StringComparer.OrdinalIgnoreCase);
            var cache = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
            var textures = new List<(string, Stream)>();
            foreach (SkinnedMeshRange range in mesh.Ranges)
            {
                res.materials.Add(range.Material);
                string tex = overrides.TryGetValue(range.Material, out string o) ? o : job.defaultTex;
                if (string.IsNullOrEmpty(tex) || !File.Exists(tex)) continue;
                try
                {
                    if (!cache.TryGetValue(tex, out byte[] png))
                        cache[tex] = png = TexStream(tex).ToArray();
                    textures.Add((range.Material, new MemoryStream(png)));
                }
                catch (Exception e) { res.texErrors[tex] = e.Message; }
            }

            var anims = new List<(string, IAnimationAsset)>();
            foreach (AnimJob a in job.anims)
            {
                try
                {
                    using FileStream s = File.OpenRead(a.path);
                    anims.Add((a.name, AnimationAsset.Load(s)));
                    res.anims.Add(a.name);
                }
                catch (Exception e) { res.animErrors[a.name] = e.GetType().Name + ": " + e.Message; }
            }

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(job.@out)));
            try
            {
                SkinGltf.ToGltf(mesh, rig, textures, anims).SaveGLB(job.@out);
            }
            catch (Exception e) when (anims.Count > 0)
            {
                // a single broken clip must not cost the whole model: retry clip by clip
                res.animErrors["*"] = e.GetType().Name + ": " + e.Message;
                var good = new List<(string, IAnimationAsset)>();
                foreach (var a in anims)
                {
                    try
                    {
                        SkinGltf.ToGltf(mesh, rig, new List<(string, Stream)>(), good.Append(a));
                        good.Add(a);
                    }
                    catch (Exception e2) { res.animErrors[a.Item1] = e2.GetType().Name + ": " + e2.Message; }
                }
                foreach (var t in textures) t.Item2.Seek(0, SeekOrigin.Begin);
                res.anims = good.Select(g => g.Item1).ToList();
                SkinGltf.ToGltf(mesh, rig, textures, good).SaveGLB(job.@out);
            }
            res.ok = true;
        }
        catch (Exception e)
        {
            res.ok = false;
            // first stack frame tells which part of the model broke (mesh, rig, animation)
            string at = e.StackTrace?.Split('\n').FirstOrDefault()?.Trim();
            res.error = e.GetType().Name + ": " + e.Message + (at is null ? "" : " | " + at);
        }
        return res;
    }
}
