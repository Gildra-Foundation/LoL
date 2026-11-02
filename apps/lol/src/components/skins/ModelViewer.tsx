'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import styles from './SkinMedia.module.css';

export interface ModelViewerProps {
  url: string;
  /** порядок кнопок анимаций; имена клипов из glb */
  animations: string[];
  animationLabel: (name: string) => string;
  /** база путей медиа (/media/<патч>/) */
  base: string;
  /** id хромы: её текстуры берутся из gltf.userData.riftden.chromas; null — исходные */
  chroma: string | null;
  labels: { loading: string; error: string; animations: string; rotate: string };
}

/** 3D-модель образа: вращение мышью или пальцем, колесо — приближение, кнопки — анимации из игры. */
export default function ModelViewer({ url, animations, animationLabel, base, chroma, labels }: ModelViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<{ mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; original: Map<THREE.Material, THREE.Texture | null>; chromas: Record<string, Record<string, string>> } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [clips, setClips] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    world.add(new THREE.HemisphereLight(0xffffff, 0x2a3530, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(2, 4, 3);
    world.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        // Модель в сцене одна, отсекать её по рамке незачем: three.js считает рамку один раз, и у образов,
        // где первый кадр анимации сжат в точку, модель иначе пропадала навсегда.
        root.traverse((o) => (o.frustumCulled = false));
        world.add(root);
        const mixer = new THREE.AnimationMixer(root);
        const names = gltf.animations.map((c) => c.name);
        const ordered = [...animations.filter((a) => names.includes(a)), ...names.filter((n) => !animations.includes(n))];
        // Размер модели в позе каждой анимации: у образов с превращениями ожидание бывает
        // в «пустой» форме, тогда начинаем с первой анимации, где модель видна целиком.
        const posed = (clip?: THREE.AnimationClip, at = 0.5) => {
          mixer.stopAllAction();
          if (clip) {
            mixer.clipAction(clip).play();
            mixer.setTime(clip.duration * at);
          }
          root.updateMatrixWorld(true);
          const b = new THREE.Box3();
          root.traverse((o) => {
            const mesh = o as THREE.SkinnedMesh;
            if (!mesh.isSkinnedMesh) return;
            mesh.computeBoundingBox();
            b.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
          });
          const s = b.getSize(new THREE.Vector3());
          return { box: b, extent: [s.x, s.y, s.z].every(Number.isFinite) ? Math.max(s.x, s.y, s.z) : 0 };
        };
        // поза привязки — до любых анимаций: по ней кадр (анимации уводят спрятанные части далеко в сторону)
        const rest = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
        root.traverse((o) => rest.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
        const bind = posed();
        // анимация годится для старта, если модель видна во всех её моментах, а не только в середине
        const boxes = new Map(
          ordered.map((n) => {
            const clip = gltf.animations.find((c) => c.name === n);
            const samples = [0.05, 0.3, 0.55, 0.8].map((at) => posed(clip, at));
            return [n, samples.reduce((a, b) => (b.extent < a.extent ? b : a))];
          }),
        );
        const visible = (n: string) => boxes.get(n)!.extent >= bind.extent * 0.35;
        // у образов с превращениями бывает, что ни одна анимация не держит модель на виду — тогда поза привязки
        const start = ordered.find((n) => /idle/i.test(n) && visible(n)) ?? ordered.find(visible) ?? null;
        // Кадр по меньшей из рамок — позы привязки и стартовой анимации: в одной лишние формы сложены
        // на месте, в другой анимация уносит спрятанные части в сторону.
        const startBox = start ? boxes.get(start)! : bind;
        const frameBox = startBox.extent > 0 && (startBox.extent < bind.extent || bind.extent === 0) ? startBox.box : bind.box;
        mixer.stopAllAction();
        // исходная поза узлов, а не skeleton.pose(): у некоторых образов матрицы привязки с ней не совпадают
        for (const [o, [p, q, s]] of rest) {
          o.position.copy(p);
          o.quaternion.copy(q);
          o.scale.copy(s);
        }

        // кадр по размеру модели
        const size = frameBox.getSize(new THREE.Vector3());
        const center = frameBox.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) / 2 || 100;
        const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
        camera.position.set(center.x, center.y + radius * 0.15, center.z + distance);
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.minDistance = distance * 0.35;
        controls.maxDistance = distance * 2.5;
        const original = new Map<THREE.Material, THREE.Texture | null>();
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) original.set(m, m.map ?? null);
        });
        const chromas = (gltf.userData?.riftden?.chromas ?? {}) as Record<string, Record<string, string>>;
        scene.current = { mixer, clips: gltf.animations, original, chromas };
        setClips(ordered);
        setCurrent(start);
        setState('ready');
      },
      undefined,
      () => !disposed && setState('error'),
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      scene.current?.mixer.update(clock.getDelta());
      controls.update();
      renderer.render(world, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      world.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
          m.map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      scene.current = null;
    };
  }, [url, animations]);

  // анимация
  useEffect(() => {
    const s = scene.current;
    if (!s || !current) return;
    const clip = s.clips.find((c) => c.name === current);
    if (!clip) return;
    s.mixer.stopAllAction();
    s.mixer.clipAction(clip).reset().fadeIn(0.2).play();
  }, [current, state]);

  // хрома: свои текстуры у перечисленных материалов (имя материала → файл)
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    const files = chroma ? s.chromas[chroma] : undefined;
    const loaded: THREE.Texture[] = [];
    let cancelled = false;
    for (const m of s.original.keys()) {
      const file = files?.[m.name];
      const material = m as THREE.MeshStandardMaterial;
      if (!file) {
        material.map = s.original.get(m) ?? null;
        material.needsUpdate = true;
        continue;
      }
      new THREE.TextureLoader().load(base + file, (tex) => {
        if (cancelled) return tex.dispose();
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        loaded.push(tex);
        material.map = tex;
        material.needsUpdate = true;
      });
    }
    return () => {
      cancelled = true;
      for (const m of s.original.keys()) (m as THREE.MeshStandardMaterial).map = s.original.get(m) ?? null;
      for (const tex of loaded) tex.dispose();
    };
  }, [chroma, base, state]);

  return (
    <div className={styles.model}>
      <div ref={host} className={styles.canvas} role="img" aria-label={labels.rotate}>
        {state !== 'ready' && <p className={styles.overlay}>{state === 'loading' ? labels.loading : labels.error}</p>}
      </div>
      {clips.length > 1 && (
        <div className={styles.anims} role="group" aria-label={labels.animations}>
          {clips.map((name) => (
            <button key={name} type="button" aria-pressed={current === name} onClick={() => setCurrent(name)}>
              {animationLabel(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
