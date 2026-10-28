/* ── Alpha mask refinement: pure functions with no DOM (directly testable) ──
 * Used by background removal (neural and classical) to fix defects in the raw mask:
 * stray specks, the colored halo around edges, and uncertain transitions. */

/** Label connected components (8-connectivity): areas and bounding boxes per component. */
type ComponentMap = {
  count: number;
  labels: Int32Array;
  areas: number[];
  bx0: number[];
  bx1: number[];
  by0: number[];
  by1: number[];
};

function labelMaskComponents(mask: Uint8ClampedArray, w: number, h: number): ComponentMap {
  const n = w * h;
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = mask[i] > 127 ? 1 : 0;
  const labels = new Int32Array(n);
  const stack = new Int32Array(n);
  const areas: number[] = [];
  const bx0: number[] = [];
  const bx1: number[] = [];
  const by0: number[] = [];
  const by1: number[] = [];
  let comp = 0;
  for (let seed = 0; seed < n; seed++) {
    if (!bin[seed] || labels[seed]) continue;
    comp++;
    let sp = 0;
    let area = 0;
    stack[sp++] = seed;
    labels[seed] = comp;
    let x0 = seed % w, x1 = x0, y0 = (seed / w) | 0, y1 = y0;
    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const px = p % w;
      const py = (p / w) | 0;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) {
        const y = py + dy;
        if (y < 0 || y >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          if (x < 0 || x >= w || (!dx && !dy)) continue;
          const q = y * w + x;
          if (bin[q] && !labels[q]) {
            labels[q] = comp;
            stack[sp++] = q;
          }
        }
      }
    }
    areas[comp] = area;
    bx0[comp] = x0; bx1[comp] = x1; by0[comp] = y0; by1[comp] = y1;
  }
  return { count: comp, labels, areas, bx0, bx1, by0, by1 };
}

/** "Edge-hugging": its whole bounding box lies inside a shallow outer band (16% inset, 30% deep)
 * and it touches the image frame — the signature of remnants clipped at the border, not a separate part with free space. */
function isEdgeHugging(c: ComponentMap, id: number, w: number, h: number): boolean {
  const inBand =
    (c.bx0[id] <= 0.16 * w && c.bx1[id] <= 0.3 * w) ||
    (c.bx0[id] >= 0.7 * w && c.bx1[id] >= 0.84 * w) ||
    (c.by0[id] <= 0.16 * h && c.by1[id] <= 0.3 * h) ||
    (c.by0[id] >= 0.7 * h && c.by1[id] >= 0.84 * h);
  const touchesFrame =
    c.bx0[id] === 0 || c.by0[id] === 0 || c.bx1[id] === w - 1 || c.by1[id] === h - 1;
  return inBand && touchesFrame;
}

function dropComponent(mask: Uint8ClampedArray, c: ComponentMap, id: number): void {
  for (let i = 0; i < mask.length; i++) if (c.labels[i] === id) mask[i] = 0;
}

/** Keeps trustworthy connected components and zeroes the suspicious ones (8-connectivity). Two removal rules:
 * 1) Any component smaller than 8% of the largest component.
 * 2) "Edge-hugging": a component that starts inside the outer 16% band and does not extend deeper
 *    (30% threshold) with an area below 45% of the largest — the signature of reflection
 *    and detached-lighting remnants; a genuine subject cropped at the frame extends deeper than 30%.
 * Mutates the array in place. */
export function keepMajorMaskComponents(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  minRatioOfLargest = 0.08,
): void {
  const c = labelMaskComponents(mask, w, h);
  if (c.count <= 1) return;
  let largest = 0;
  for (let id = 1; id <= c.count; id++) if (c.areas[id] > largest) largest = c.areas[id];
  const min = largest * minRatioOfLargest;
  for (let id = 1; id <= c.count; id++) {
    if (c.areas[id] < min || (isEdgeHugging(c, id, w, h) && c.areas[id] < largest * 0.45)) {
      dropComponent(mask, c, id);
    }
  }
}

/** Click-anchored filtering: the user clicked a subject — its component is always kept, along with
 * the non-edge-hugging components that reach at least 30% of the largest component.
 * (ax, ay) are the click coordinates in the mask's own space. */
