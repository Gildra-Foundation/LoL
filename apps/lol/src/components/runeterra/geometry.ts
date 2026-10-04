// Геометрия линий связей на карте: всё в пикселях кадра.

export interface Pt {
  x: number;
  y: number;
}

/** Видимая часть кадра: без панели справа и полос под кнопками. */
export interface Frame {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export const inFrame = (p: Pt, f: Frame) => p.x >= f.left && p.x <= f.right && p.y >= f.top && p.y <= f.bottom;

/** Где отрезок из точки a (внутри кадра) к точке b (за кадром) пересекает край кадра. */
export function exitPoint(a: Pt, b: Pt, f: Frame): { p: Pt; edge: Edge } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const hits: [number, Edge][] = [];
  if (dx > 0) hits.push([(f.right - a.x) / dx, 'right']);
  if (dx < 0) hits.push([(f.left - a.x) / dx, 'left']);
  if (dy > 0) hits.push([(f.bottom - a.y) / dy, 'bottom']);
  if (dy < 0) hits.push([(f.top - a.y) / dy, 'top']);
  const [k, edge] = hits.reduce((min, h) => (h[0] < min[0] ? h : min));
  return { p: { x: a.x + dx * k, y: a.y + dy * k }, edge };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Дуга из a в b, выгнутая вверх на долю длины bend; mid — середина дуги для подписи. */
export function arc(a: Pt, b: Pt, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const c = { x: (a.x + b.x) / 2 + nx * len * bend, y: (a.y + b.y) / 2 + ny * len * bend };
  return {
    d: `M${r1(a.x)} ${r1(a.y)}Q${r1(c.x)} ${r1(c.y)} ${r1(b.x)} ${r1(b.y)}`,
    mid: { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y },
  };
}

/** Раздвигает центры меток на отрезке [lo, hi], сохраняя порядок; size — длина каждой метки. */
function place(pos: number[], size: number[], lo: number, hi: number, gap: number) {
  const out = [...pos];
  for (let k = 0; k < out.length; k++) {
    const min = k === 0 ? lo + size[k] / 2 : out[k - 1] + (size[k - 1] + size[k]) / 2 + gap;
    out[k] = Math.max(out[k], min);
  }
  for (let k = out.length - 1; k >= 0; k--) {
    const max = k === out.length - 1 ? hi - size[k] / 2 : out[k + 1] - (size[k + 1] + size[k]) / 2 - gap;
    out[k] = Math.min(out[k], max);
  }
  return out;
}

/**
 * Раздвигает метки вдоль каждого края кадра, чтобы не налезали друг на друга;
 * если в один ряд не помещаются — второй ряд ближе к центру кадра.
 * Углы кадра отданы верхнему и нижнему краю — боковые метки в них не заходят.
 */
export function spread(items: { key: string; edge: Edge; p: Pt; w: number; h: number }[], f: Frame, gap = 6, corner = 36) {
  const out = new Map<string, Pt>();
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const vertical = edge === 'left' || edge === 'right';
    const along = (i: (typeof items)[number]) => (vertical ? i.h : i.w);
    const across = (i: (typeof items)[number]) => (vertical ? i.w : i.h);
    const list = items.filter((i) => i.edge === edge).sort((a, b) => (vertical ? a.p.y - b.p.y : a.p.x - b.p.x));
    if (list.length === 0) continue;
    const lo = vertical ? f.top + corner : f.left;
    const hi = vertical ? f.bottom - corner : f.right;
    const rows = Math.max(1, Math.ceil(list.reduce((n, i) => n + along(i) + gap, -gap) / (hi - lo)));
    const inward = edge === 'right' || edge === 'bottom' ? -1 : 1;
    let shift = 0;
    for (let r = 0; r < rows; r++) {
      const row = list.filter((_, k) => k % rows === r);
      const pos = place(
        row.map((i) => (vertical ? i.p.y : i.p.x)),
        row.map(along),
        lo,
        hi,
        gap,
      );
      row.forEach((i, k) => {
        const c = (vertical ? i.p.x : i.p.y) + inward * shift;
        out.set(i.key, vertical ? { x: c, y: pos[k] } : { x: pos[k], y: c });
      });
      shift += Math.max(...row.map(across)) + gap;
    }
  }
  return out;
}
