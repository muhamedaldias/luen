/* Magic Wand selection (pure CPU, no AI, no external dependencies).
 * Click a pixel -> flood-fill the connected region whose RGB Euclidean
 * distance from the seed pixel is <= tolerance, or (contiguous=false)
 * select every pixel in the image within tolerance.
 * Works on a downscaled copy for speed, then upscales the mask with
 * nearest-neighbor to full image resolution.
 * Mask convention: PNG dataURL, white = inside selection, black = outside. */

const MAX_WORK_DIM = 320;

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("selection: image decode failed"));
    img.src = url;
  });
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("selection: no 2d context");
  return [c, ctx];
}

export interface WandOptions {
  tolerance: number;
  contiguous: boolean;
}

export function clampTolerance(t: number): number {
  if (!Number.isFinite(t)) return 32;
  return Math.max(0, Math.min(255, Math.round(t)));
}

/** Flood-fill selection. (x, y) are full-resolution image pixel coords. */
export async function magicWandSelect(
  imageUrl: string,
  x: number,
  y: number,
  tolerance: number,
  contiguous: boolean
): Promise<string> {
  const tol = clampTolerance(tolerance);
  const img = await loadImageEl(imageUrl);
  const fullW = img.naturalWidth || img.width || 1;
  const fullH = img.naturalHeight || img.height || 1;
  if (fullW < 1 || fullH < 1) throw new Error("selection: empty image");

  const scale = Math.min(1, MAX_WORK_DIM / Math.max(fullW, fullH));
  const workW = Math.max(1, Math.round(fullW * scale));
  const workH = Math.max(1, Math.round(fullH * scale));
  const [work, wctx] = canvasOf(workW, workH);
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = "high";
  wctx.drawImage(img, 0, 0, workW, workH);
  const src = wctx.getImageData(0, 0, workW, workH).data;

  const sx = Math.max(0, Math.min(workW - 1, Math.round(x * scale)));
  const sy = Math.max(0, Math.min(workH - 1, Math.round(y * scale)));
  const si = (sy * workW + sx) * 4;
  const sr = src[si];
  const sg = src[si + 1];
  const sb = src[si + 2];
  const tol2 = tol * tol;

  const selected = new Uint8Array(workW * workH);
  if (contiguous) {
    // 8-connected region growing from the seed pixel.
    const stack: number[] = [sy * workW + sx];
    selected[sy * workW + sx] = 1;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const px = p % workW;
      const py = (p / workW) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= workH) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= workW) continue;
          const q = ny * workW + nx;
          if (selected[q] === 1) continue;
          const i = q * 4;
          const dr = src[i] - sr;
          const dg = src[i + 1] - sg;
          const db = src[i + 2] - sb;
          if (dr * dr + dg * dg + db * db <= tol2) {
            selected[q] = 1;
            stack.push(q);
          }
        }
      }
    }
  } else {
    for (let p = 0; p < workW * workH; p++) {
      const i = p * 4;
      const dr = src[i] - sr;
      const dg = src[i + 1] - sg;
      const db = src[i + 2] - sb;
      if (dr * dr + dg * dg + db * db <= tol2) selected[p] = 1;
    }
  }

  // Small mask canvas, then nearest-neighbor upscale to full resolution.
  const [small, sctx] = canvasOf(workW, workH);
  const out = sctx.createImageData(workW, workH);
  for (let p = 0; p < workW * workH; p++) {
    const v = selected[p] === 1 ? 255 : 0;
    out.data[p * 4] = v;
    out.data[p * 4 + 1] = v;
    out.data[p * 4 + 2] = v;
    out.data[p * 4 + 3] = 255;
  }
  sctx.putImageData(out, 0, 0);

  const [full, fctx] = canvasOf(fullW, fullH);
  fctx.imageSmoothingEnabled = false;
  fctx.fillStyle = "#000";
  fctx.fillRect(0, 0, fullW, fullH);
  fctx.drawImage(small, 0, 0, fullW, fullH);
  return full.toDataURL("image/png");
}

export interface QuickSeed {
  x: number;
  y: number;
}

export type QuickMode = "add" | "subtract";

export function clampBrushRadius(r: number): number {
  if (!Number.isFinite(r)) return 40;
  return Math.max(1, Math.min(200, Math.round(r)));
}

/** Brush-based multi-seed region growing. (seeds in full-resolution image pixel coords.)
 *  Every seed paints a disc of `brushRadius`, then a single multi-source BFS grows
 *  each pixel only while it stays within `tolerance` of its origin seed's color
 *  (8-connected). Downscales for speed, then upscales nearest-neighbor.
 *  Returns the grown region mask (PNG dataURL, white = inside). The caller combines
 *  it with any existing selection: union for mode "add", difference for "subtract". */
