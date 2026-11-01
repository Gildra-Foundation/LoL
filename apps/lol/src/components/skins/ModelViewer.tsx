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
        world.add(root);
        // кадр по размеру модели
        root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).computeBoundingBox());
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) / 2;
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
        const mixer = new THREE.AnimationMixer(root);
        const chromas = (gltf.userData?.riftden?.chromas ?? {}) as Record<string, Record<string, string>>;
        scene.current = { mixer, clips: gltf.animations, original, chromas };
        const names = gltf.animations.map((c) => c.name);
        const ordered = [...animations.filter((a) => names.includes(a)), ...names.filter((n) => !animations.includes(n))];
        setClips(ordered);
        setCurrent(ordered.find((n) => /idle/i.test(n)) ?? ordered[0] ?? null);
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
