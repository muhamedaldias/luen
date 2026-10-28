/**
 * Histogram computation — the heart of any professional photo editor.
 *
 * It was entirely missing from Lumen. The functions here are **pure** (no DOM) so they can be tested
 * directly in Node, and the output is rendered as SVG in the UI (no canvas, no taint).
 */

export type HistogramChannel = "rgb" | "lum" | "r" | "g" | "b";

export interface Histogram {
  /** 256 bins per channel. */
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  /** Perceived luminance (Rec.601 luma) — what Photoshop shows for the RGB channel. */
  lum: Uint32Array;
  /** Highest bin count across the displayed channels (for visual normalization). */
  max: number;
  /** Number of pixels sampled. */
  total: number;
}

/** Perceived luminance with Rec.601 coefficients — the same formula Photoshop/Lightroom use. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Computes the histogram from raw RGBA data.
 * @param data RGBA bytes (length = width×height×4)
 * @param stride Sampling step — 1 for every pixel, larger for huge images (for speed).
 */
export function computeHistogram(data: ArrayLike<number>, stride = 1): Histogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const lum = new Uint32Array(256);
  const step = Math.max(1, Math.floor(stride)) * 4;

  for (let i = 0; i + 2 < data.length; i += step) {
    const rv = data[i] & 255;
    const gv = data[i + 1] & 255;
    const bv = data[i + 2] & 255;
    r[rv]++;
    g[gv]++;
    b[bv]++;
    lum[Math.max(0, Math.min(255, Math.round(luma(rv, gv, bv))))]++;
  }

  const total = r.reduce((a, v) => a + v, 0);
  let max = 1;
  for (let i = 0; i < 256; i++) {
    if (r[i] > max) max = r[i];
    if (g[i] > max) max = g[i];
    if (b[i] > max) max = b[i];
    if (lum[i] > max) max = lum[i];
  }
  return { r, g, b, lum, max, total };
}

/**
 * Clipping ratio — how many pixels reached pure black/white.
 * This is one of the most important professional exposure readings.
 */
export function clipping(data: ArrayLike<number>): {
  blackPct: number;
  whitePct: number;
  shadowsPct: number;
  highlightsPct: number;
} {
  let black = 0;
  let white = 0;
  let shadows = 0;
  let highlights = 0;
  let n = 0;
  for (let i = 0; i + 2 < data.length; i += 4) {
    const l = Math.round(luma(data[i] & 255, data[i + 1] & 255, data[i + 2] & 255));
    if (l <= 0) black++;
    if (l >= 255) white++;
    if (l < 32) shadows++;
    if (l > 223) highlights++;
    n++;
  }
  const pct = (v: number) => (n === 0 ? 0 : (v / n) * 100);
  return { blackPct: pct(black), whitePct: pct(white), shadowsPct: pct(shadows), highlightsPct: pct(highlights) };
}

/**
 * Converts the histogram into a single closed SVG path.
 * @param bins 256 bins
 * @param max Maximum value used for normalization
 * @param w Path width, h its height
 */
export function histogramPath(bins: ArrayLike<number>, max: number, w: number, h: number): string {
  const denom = Math.max(1, max);
  let d = `M 0 ${h}`;
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * w;
    // The square root lifts the shadows — the same approach Photoshop uses to display it.
    const norm = Math.sqrt(Math.max(0, bins[i]) / denom);
    const y = h - Math.min(1, norm) * h;
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

/** Is the image flat (does it need exposure/contrast)? The fraction of pixels sitting in the midtones. */
export function contrastSpread(hist: Histogram): { concentrated: boolean; middlePct: number } {
  let mid = 0;
  for (let i = 64; i <= 191; i++) mid += hist.lum[i];
  const middlePct = hist.total === 0 ? 0 : (mid / hist.total) * 100;
  return { concentrated: middlePct > 80, middlePct };
}