export async function quickSelect(
  imageUrl: string,
  seeds: QuickSeed[],
  brushRadius: number,
  tolerance: number,
  mode: QuickMode
): Promise<string> {
  if (mode !== "add" && mode !== "subtract") throw new Error("selection: bad quick-select mode");
  if (!seeds || seeds.length === 0) throw new Error("selection: no seed points");
  const tol = clampTolerance(tolerance);
  const brush = clampBrushRadius(brushRadius);
  const img = await loadImageEl(imageUrl);
  const fullW = img.naturalWidth || img.width || 1;
  const fullH = img.naturalHeight || img.height || 1;
  if (fullW < 1 || fullH < 1) throw new Error("selection: empty image");

  const scale = Math.min(1, MAX_WORK_DIM / Math.max(fullW, fullH));
  const workW = Math.max(1, Math.round(fullW * scale));
  const workH = Math.max(1, Math.round(fullH * scale));
  const [work, wctx] = canvasOf(workW, workH);
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = "high";
  wctx.drawImage(img, 0, 0, workW, workH);
  const src = wctx.getImageData(0, 0, workW, workH).data;

  const workBrush = Math.max(1, brush * scale);
  const tol2 = tol * tol;
  const selected = new Uint8Array(workW * workH);
  const origin = new Int32Array(workW * workH).fill(-1);
  // Dedupe seed pixels (work coords), cap to bound the BFS queue.
  const MAX_SEEDS = 6000;
  const seedIdx: number[] = [];
  const seen = new Set<number>();
  const step = seeds.length > MAX_SEEDS ? Math.ceil(seeds.length / MAX_SEEDS) : 1;
  for (let s = 0; s < seeds.length; s += step) {
    const sx = Math.max(0, Math.min(workW - 1, Math.round(seeds[s].x * scale)));
    const sy = Math.max(0, Math.min(workH - 1, Math.round(seeds[s].y * scale)));
    // Paint a brush disc around each seed as an additional seed source.
    const r = Math.ceil(workBrush);
    for (let dy = -r; dy <= r; dy++) {
      const ny = sy + dy;
      if (ny < 0 || ny >= workH) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > workBrush * workBrush) continue;
        const nx = sx + dx;
        if (nx < 0 || nx >= workW) continue;
        const q = ny * workW + nx;
        if (seen.has(q)) continue;
        seen.add(q);
        if (seedIdx.length >= MAX_SEEDS) break;
        seedIdx.push(q);
      }
      if (seedIdx.length >= MAX_SEEDS) break;
    }
    if (seedIdx.length >= MAX_SEEDS) break;
  }
  if (seedIdx.length === 0) throw new Error("selection: seeds outside image");

  // Origin seed colors (one entry per unique seed pixel).
  const seedColors = new Float32Array(seedIdx.length * 3);
  const stack: number[] = [];
  for (let k = 0; k < seedIdx.length; k++) {
    const q = seedIdx[k];
    const i = q * 4;
    seedColors[k * 3] = src[i];
    seedColors[k * 3 + 1] = src[i + 1];
    seedColors[k * 3 + 2] = src[i + 2];
    selected[q] = 1;
    origin[q] = k;
    stack.push(q);
  }

  // Multi-source BFS: a pixel joins iff within tolerance of ITS origin seed color.
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const k = origin[p];
    const sr = seedColors[k * 3];
    const sg = seedColors[k * 3 + 1];
    const sb = seedColors[k * 3 + 2];
    const px = p % workW;
    const py = (p / workW) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = py + dy;
      if (ny < 0 || ny >= workH) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = px + dx;
        if (nx < 0 || nx >= workW) continue;
        const q = ny * workW + nx;
        if (selected[q] === 1) continue;
        const i = q * 4;
        const dr = src[i] - sr;
        const dg = src[i + 1] - sg;
        const db = src[i + 2] - sb;
        if (dr * dr + dg * dg + db * db <= tol2) {
          selected[q] = 1;
          origin[q] = k;
          stack.push(q);
        }
      }
    }
  }

  // Small mask canvas, then nearest-neighbor upscale to full resolution.
  const [small, sctx] = canvasOf(workW, workH);
  const out = sctx.createImageData(workW, workH);
  for (let p = 0; p < workW * workH; p++) {
    const v = selected[p] === 1 ? 255 : 0;
    out.data[p * 4] = v;
    out.data[p * 4 + 1] = v;
    out.data[p * 4 + 2] = v;
    out.data[p * 4 + 3] = 255;
  }
  sctx.putImageData(out, 0, 0);

  const [full, fctx] = canvasOf(fullW, fullH);
  fctx.imageSmoothingEnabled = false;
  fctx.fillStyle = "#000";
  fctx.fillRect(0, 0, fullW, fullH);
  fctx.drawImage(small, 0, 0, fullW, fullH);
  return full.toDataURL("image/png");
}

