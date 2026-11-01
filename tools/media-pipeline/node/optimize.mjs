// Batch web optimisation for riftmodel output. One JSON job per input line:
//   {"in": "a.glb", "out": "b.glb", "hide": ["Submesh"], "extras": {...}}  -> optimised glb
//   {"png": "a.png", "webp": "b.webp"}                                        -> WebP texture
// Prints one JSON result per job. Model: hidden submeshes and vertex colours
// removed, KHR_materials_unlit, resampled clips, WebP textures (max --tex px), meshopt.
// usage: node optimize.mjs jobs.jsonl [--tex 1024] [--quality 82]
import fs from 'node:fs';
import readline from 'node:readline';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [jobsFile, ...rest] = process.argv.slice(2);
const opt = { tex: '1024', quality: '82' };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const size = Number(opt.tex);
const quality = Number(opt.quality);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const silent = { debug() {}, info() {}, warn() {}, error: console.error };

async function model(job) {
  const doc = await io.read(job.in);
  doc.setLogger(silent);
  const root = doc.getRoot();
  const hidden = new Set((job.hide ?? []).map((s) => s.toLowerCase()));
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (hidden.has((prim.getMaterial()?.getName() ?? '').toLowerCase())) {
        mesh.removePrimitive(prim);
        prim.dispose();
      }
    }
    if (mesh.listPrimitives().length === 0) throw new Error('every submesh is hidden');
    // League vertex colours are shader masks, not albedo: viewers would darken/hide the mesh
    for (const prim of mesh.listPrimitives()) {
      for (const sem of ['COLOR_0', 'TANGENT']) {
        const acc = prim.getAttribute(sem);
        if (acc) prim.setAttribute(sem, null);
      }
    }
  }
  // League shading is painted into the textures: unlit, alpha-tested like in game
  const unlit = doc.createExtension(KHRMaterialsUnlit).createUnlit();
  for (const mat of root.listMaterials()) {
    mat.setMetallicFactor(0).setRoughnessFactor(1).setAlphaMode('MASK').setAlphaCutoff(0.3);
    mat.setExtension('KHR_materials_unlit', unlit);
  }
  if (job.extras) root.setExtras({ ...root.getExtras(), riftden: job.extras });
  await doc.transform(
    resample(),
    prune({ keepLeaves: false, keepAttributes: true }),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(job.out, doc);
  return {
    bytes: fs.statSync(job.out).size,
    animations: root.listAnimations().map((a) => a.getName()),
    materials: root.listMaterials().map((m) => m.getName()),
  };
}

async function texture(job) {
  await sharp(job.png)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(job.webp);
  return { bytes: fs.statSync(job.webp).size };
}

const rl = readline.createInterface({ input: fs.createReadStream(jobsFile), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const job = JSON.parse(line);
  try {
    const res = job.png ? await texture(job) : await model(job);
    console.log(JSON.stringify({ id: job.id, ok: true, ...res }));
  } catch (e) {
    console.log(JSON.stringify({ id: job.id, ok: false, error: String(e?.message ?? e) }));
  }
}
