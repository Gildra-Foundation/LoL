// Эффекты частиц образа для 3D-просмотрщика: упрощённое воспроизведение систем VFX из игры.
// Данные готовит медиа-конвейер (tools/media-pipeline/pipeline/vfx.py): события анимаций запускают
// системы на костях, у эмиттеров — частота, время жизни, скорость, ускорение, торможение,
// размер и цвет по времени жизни, атлас текстуры и смешивание. Следы, лучи и искажения не рисуются.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Value {
  c?: number | number[];
  t?: number[];
  v?: (number | number[])[];
  r?: ([number, number] | null)[];
}

interface Emitter {
  name: string;
  kind: 'sprite' | 'quad' | 'mesh';
  tex?: string;
  mesh?: string;
  rate?: Value;
  plife?: Value;
  vel?: Value;
  acc?: Value;
  drag?: Value;
  scale?: Value;
  scaleLife?: Value;
  color?: Value;
  colorLife?: Value;
  rot?: Value;
  spin?: Value;
  offset?: Value;
  spawn?: Value;
  radius?: number;
  life?: number;
  delay?: number;
  div?: [number, number];
  frames?: number;
  randomFrame?: boolean;
  blend?: number;
  uniform?: boolean;
  single?: boolean;
}

interface FxEvent {
  start: number;
  end: number | null;
  bone: string | number | null;
  system: number;
  loop: boolean;
}

export interface FxData {
  events: Record<string, FxEvent[]>;
  systems: Emitter[][];
}

const MAX_PER_EMITTER = 200;
const MAX_TOTAL = 2500;

