// Batch web optimisation for riftmodel output. One JSON job per input line:
//   {"in": "a.glb", "out": "b.glb", "animsOut": "b.anims.glb", "extras": {...}}  -> optimised glb pair
//   {"png": "a.png", "webp": "b.webp"}                                             -> WebP texture
// Prints one JSON result per job. Model: vertex colours removed, KHR_materials_unlit, resampled
// clips without constant channels, int16 rotations, WebP textures (max --tex px), meshopt.
// The model is split for fast first paint: `out` = mesh + skin + textures + the idle clip,
// `animsOut` = the other clips on bare skeleton nodes (the viewer loads them in the background).
// Submeshes hidden at spawn stay in the file: the viewer shows them on animation events.
// usage: node optimize.mjs jobs.jsonl [--tex 1024] [--quality 82]
import fs from 'node:fs';
import readline from 'node:readline';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { cloneDocument, dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
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

// channels that never leave the rest pose cost JSON and decode time for nothing
function dropConstantChannels(doc, eps = 1e-4) {
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const sampler = ch.getSampler();
      if (!node || !sampler) continue;
      const path = ch.getTargetPath();
      const rest = path === 'rotation' ? node.getRotation() : path === 'translation' ? node.getTranslation() : node.getScale();
      const out = sampler.getOutput();
      const el = [];
      let constant = true;
      for (let i = 0; i < out.getCount() && constant; i++) {
        out.getElement(i, el);
        constant = el.every((v, k) => Math.abs(v - rest[k]) < eps);
      }
      if (constant) {
        ch.dispose();
        sampler.dispose();
      }
    }
  }
}

// rotations as normalized int16 (KHR_mesh_quantization): half the size, invisible on screen
function quantizeRotations(doc) {
  const done = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== 'rotation') continue;
      const out = ch.getSampler().getOutput();
      const a = out.getArray();
      if (done.has(out) || !(a instanceof Float32Array)) continue;
      const q = new Int16Array(a.length);
      for (let i = 0; i < a.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, a[i])) * 32767);
      out.setArray(q).setNormalized(true);
      done.add(out);
    }
  }
}

const dropAnimation = (anim) => {
  for (const ch of anim.listChannels()) ch.dispose();
  for (const s of anim.listSamplers()) s.dispose();
  anim.dispose();
};

async function model(job) {
  const doc = await io.read(job.in);
  doc.setLogger(silent);
  const root = doc.getRoot();
  const hidden = new Set((job.extras?.hidden ?? []).map((s) => s.toLowerCase()));
  for (const mesh of root.listMeshes()) {
    if (mesh.listPrimitives().every((prim) => hidden.has((prim.getMaterial()?.getName() ?? '').toLowerCase())))
      throw new Error('every submesh is hidden');
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
  );
  dropConstantChannels(doc);
  quantizeRotations(doc);

  const names = root.listAnimations().map((a) => a.getName());
  const start = names.includes('idle') ? 'idle' : names[0];

  // first file: everything needed to show the model, plus the idle clip
  const base = cloneDocument(doc);
  base.setLogger(silent);
  for (const a of base.getRoot().listAnimations()) if (a.getName() !== start) dropAnimation(a);
  await base.transform(prune({ keepLeaves: false, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(job.out, base);

  // second file: the remaining clips on the skeleton nodes only (names match the first file)
  let animsBytes = 0;
  const rest = names.filter((n) => n !== start);
  if (job.animsOut && rest.length) {
    const anims = cloneDocument(doc);
    anims.setLogger(silent);
    const r = anims.getRoot();
    for (const a of r.listAnimations()) if (a.getName() === start) dropAnimation(a);
    for (const node of r.listNodes()) node.setMesh(null).setSkin(null);
    for (const m of r.listMeshes()) m.dispose();
    for (const s of r.listSkins()) s.dispose();
    for (const m of r.listMaterials()) m.dispose();
    for (const t of r.listTextures()) t.dispose();
    r.setExtras({});
    await anims.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    await io.write(job.animsOut, anims);
    animsBytes = fs.statSync(job.animsOut).size;
  }
  return {
    bytes: fs.statSync(job.out).size,
    animsBytes,
    animations: [start, ...rest].filter(Boolean),
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
