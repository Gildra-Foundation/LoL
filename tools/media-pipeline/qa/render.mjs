// Render glb models to PNG with three.js in headless Chromium.
// usage: node render.mjs <out-dir> <model.glb>[@animation] ...
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [outDir, ...models] = process.argv.slice(2);
const threeDir = path.resolve('node_modules/three');
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html><html><body style="margin:0;background:#1b2330">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
window.render = async (url, clip, t) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(640, 640);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.innerHTML = '';
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2330);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const dir = new THREE.DirectionalLight(0xffffff, 1.5); dir.position.set(1, 2, 3); scene.add(dir);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  scene.add(gltf.scene);
  const names = gltf.animations.map((a) => a.name);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const anim = gltf.animations.find((a) => a.name === clip) || gltf.animations[0];
  if (anim) { mixer.clipAction(anim).play(); mixer.update(Math.min(t, anim.duration * 0.5)); }
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  if (box.isEmpty()) box.setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  const cam = new THREE.PerspectiveCamera(35, 1, r / 100, r * 100);
  cam.position.set(center.x, center.y + r * 0.1, center.z + r * 1.9);
  cam.lookAt(center);
  renderer.render(scene, cam);
  return { names, size: size.toArray().map((v) => Math.round(v)) };
};
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/') return route.fulfill({ body: html, contentType: 'text/html' });
  if (url.pathname.startsWith('/three/')) return route.fulfill({ path: path.join(threeDir, url.pathname.slice(7)) });
  if (url.pathname.startsWith('/model/')) return route.fulfill({ path: decodeURIComponent(url.pathname.slice(6)) });
  return route.fulfill({ status: 404 });
});
await page.goto('http://qa.local/');
await page.waitForFunction(() => window.ready);
for (const spec of models) {
  const [file, clip = 'idle'] = spec.split('@');
  try {
    const info = await page.evaluate(([u, c]) => window.render(u, c, 0.4), ['/model' + path.resolve(file), clip]);
    const shot = path.join(outDir, `${path.basename(file, '.glb')}-${clip}.png`);
    await page.locator('canvas').screenshot({ path: shot });
    console.log(JSON.stringify({ file, clip, ...info, shot }));
  } catch (e) {
    console.log(JSON.stringify({ file, clip, error: String(e.message || e) }));
  }
}
await browser.close();
