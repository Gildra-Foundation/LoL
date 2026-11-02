'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import styles from './SkinMedia.module.css';

interface SubmeshEvent {
  start: number;
  end: number | null;
  show: string[];
  hide: string[];
}

export interface ModelViewerProps {
  url: string;
  /** остальные анимации отдельным файлом: грузятся в фоне, когда модель уже на экране */
  animsUrl: string | null;
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
export default function ModelViewer({ url, animsUrl, animations, animationLabel, base, chroma, labels }: ModelViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<{
    mixer: THREE.AnimationMixer;
    clips: THREE.AnimationClip[];
    original: Map<THREE.Material, THREE.Texture | null>;
    chromas: Record<string, Record<string, string>>;
    /** видимость частей модели в момент t анимации: скрытые при появлении части и события клипа */
    showAt: (clip: string | null, t: number) => void;
  } | null>(null);
  const currentRef = useRef<string | null>(null);
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

        // Части, спрятанные при появлении (оружие, реквизит, снеговик Нуну, вторая форма), и события
        // анимаций, которые их показывают и прячут — как в игре.
        const extras = (gltf.userData?.riftden ?? {}) as { hidden?: string[]; events?: Record<string, SubmeshEvent[]>; chromas?: Record<string, Record<string, string>> };
        const parts = new Map<string, THREE.Object3D[]>();
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const name = ([mesh.material].flat()[0] as THREE.Material).name.toLowerCase();
          parts.set(name, [...(parts.get(name) ?? []), mesh]);
        });
        const hidden = new Set((extras.hidden ?? []).map((n) => n.toLowerCase()));
        const showAt = (clip: string | null, t: number) => {
          const shown = new Map<string, boolean>();
          for (const name of parts.keys()) shown.set(name, !hidden.has(name));
          for (const ev of (clip && extras.events?.[clip]) || []) {
            if (t < ev.start || (ev.end !== null && t >= ev.end)) continue;
            for (const n of ev.show) shown.set(n.toLowerCase(), true);
            for (const n of ev.hide) shown.set(n.toLowerCase(), false);
          }
          for (const [name, objects] of parts) for (const o of objects) o.visible = shown.get(name) ?? true;
        };
        showAt(null, 0);
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
            if (!mesh.isSkinnedMesh || !mesh.visible) return;
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
            // видимость — по самому «сжатому» моменту, кадр — по рамке всех моментов
            const box = samples.reduce((acc, x) => acc.union(x.box), new THREE.Box3());
            const size = box.getSize(new THREE.Vector3());
            return [n, { box, extent: Math.min(...samples.map((x) => x.extent)), span: [size.x, size.y, size.z].every(Number.isFinite) ? Math.max(size.x, size.y, size.z) : 0 }];
          }),
        );
        const visible = (n: string) => boxes.get(n)!.extent >= bind.extent * 0.35;
        // у образов с превращениями бывает, что ни одна анимация не держит модель на виду — тогда поза привязки
        const start = ordered.find((n) => /idle/i.test(n) && visible(n)) ?? ordered.find(visible) ?? null;
        // Кадр по меньшей из рамок — позы привязки и стартовой анимации: в одной лишние формы сложены
        // на месте, в другой анимация уносит спрятанные части в сторону.
        const startBox = start ? boxes.get(start)! : { ...bind, span: bind.extent };
        const frameBox = startBox.span > 0 && (startBox.span < bind.extent || bind.extent === 0) ? startBox.box : bind.box;
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
        const chromas = extras.chromas ?? {};
        const loaded = [...gltf.animations];
        scene.current = { mixer, clips: loaded, original, chromas, showAt };
        setClips(ordered);
        setCurrent(start);
        setState('ready');

        // Остальные анимации — вторым файлом, когда модель уже видна. Имена узлов те же, клипы
        // подключаются к уже загруженному скелету.
        if (animsUrl) {
          loader.load(animsUrl, (more) => {
            if (disposed) return;
            loaded.push(...more.animations);
            const names = loaded.map((c) => c.name);
            setClips([...animations.filter((a) => names.includes(a)), ...names.filter((n) => !animations.includes(n))]);
            // ожидание не показало модель (образы с превращениями) — первая анимация, где она видна
            if (!currentRef.current) {
              const playing = more.animations.find((clip) => [0.05, 0.3, 0.55, 0.8].every((at) => posed(clip, at).extent >= bind.extent * 0.35));
              mixer.stopAllAction();
              for (const [o, [p, q, s]] of rest) {
                o.position.copy(p);
                o.quaternion.copy(q);
                o.scale.copy(s);
              }
              if (playing) setCurrent(playing.name);
            }
          });
        }
      },
      undefined,
      () => !disposed && setState('error'),
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const s = scene.current;
      if (s) {
        s.mixer.update(clock.getDelta());
        const name = currentRef.current;
        const clip = name ? s.clips.find((c) => c.name === name) : undefined;
        s.showAt(name, clip ? s.mixer.existingAction(clip)?.time ?? 0 : 0);
      }
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
  }, [url, animsUrl, animations]);

  // анимация
  useEffect(() => {
    currentRef.current = current;
    const s = scene.current;
    if (!s || !current) return;
    const clip = s.clips.find((c) => c.name === current);
    if (!clip) return;
    s.mixer.stopAllAction();
    s.mixer.clipAction(clip).reset().fadeIn(0.2).play();
  }, [current, state, clips]);

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
      {animations.length > 1 && clips.length > 0 && (
        <div className={styles.anims} role="group" aria-label={labels.animations}>
          {[...clips, ...animations.filter((n) => !clips.includes(n))].map((name) => (
            // ещё не догруженные анимации видны сразу, но нажимаются, когда придут
            <button key={name} type="button" aria-pressed={current === name} disabled={!clips.includes(name)} onClick={() => setCurrent(name)}>
              {animationLabel(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
