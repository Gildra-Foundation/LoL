// Skinned mesh -> glTF for riftmodel.
// Based on LeagueToolkit v4.1.0-beta.53 (SimpleSkinGltfExtensions.cs, GltfUtils.cs),
// Copyright LeagueToolkit contributors, GPL-3.0 (https://github.com/LeagueToolkit/LeagueToolkit).
// This file is distributed under GPL-3.0 as well, see riftmodel/LICENSE.
//
// Changes against upstream, each fixing skins that upstream refuses to export:
//   • a range is sliced by its own StartVertex, with indices taken as global or range-relative
//     depending on the file (upstream assumes a running sum: "Value[0] is out of bounds N (memory)");
//   • JOINTS_0 is UNSIGNED_SHORT, so rigs with more than 256 joints work;
//   • TANGENT is dropped (unlit materials do not use it; broken tangents fail validation);
//   • ranges that share a material name share one glTF material;
//   • invalid inverse bind matrices are rebuilt from the bind pose;
//   • non-finite animation samples are replaced by the previous valid sample;
//   • non-finite positions, texture coordinates and blend weights are sanitised.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Numerics;
using LeagueToolkit.Core.Animation;
using LeagueToolkit.Core.Memory;
using LeagueToolkit.Core.Mesh;
using LeagueToolkit.Hashing;
using SharpGLTF.Memory;
using SharpGLTF.Schema2;
using GltfImage = SharpGLTF.Schema2.Image;

static class SkinGltf
{
    static readonly Dictionary<ElementName, MemoryAccessInfo> VertexElements = new()
    {
        { ElementName.Position, new("POSITION", 0, 0, 0, DimensionType.VEC3, EncodingType.FLOAT) },
        { ElementName.BlendWeight, new("WEIGHTS_0", 0, 0, 0, DimensionType.VEC4, EncodingType.FLOAT) },
        { ElementName.Normal, new("NORMAL", 0, 0, 0, DimensionType.VEC3, EncodingType.FLOAT) },
        { ElementName.BlendIndex, new("JOINTS_0", 0, 0, 0, DimensionType.VEC4, EncodingType.UNSIGNED_SHORT) },
        { ElementName.Texcoord0, new("TEXCOORD_0", 0, 0, 0, DimensionType.VEC2, EncodingType.FLOAT) },
    };

    // node → joint name in the rig (node names get a suffix when the rig repeats a name)
    static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Node, string> JointNames = new();

    public static ModelRoot ToGltf(
        SkinnedMesh mesh,
        RigResource rig,
        IEnumerable<(string Material, Stream Texture)> textures,
        IEnumerable<(string Name, IAnimationAsset Animation)> animations)
    {
        ModelRoot root = ModelRoot.CreateModel();
        Scene scene = root.UseScene("SkinnedMesh");
        Node meshNode = scene.CreateNode("skinned_mesh");

        Dictionary<string, Material> materials = CreateMaterials(root, mesh, textures);
        var (jointNodes, influenceLookup) = CreateSkeleton(rig, meshNode);
        Mesh gltfMesh = CreateMesh(root, mesh, influenceLookup, materials);
        meshNode.WithSkinnedMesh(gltfMesh, jointNodes.ToArray());

        Node[] joints = jointNodes.Select(x => x.Node).ToArray();
        foreach (var (name, animation) in animations)
            CreateAnimation(name, animation, joints);

        root.DefaultScene = scene;
        return root;
    }