/** White-pixel count of a mask dataURL (sampled, for toast feedback). */
export async function countMaskPixels(maskUrl: string): Promise<number> {
  const img = await loadImageEl(maskUrl);
  const W = img.naturalWidth || img.width || 0;
  const H = img.naturalHeight || img.height || 0;
  if (W < 1 || H < 1) return 0;
  const scale = Math.min(1, 256 / Math.max(W, H));
  const sw = Math.max(1, Math.round(W * scale));
  const sh = Math.max(1, Math.round(H * scale));
  const [c, ctx] = canvasOf(sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, sw, sh);
  const d = ctx.getImageData(0, 0, sw, sh).data;
  let sampled = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 127) sampled++;
  }
  return Math.round((sampled / (sw * sh)) * W * H);
}

async function maskToCanvas(maskUrl: string): Promise<[HTMLCanvasElement, CanvasRenderingContext2D]> {
  const img = await loadImageEl(maskUrl);
  const W = img.naturalWidth || img.width || 1;
  const H = img.naturalHeight || img.height || 1;
  const [c, ctx] = canvasOf(W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, W, H);
  return [c, ctx];
}

function canvasToMaskUrl(c: HTMLCanvasElement): string {
  return c.toDataURL("image/png");
}

/** Combine two masks (white = selected). mode "add" = union, "subtract" = a minus b. */
export async function combineMasks(aUrl: string | null, bUrl: string, mode: "add" | "subtract"): Promise<string> {
  if (!aUrl) return bUrl;
  const [[ca, xa], [cb, xb]] = await Promise.all([maskToCanvas(aUrl), maskToCanvas(bUrl)]);
  const W = Math.max(ca.width, cb.width);
  const H = Math.max(ca.height, cb.height);
  const [out, octx] = canvasOf(W, H);
  octx.imageSmoothingEnabled = false;
  octx.fillStyle = "#000";
  octx.fillRect(0, 0, W, H);
  octx.drawImage(ca, 0, 0, W, H);
  const da = octx.getImageData(0, 0, W, H);
  const [tmp, tctx] = canvasOf(W, H);
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, W, H);
  tctx.drawImage(cb, 0, 0, W, H);
  const db = tctx.getImageData(0, 0, W, H).data;
  const d = da.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i] > 127;
    const b = db[i] > 127;
    const v = mode === "add" ? a || b : a && !b;
    d[i] = v ? 255 : 0;
    d[i + 1] = v ? 255 : 0;
    d[i + 2] = v ? 255 : 0;
    d[i + 3] = 255;
  }
  octx.putImageData(da, 0, 0);
  void xa;
  void xb;
  return canvasToMaskUrl(out);
}

/** Invert a mask (white <-> black). */
export async function invertMask(maskUrl: string): Promise<string> {
  const [c, ctx] = await maskToCanvas(maskUrl);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > 127 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasToMaskUrl(c);
}

/** Solid white (select all) or black (empty) mask at the given size. */
export function solidMaskDataUrl(w: number, h: number, white: boolean): string {
  const [c, ctx] = canvasOf(Math.max(1, w), Math.max(1, h));
  ctx.fillStyle = white ? "#ffffff" : "#000000";
  ctx.fillRect(0, 0, c.width, c.height);
  return canvasToMaskUrl(c);
}

/** Soft-blur a mask (feather). radius 0 = no-op. */
export async function featherMask(maskUrl: string, radius: number): Promise<string> {
  const r = Math.max(0, Math.min(60, Math.round(radius)));
  const [c, ctx] = await maskToCanvas(maskUrl);
  if (r === 0) return canvasToMaskUrl(c);
  const [out, octx] = canvasOf(c.width, c.height);
  octx.fillStyle = "#000";
  octx.fillRect(0, 0, out.width, out.height);
  try {
    octx.filter = `blur(${r}px)`;
  } catch {
    return canvasToMaskUrl(c);
  }
  octx.drawImage(c, 0, 0);
  try {
    octx.filter = "none";
  } catch {
    /* ignore */
  }
  return canvasToMaskUrl(out);
}