/** FNV-1a 32 бит от имени в нижнем регистре — так игра хранит имена костей в событиях. */
function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (const ch of s.toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const asArray = (x: number | number[] | undefined, n: number, fallback: number): number[] =>
  Array.isArray(x) ? Array.from({ length: n }, (_, i) => x[i] ?? fallback) : Array.from({ length: n }, () => (x ?? fallback));

/** Значение при рождении: постоянная часть, умноженная на случайный множитель из таблицы вероятностей. */
function birth(v: Value | undefined, n: number, fallback: number): number[] {
  if (!v) return asArray(undefined, n, fallback);
  const base = asArray(v.c ?? (v.v?.[0] as number | number[] | undefined), n, fallback);
  return base.map((b, i) => {
    const r = v.r?.[i] ?? (n === 1 ? v.r?.[0] : null);
    return r ? b * (r[0] + Math.random() * (r[1] - r[0])) : b;
  });
}

/** Кривая по нормированному времени жизни (0…1); без кривой — 1. */
function curve(v: Value | undefined, t: number, n: number): number[] {
  if (!v?.t || !v.v || v.t.length < 2) return asArray(undefined, n, 1);
  const { t: times, v: values } = v;
  let i = 0;
  while (i < times.length - 2 && t > times[i + 1]) i++;
  const span = times[i + 1] - times[i] || 1;
  const k = Math.min(1, Math.max(0, (t - times[i]) / span));
  const a = asArray(values[i], n, 1);
  const b = asArray(values[i + 1], n, 1);
  return a.map((x, j) => x + (b[j] - x) * k);
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number[];
  color: number[];
  rot: number;
  spin: number;
  frame: number;
  mesh?: THREE.Object3D;
  euler?: THREE.Euler;
}

interface Running {
  em: Emitter;
  bone: THREE.Object3D;
  age: number;
  life: number;
  carry: number;
  particles: Particle[];
  batch?: Batch;
  done: boolean;
}

// Спрайты и квады одной текстуры и смешивания рисуются одним InstancedMesh с шейдером «к камере».
const VERT = /* glsl */ `
attribute vec4 iColor;
attribute vec4 iFrame; // xy — сдвиг кадра в атласе, zw — размер кадра
attribute vec2 iRot;   // x — поворот, y — 1 для квада на земле
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = iFrame.xy + uv * iFrame.zw;
  vColor = iColor;
  float c = cos(iRot.x), s = sin(iRot.x);
  vec2 p = mat2(c, s, -s, c) * position.xy;
  vec4 center = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = length(instanceMatrix[0].xyz);
  if (iRot.y > 0.5) {
    gl_Position = projectionMatrix * modelViewMatrix * (center + vec4(p.x * size, 0.0, p.y * size, 0.0));
  } else {
    vec4 mv = modelViewMatrix * center;
    mv.xy += p * size;
    gl_Position = projectionMatrix * mv;
  }
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, vUv) * vColor;
  if (t.a < 0.01) discard;
  gl_FragColor = t;
}`;

class Batch {
  mesh: THREE.InstancedMesh;
  color: THREE.InstancedBufferAttribute;
  frame: THREE.InstancedBufferAttribute;
  rot: THREE.InstancedBufferAttribute;
  count = 0;
  private m = new THREE.Matrix4();

  constructor(texture: THREE.Texture, additive: boolean, capacity: number) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.frame = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.rot = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    geo.setAttribute('iColor', this.color);
    geo.setAttribute('iFrame', this.frame);
    geo.setAttribute('iRot', this.rot);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  push(pos: THREE.Vector3, size: number, color: number[], frame: [number, number, number, number], rot: number, ground: boolean) {
    const i = this.count;
    if (i >= this.mesh.instanceMatrix.count) return;
    this.m.makeScale(size, size, size).setPosition(pos);
    this.mesh.setMatrixAt(i, this.m);
    this.color.setXYZW(i, color[0], color[1], color[2], color[3]);
    this.frame.setXYZW(i, ...frame);
    this.rot.setXY(i, rot, ground ? 1 : 0);
    this.count++;
  }

  flush() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.color.needsUpdate = true;
    this.frame.needsUpdate = true;
    this.rot.needsUpdate = true;
    this.count = 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class ParticleFx {
  private bones = new Map<string | number, THREE.Object3D>();
  private batches = new Map<string, Batch>();
  private textures = new Map<string, THREE.Texture>();
  private meshes = new Map<string, Promise<THREE.Object3D | null>>();
  private running: Running[] = [];
  private fired = new Set<number>();
  private clip: string | null = null;
  private lastTime = 0;
  private group = new THREE.Group();
  private loader = new GLTFLoader();
  private texLoader = new THREE.TextureLoader();
  private tmp = new THREE.Vector3();

  /** maxSize — размер модели: меш эффекта крупнее полутора таких не рисуется (так выглядят ошибки привязки) */
  constructor(private root: THREE.Object3D, world: THREE.Scene, private base: string, private data: FxData, private maxSize = Infinity) {
    world.add(this.group);
    root.traverse((o) => {
      if (!o.name) return;
      this.bones.set(o.name.toLowerCase(), o);
      this.bones.set(fnv1a(o.name), o);
    });
  }

  /** Новая анимация: прежние эффекты гаснут, события новой ждут своего кадра. */
  start(clip: string | null) {
    for (const r of this.running) r.done = true;
    this.clip = clip;
    this.fired.clear();
    this.lastTime = 0;
  }

  update(dt: number, time: number) {
    const events = (this.clip && this.data.events[this.clip]) || [];
    // анимация пошла на новый круг — события срабатывают снова
    if (time < this.lastTime) this.fired.clear();
    this.lastTime = time;
    events.forEach((ev, i) => {
      if (this.fired.has(i) || time < Math.max(0, ev.start)) return;
      this.fired.add(i);
      this.fire(ev);
    });

    let total = 0;
    for (const r of this.running) {
      r.age += dt;
      const em = r.em;
      if (!r.done && r.age >= (em.delay ?? 0)) {
        const t = r.life > 0 ? Math.min(1, (r.age - (em.delay ?? 0)) / r.life) : 0;
        if (em.single) {
          if (r.carry === 0) {
            this.spawn(r);
            r.carry = 1;
          }
        } else {
          const rate = asArray(em.rate?.c, 1, 10)[0] * curve(em.rate, t, 1)[0];
          r.carry += rate * dt;
          while (r.carry >= 1 && r.particles.length < MAX_PER_EMITTER && total < MAX_TOTAL) {
            this.spawn(r);
            r.carry -= 1;
          }
          r.carry = Math.min(r.carry, 2);
        }
        if (r.life > 0 && r.age - (em.delay ?? 0) >= r.life) r.done = true;
      }
      this.simulate(r, dt);
      total += r.particles.length;
    }
    this.running = this.running.filter((r) => !(r.done && r.particles.length === 0));
    for (const b of this.batches.values()) b.flush();
  }

  private fire(ev: FxEvent) {
    const system = this.data.systems[ev.system];
    if (!system) return;
    const bone = (ev.bone !== null && (this.bones.get(typeof ev.bone === 'string' ? ev.bone.toLowerCase() : ev.bone) ?? null)) || this.root;
    for (const em of system) {
      // без длительности эмиттер живёт, пока идёт событие (не дольше 4 с)
      const life = em.life !== undefined && em.life > 0 && em.life < 30 ? em.life : ev.end !== null ? Math.max(0.2, ev.end - ev.start) : 4;
      const r: Running = { em, bone, age: 0, life, carry: 0, particles: [], done: false };
      if (em.kind !== 'mesh' && em.tex) r.batch = this.batch(em);
      if (em.kind === 'mesh' && em.mesh) this.mesh(em.mesh);
      this.running.push(r);
    }
  }

  private batch(em: Emitter) {
    const additive = em.blend === 1 || em.blend === 4;
    const key = `${em.tex}|${additive}`;
    let b = this.batches.get(key);
    if (!b) {
      b = new Batch(this.texture(em.tex!), additive, 1200);
      this.batches.set(key, b);
      this.group.add(b.mesh);
    }
    return b;
  }

  private texture(path: string) {
    let t = this.textures.get(path);
    if (!t) {
      t = this.texLoader.load(this.base + path);
      t.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(path, t);
    }
    return t;
  }

  private mesh(path: string) {
    let p = this.meshes.get(path);
    if (!p) {
      p = this.loader
        .loadAsync(this.base + path)
        .then((g) => g.scene)
        .catch(() => null);
      this.meshes.set(path, p);
    }
    return p;
  }

  private spawn(r: Running) {
    const em = r.em;
    const origin = r.bone.getWorldPosition(this.tmp).clone();
    const offset = birth(em.offset, 3, 0);
    const spawn = birth(em.spawn, 3, 0);
    const radius = em.radius ? em.radius * Math.cbrt(Math.random()) : 0;
    const dir = radius ? new THREE.Vector3().randomDirection().multiplyScalar(radius) : new THREE.Vector3();
    const pos = origin.add(new THREE.Vector3(offset[0] + spawn[0], offset[1] + spawn[1], offset[2] + spawn[2])).add(dir);
    const vel = birth(em.vel, 3, 0);
    const scale = birth(em.scale, 3, em.kind === 'mesh' ? 1 : 30);
    const frames = em.frames ?? (em.div ? em.div[0] * em.div[1] : 1);
    const p: Particle = {
      pos,
      vel: new THREE.Vector3(vel[0], vel[1], vel[2]),
      age: 0,
      life: Math.max(0.05, birth(em.plife, 1, 1)[0]),
      size: em.uniform ? [scale[0], scale[0], scale[0]] : scale,
      color: birth(em.color, 4, 1),
      rot: THREE.MathUtils.degToRad(birth(em.rot, 3, 0)[0]),
      spin: THREE.MathUtils.degToRad(birth(em.spin, 3, 0)[0]),
      frame: em.randomFrame ? Math.floor(Math.random() * frames) : 0,
    };
    if (em.kind === 'mesh' && em.mesh) {
      const rot = birth(em.rot, 3, 0).map(THREE.MathUtils.degToRad);
      p.euler = new THREE.Euler(rot[0], rot[1], rot[2]);
      void this.mesh(em.mesh).then((src) => {
        if (!src || p.age >= p.life) return;
        const size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
        const scaled = Math.max(size.x * p.size[0], size.y * p.size[1], size.z * p.size[2]);
        if (!Number.isFinite(scaled) || scaled > this.maxSize * 1.5) return;
        const obj = src.clone(true);
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.frustumCulled = false;
          m.material = new THREE.MeshBasicMaterial({
            map: em.tex ? this.texture(em.tex) : null,
            transparent: true,
            depthWrite: false,
            blending: em.blend === 1 || em.blend === 4 ? THREE.AdditiveBlending : THREE.NormalBlending,
            side: THREE.DoubleSide,
          });
        });
        p.mesh = obj;
        this.group.add(obj);
      });
    }
    r.particles.push(p);
  }

  private simulate(r: Running, dt: number) {
    const em = r.em;
    const acc = em.acc ? birth(em.acc, 3, 0) : null;
    const drag = em.drag ? asArray(em.drag.c, 3, 0) : null;
    const frames = em.frames ?? (em.div ? em.div[0] * em.div[1] : 1);
    const [cols, rows] = em.div ?? [1, 1];
    r.particles = r.particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) {
        if (p.mesh) {
          this.group.remove(p.mesh);
          p.mesh.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.());
        }
        return false;
      }
      const t = p.age / p.life;
      if (acc) p.vel.add(this.tmp.set(acc[0], acc[1], acc[2]).multiplyScalar(dt));
      if (drag) p.vel.set(p.vel.x / (1 + drag[0] * dt), p.vel.y / (1 + drag[1] * dt), p.vel.z / (1 + drag[2] * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
      const s = curve(em.scaleLife, t, 3);
      const c = curve(em.colorLife, t, 4);
      const color = p.color.map((x, i) => x * c[i]);
      if (p.mesh) {
        p.mesh.position.copy(p.pos);
        if (p.euler) p.mesh.rotation.copy(p.euler);
        p.mesh.scale.set(p.size[0] * s[0], p.size[1] * s[1], p.size[2] * s[2]);
        p.mesh.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
          if (m?.color) {
            m.color.setRGB(color[0], color[1], color[2]);
            m.opacity = color[3];
          }
        });
      } else if (r.batch) {
        const f = em.randomFrame ? p.frame : Math.min(frames - 1, Math.floor(t * frames));
        const fx = (f % cols) / cols;
        const fy = 1 - (Math.floor(f / cols) + 1) / rows;
        r.batch.push(p.pos, p.size[0] * s[0], color, [fx, fy, 1 / cols, 1 / rows], p.rot, em.kind === 'quad');
      }
      return true;
    });
  }

  set visible(on: boolean) {
    this.group.visible = on;
  }

  dispose() {
    for (const b of this.batches.values()) b.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.group.removeFromParent();
  }
}