    static Mesh CreateMesh(ModelRoot root, SkinnedMesh mesh, ushort[] influenceLookup, IReadOnlyDictionary<string, Material> materials)
    {
        Mesh gltfMesh = root.CreateMesh();
        MemoryAccessor[] vertices = CreateVertexAccessors(mesh.VerticesView).ToArray();
        MemoryAccessor.SanitizeVertexAttributes(vertices);
        RemapJoints(vertices, influenceLookup);

        // vertices with garbage coordinates (Coven Janna: ~1e38) are dropped with their triangles
        var positions = mesh.VerticesView.GetAccessor(ElementName.Position).AsVector3Array();
        foreach (SkinnedMeshRange range in mesh.Ranges)
        {
            IndexArray all = mesh.Indices.Slice(range.StartIndex, range.IndexCount);
            if (all.Count == 0) continue;
            int min = int.MaxValue, max = -1;
            for (int i = 0; i < all.Count; i++)
            {
                int v = (int)all[i];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            // Indices are usually global (inside the range's vertex window); some skins store them
            // relative to the range instead. Anything else: slice what the indices actually touch.
            int start = range.StartVertex, count = range.VertexCount, offset = 0;
            if (min >= start && max < start + count) offset = -start;
            else if (max < count) offset = 0;
            else { start = min; count = max - min + 1; offset = -min; }
            // stored index → local index in the slice: idx + offset; → global vertex id: idx + offset + start
            var indices = new List<int>(all.Count);
            for (int i = 0; i + 2 < all.Count; i += 3)
            {
                int x = (int)all[i] + offset, y = (int)all[i + 1] + offset, z = (int)all[i + 2] + offset;
                if (ValidPosition(positions[x + start]) && ValidPosition(positions[y + start]) && ValidPosition(positions[z + start]))
                    indices.AddRange(new[] { x, y, z });
            }
            if (indices.Count == 0) continue;

            MemoryAccessor index = new(
                new(new byte[indices.Count * 4]),
                new("INDEX", 0, indices.Count, 0, DimensionType.SCALAR, EncodingType.UNSIGNED_INT));
            IntegerArray indexArray = index.AsIntegerArray();
            for (int i = 0; i < indices.Count; i++)
                indexArray[i] = (uint)indices[i];

            MemoryAccessor[] slice = vertices.Select(x => new MemoryAccessor(x.Data, x.Attribute.Slice(start, count))).ToArray();
            MemoryAccessor.VerifyVertexIndices(index, (uint)count);

            gltfMesh.CreatePrimitive()
                .WithMaterial(materials[range.Material])
                .WithIndicesAccessor(PrimitiveType.TRIANGLES, index)
                .WithVertexAccessors(slice);
        }
        return gltfMesh;
    }

    static IEnumerable<MemoryAccessor> CreateVertexAccessors(IVertexBufferView buffer)
    {
        foreach (VertexElement element in buffer.Description.Elements)
        {
            if (!VertexElements.TryGetValue(element.Name, out MemoryAccessInfo info)) continue;
            info = info with { ItemsCount = buffer.VertexCount };
            MemoryAccessor accessor = new(new(new byte[info.StepByteLength * buffer.VertexCount]), info);
            VertexElementAccessor source = buffer.GetAccessor(element.Name);
            switch (element.Name)
            {
                case ElementName.Position:
                    accessor.AsVector3Array().Fill(source.AsVector3Array().ToArray().Select(v => ValidPosition(v) ? v : Vector3.Zero));
                    break;
                case ElementName.BlendWeight:
                    accessor.AsVector4Array().Fill(source.AsVector4Array().ToArray().Select(SanitizeWeights));
                    break;
                case ElementName.Normal:
                    WriteNormals(accessor, source);
                    break;
                case ElementName.BlendIndex:
                    accessor.AsVector4Array().Fill(source.AsXyzwU8Array().Select(x => new Vector4(x.x, x.y, x.z, x.w)));
                    break;
                case ElementName.Texcoord0:
                    accessor.AsVector2Array().Fill((element.Format == ElementFormat.XY_Packed1616 ? HalfVector2(source) : source.AsVector2Array().ToArray())
                        .Select(v => float.IsFinite(v.X) && float.IsFinite(v.Y) ? v : Vector2.Zero));
                    break;
            }
            yield return accessor;
        }
    }

    // NaN or negative weights (seen in Coven Janna) fail glTF validation: clamp and renormalise
    static Vector4 SanitizeWeights(Vector4 w)
    {
        double F(float x) => float.IsFinite(x) && x > 1e-6f ? x : 0d;
        double x = F(w.X), y = F(w.Y), z = F(w.Z), q = F(w.W), sum = x + y + z + q;
        if (sum < 1e-6) return new Vector4(1, 0, 0, 0);
        // the largest weight absorbs the rounding, so the float sum is exactly 1 for the validator
        float[] v = { (float)(x / sum), (float)(y / sum), (float)(z / sum), (float)(q / sum) };
        int big = Array.IndexOf(v, v.Max());
        v[big] = 0f;
        v[big] = 1f - (v[0] + v[1] + v[2] + v[3]);
        return new Vector4(v[0], v[1], v[2], v[3]);
    }

    static void WriteNormals(MemoryAccessor accessor, VertexElementAccessor source)
    {
        Vector3[] normals = source.Element.Format == ElementFormat.XYZ_Packed161616 ? HalfVector3(source) : source.AsVector3Array().ToArray();
        Vector3Array target = accessor.AsVector3Array();
        for (int i = 0; i < normals.Length; i++)
        {
            Vector3 n = normals[i];
            float length = n.Length();
            target[i] = float.IsFinite(length) && length > 0.0001f ? Vector3.Normalize(n) : Vector3.UnitY;
        }
    }

    static Vector2[] HalfVector2(VertexElementAccessor source)
    {
        var result = new Vector2[source.VertexCount];
        for (int i = 0; i < result.Length; i++)
        {
            var d = source.DecodeAt(i);
            result[i] = new((float)BitConverter.ToHalf(d[0..2]), (float)BitConverter.ToHalf(d[2..4]));
        }
        return result;
    }

    static Vector3[] HalfVector3(VertexElementAccessor source)
    {
        var result = new Vector3[source.VertexCount];
        for (int i = 0; i < result.Length; i++)
        {
            var d = source.DecodeAt(i);
            result[i] = new((float)BitConverter.ToHalf(d[0..2]), (float)BitConverter.ToHalf(d[2..4]), (float)BitConverter.ToHalf(d[4..6]));
        }
        return result;
    }

    static void RemapJoints(MemoryAccessor[] vertices, ushort[] influenceLookup)
    {
        MemoryAccessor joints = vertices.First(x => x.Attribute.Name == "JOINTS_0");
        MemoryAccessor weights = vertices.First(x => x.Attribute.Name == "WEIGHTS_0");
        Vector4Array j = joints.AsVector4Array();
        Vector4Array w = weights.AsVector4Array();
        ushort Map(float joint, float weight) =>
            weight > 0f && joint < influenceLookup.Length ? influenceLookup[(int)joint] : (ushort)0;
        for (int i = 0; i < j.Count; i++)
        {
            Vector4 a = j[i], b = w[i];
            j[i] = new(Map(a.X, b.X), Map(a.Y, b.Y), Map(a.Z, b.Z), Map(a.W, b.W));
        }
    }

    static Dictionary<string, Material> CreateMaterials(ModelRoot root, SkinnedMesh mesh, IEnumerable<(string Material, Stream Texture)> textures)
    {
        var textureLookup = new Dictionary<string, Stream>();
        foreach (var (material, texture) in textures) textureLookup.TryAdd(material, texture);
        var materials = new Dictionary<string, Material>();
        foreach (SkinnedMeshRange range in mesh.Ranges)
        {
            if (materials.ContainsKey(range.Material)) continue;
            Material material = root.CreateMaterial(range.Material).WithUnlit().WithDoubleSide(true);
            if (textureLookup.TryGetValue(range.Material, out Stream stream))
            {
                byte[] png = new byte[stream.Length];
                stream.ReadExactly(png);
                material.WithChannelTexture("BaseColor", 0, root.UseImage(new(png)));
            }
            materials[range.Material] = material;
        }
        return materials;
    }

    static (List<(Node Node, Matrix4x4 InverseBind)>, ushort[]) CreateSkeleton(RigResource rig, Node skeletonRoot)
    {
        var nodes = new List<(Node Node, Matrix4x4 InverseBind)>();
        var byId = new Dictionary<short, Node>();
        var global = new Dictionary<short, Matrix4x4>();
        var names = new HashSet<string>();

        Node Create(Joint joint)
        {
            if (byId.TryGetValue(joint.Id, out Node existing)) return existing;
            Node parent = skeletonRoot;
            Matrix4x4 parentGlobal = Matrix4x4.Identity;
            if (joint.ParentId != -1 && rig.Joints.FirstOrDefault(x => x.Id == joint.ParentId) is Joint parentJoint)
            {
                parent = Create(parentJoint);
                parentGlobal = global[parentJoint.Id];
            }
            // glTF needs unique node names for animation lookup; duplicates keep a suffix
            string name = joint.Name;
            for (int n = 1; !names.Add(name); n++) name = $"{joint.Name}.{n}";
            Node node = parent.CreateNode(name)
                .WithLocalTranslation(joint.LocalTranslation)
                .WithLocalScale(joint.LocalScale)
                .WithLocalRotation(joint.LocalRotation);
            Matrix4x4 local = Matrix4x4.CreateScale(joint.LocalScale) * Matrix4x4.CreateFromQuaternion(joint.LocalRotation) * Matrix4x4.CreateTranslation(joint.LocalTranslation);
            global[joint.Id] = local * parentGlobal;
            Matrix4x4 inverseBind = joint.InverseBindTransform;
            if (!IsValidInverseBind(inverseBind))
                inverseBind = Matrix4x4.Invert(global[joint.Id], out Matrix4x4 rebuilt) && IsValidInverseBind(rebuilt) ? rebuilt : Matrix4x4.Identity;
            JointNames.AddOrUpdate(node, joint.Name);
            byId[joint.Id] = node;
            nodes.Add((node, inverseBind));
            return node;
        }

        foreach (Joint joint in rig.Joints) Create(joint);

        ushort[] influenceLookup = new ushort[rig.Influences.Count];
        for (int i = 0; i < rig.Influences.Count; i++)
        {
            short jointId = rig.Influences[i];
            if (byId.TryGetValue(jointId, out Node node))
                influenceLookup[i] = (ushort)nodes.FindIndex(x => x.Node == node);
        }
        return (nodes, influenceLookup);
    }

    static bool IsValidInverseBind(Matrix4x4 m)
    {
        // SharpGLTF expects an affine, invertible matrix
        // finite is not enough: Coven Janna ships matrices with 1e38 entries
        for (int r = 0; r < 4; r++)
            for (int c = 0; c < 4; c++)
                if (!float.IsFinite(m[r, c]) || Math.Abs(m[r, c]) > 1e6f) return false;
        if (Math.Abs(m.M14) > 1e-5f || Math.Abs(m.M24) > 1e-5f || Math.Abs(m.M34) > 1e-5f || Math.Abs(m.M44 - 1f) > 1e-5f) return false;
        return Matrix4x4.Invert(m, out _);
    }

    static void CreateAnimation(string name, IAnimationAsset animation, IReadOnlyList<Node> joints)
    {
        int frameCount = Math.Max(1, (int)(animation.Fps * animation.Duration));
        float frameDuration = 1 / animation.Fps;
        var pose = new Dictionary<uint, (Quaternion Rotation, Vector3 Translation, Vector3 Scale)>();
        var tracks = new Dictionary<uint, (Quaternion R, Vector3 T, Vector3 S, bool Ok)[]>();

        for (int frame = 0; frame < frameCount; frame++)
        {
            animation.Evaluate(frame * frameDuration, pose);
            foreach (var (hash, t) in pose)
            {
                if (!tracks.TryGetValue(hash, out var track)) tracks[hash] = track = new (Quaternion, Vector3, Vector3, bool)[frameCount];
                // a NaN in one key invalidates the whole clip in glTF: such samples are filled from neighbours below
                bool ok = Finite(t.Rotation) && Finite(t.Translation) && Finite(t.Scale);
                track[frame] = ok ? (Quaternion.Normalize(t.Rotation), t.Translation, t.Scale, true) : default;
            }
        }

        foreach (Node joint in joints)
        {
            uint hash = Elf.HashLower(JointNames.TryGetValue(joint, out string original) ? original : joint.Name);
            if (!tracks.TryGetValue(hash, out var track)) continue;
            int first = Array.FindIndex(track, f => f.Ok);
            if (first < 0) continue;
            var r = new (float, Quaternion)[frameCount];
            var p = new (float, Vector3)[frameCount];
            var s = new (float, Vector3)[frameCount];
            var last = track[first];
            for (int i = 0; i < frameCount; i++)
            {
                if (track[i].Ok) last = track[i];
                float time = i * frameDuration;
                r[i] = (time, last.R);
                p[i] = (time, last.T);
                s[i] = (time, last.S);
            }
            joint.WithRotationAnimation(name, r);
            joint.WithTranslationAnimation(name, p);
            joint.WithScaleAnimation(name, s);
        }
    }

    static bool Finite(Quaternion q) => float.IsFinite(q.X) && float.IsFinite(q.Y) && float.IsFinite(q.Z) && float.IsFinite(q.W) && q.LengthSquared() > 1e-8f;
    static bool ValidPosition(Vector3 v) => Finite(v) && Math.Abs(v.X) < 1e5f && Math.Abs(v.Y) < 1e5f && Math.Abs(v.Z) < 1e5f;
    static bool Finite(Vector3 v) => float.IsFinite(v.X) && float.IsFinite(v.Y) && float.IsFinite(v.Z);
}