export function keepAnchorMaskComponents(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  ax: number,
  ay: number,
  minRatioOfLargest = 0.3,
): void {
  const c = labelMaskComponents(mask, w, h);
  if (c.count <= 1) return;
  const cx = Math.min(w - 1, Math.max(0, Math.round(ax)));
  const cy = Math.min(h - 1, Math.max(0, Math.round(ay)));
  const anchorId = c.labels[cy * w + cx];
  if (anchorId === 0) {
    // The click landed on the background (outside any subject): there is no component to anchor on —
    // fall back to keeping only the largest components instead of wiping the whole mask.
    keepMajorMaskComponents(mask, w, h);
    return;
  }
  let largest = 0;
  for (let id = 1; id <= c.count; id++) if (c.areas[id] > largest) largest = c.areas[id];
  const min = largest * minRatioOfLargest;
  for (let id = 1; id <= c.count; id++) {
    if (id === anchorId) continue;
    const trusted = c.areas[id] >= min && !isEdgeHugging(c, id, w, h);
    if (!trusted) dropComponent(mask, c, id);
  }
}

/** Fraction of "uncertain" mask pixels (between 64 and 191) — a measure of how soft the subject is.
 * Frosted glass and translucent subjects give a high fraction; an opaque subject gives a low one. */
export function maskSoftnessRatio(mask: Uint8ClampedArray, n: number): number {
  let mid = 0;
  for (let i = 0; i < n; i++) if (mask[i] > 64 && mask[i] < 192) mid++;
  return mid / Math.max(1, n);
}

/** Wide-range smoothstep confidence curve (15%–85%): suppresses faint halos without
 * eating translucent subjects (glass, fabric) that sit in the middle of the range. */
export function sharpenAlpha(a: number): number {
  let t = (a / 255 - 0.15) / 0.7;
  if (t <= 0) return 0;
  if (t >= 1) return 255;
  return Math.round(t * t * (3 - 2 * t) * 255);
}

/** Separable erosion (min filter over a (2r+1)² window) — swallows 1-3px of the background edge
 * so the colored halo stuck to the subject boundary disappears. */
export function erodeAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) return;
  const tmp = new Uint8ClampedArray(alpha.length);
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 255;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let k = x0; k <= x1; k++) {
        const v = alpha[row + k];
        if (v < m) m = v;
      }
      tmp[row + x] = m;
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let k = y0; k <= y1; k++) {
        const v = tmp[k * w + x];
        if (v < m) m = v;
      }
      alpha[y * w + x] = m;
    }
  }
}

/** Soft feather: two separable box passes (a Gaussian approximation) — restores a natural transition
 * at the boundary after erosion instead of a hard jagged edge. */
export function featherAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) return;
  const tmp = new Uint8ClampedArray(alpha.length);
  const boxBlur = (src: Uint8ClampedArray, dst: Uint8ClampedArray, horizontal: boolean) => {
    const span = 2 * r + 1;
    if (horizontal) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))];
        for (let x = 0; x < w; x++) {
          dst[row + x] = Math.round(sum / span);
          const add = src[row + Math.min(w - 1, x + r + 1)];
          const sub = src[row + Math.max(0, x - r)];
          sum += add - sub;
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[Math.min(h - 1, Math.max(0, k)) * w + x];
        for (let y = 0; y < h; y++) {
          dst[y * w + x] = Math.round(sum / span);
          const add = src[Math.min(h - 1, y + r + 1) * w + x];
          const sub = src[Math.max(0, y - r) * w + x];
          sum += add - sub;
        }
      }
    }
  };
  boxBlur(alpha, tmp, true);
  boxBlur(tmp, alpha, false);
  boxBlur(alpha, tmp, true);
  boxBlur(tmp, alpha, false);
}

/** Refinement radii scaled by image size: a light touch for small images, stronger for large ones. */
export function refineRadii(minSide: number): { erode: number; feather: number } {
  return {
    erode: Math.min(3, Math.max(1, Math.round(minSide / 400))),
    feather: Math.min(4, Math.max(1, Math.round(minSide / 300))),
  };
}
