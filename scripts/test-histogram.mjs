// Histogram computation test — a feature Lumen was missing entirely.
import { computeHistogram, histogramPath, clipping, contrastSpread, luma } from "../src/lib/histogram.ts";

let failed = 0;
function truthy(name, cond, detail = "") {
  if (!cond) { failed++; console.log(`✗ ${name} ${detail}`); } else console.log(`✓ ${name}`);
}

console.log("── histogram ──");

// 1) Pure black image: every pixel lands in bin 0.
{
  const n = 100;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) data[i * 4 + 3] = 255;
  const h = computeHistogram(data);
  truthy("pure black: every count in bin 0", h.lum[0] === n && h.total === n, `lum[0]=${h.lum[0]} total=${h.total}`);
  truthy("pure black: black clipping = 100%", Math.abs(clipping(data).blackPct - 100) < 0.01);
}

// 2) Pure white.
{
  const n = 50;
  const data = new Uint8Array(n * 4).fill(255);
  const h = computeHistogram(data);
  truthy("pure white: every count in bin 255", h.lum[255] === n, `lum[255]=${h.lum[255]}`);
  truthy("pure white: white clipping = 100%", Math.abs(clipping(data).whitePct - 100) < 0.01);
}

// 3) Uniform distribution: one count per bin.
{
  const n = 256;
  const data = new Uint8Array(n * 4);
  for (let v = 0; v < 256; v++) {
    data[v * 4] = v; data[v * 4 + 1] = v; data[v * 4 + 2] = v; data[v * 4 + 3] = 255;
  }
  const h = computeHistogram(data);
  truthy("uniform distribution: every bin = 1", h.lum.every((v) => v === 1), `max=${h.max}`);
  truthy("uniform distribution: max = 1", h.max === 1);
}

// 4) Channels are separate: pure red shows up in r only, not in g/b.
{
  const data = new Uint8Array([255, 0, 0, 255]);
  const h = computeHistogram(data);
  truthy("pure red: r[255]=1", h.r[255] === 1);
  truthy("pure red: g[0]=1", h.g[0] === 1);
  truthy("pure red: b[0]=1", h.b[0] === 1);
}

// 5) Perceived luma, Rec.601 — verifying the formula constants.
{
  truthy("luma(255,255,255)=255", Math.abs(luma(255, 255, 255) - 255) < 1e-9);
  truthy("luma(0,0,0)=0", luma(0, 0, 0) === 0);
  truthy("green weighs more than red (0.587>0.299)", luma(0, 255, 0) > luma(255, 0, 0));
  truthy("luma(255,0,0)≈76.2", Math.abs(luma(255, 0, 0) - 76.245) < 0.01, `=${luma(255, 0, 0)}`);
}

// 6) Sampling (stride) reduces the counts but preserves the shape.
{
  const n = 1000;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { data[i * 4] = 10; data[i * 4 + 3] = 255; }
  const full = computeHistogram(data, 1);
  const sampled = computeHistogram(data, 10);
  truthy("stride=1: total=1000", full.total === 1000, `=${full.total}`);
  truthy("stride=10: total=100", sampled.total === 100, `=${sampled.total}`);
  truthy("stride does not change the peak", sampled.r[10] === 100 && full.r[10] === 1000);
}

// 7) The SVG path is valid and free of NaN.
{
  const data = new Uint8Array([0, 128, 255, 255]);
  const h = computeHistogram(data);
  const d = histogramPath(h.lum, h.max, 256, 100);
  truthy("path starts with M", d.startsWith("M "));
  truthy("path closes with Z", d.trim().endsWith("Z"));
  truthy("path has no NaN", !d.includes("NaN"));
  truthy("path has 256 points (257 L commands)", (d.match(/L /g) || []).length === 257, `=${(d.match(/L /g) || []).length}`);
  truthy("path has no Infinity", !d.includes("Infinity"));
}

// 8) max is never zero (avoids division by zero).
{
  const zeros = new Uint8Array(40);
  const h = computeHistogram(zeros);
  truthy("empty image: max>=1 (no division by zero)", h.max >= 1, `max=${h.max}`);
  const d = histogramPath(h.lum, h.max, 256, 100);
  truthy("empty image: path has no NaN", !d.includes("NaN"));
}

// 9) Flat-distribution detection (contrastSpread).
{
  const flat = new Uint8Array(400 * 4);
  for (let i = 0; i < 400; i++) { flat[i * 4] = 128; flat[i * 4 + 1] = 128; flat[i * 4 + 2] = 128; flat[i * 4 + 3] = 255; }
  const hf = computeHistogram(flat);
  truthy("flat gray: middlePct=100 → concentrated", contrastSpread(hf).concentrated === true, `=${contrastSpread(hf).middlePct}`);

  const wide = new Uint8Array(400 * 4);
  for (let i = 0; i < 400; i++) { const v = i % 256; wide[i * 4] = v; wide[i * 4 + 1] = v; wide[i * 4 + 2] = v; wide[i * 4 + 3] = 255; }
  const hw = computeHistogram(wide);
  truthy("wide distribution: not concentrated", contrastSpread(hw).concentrated === false, `=${contrastSpread(hw).middlePct}`);
}

// 10) Clipping only at 0 and 255 (no false alarm for mid-gray).
{
  const mid = new Uint8Array(100 * 4);
  for (let i = 0; i < 100; i++) { mid[i * 4] = 128; mid[i * 4 + 1] = 128; mid[i * 4 + 2] = 128; mid[i * 4 + 3] = 255; }
  const c = clipping(mid);
  truthy("gray 128: no black/white clipping", c.blackPct === 0 && c.whitePct === 0);
  truthy("gray 128: inside the safe range", c.shadowsPct === 0 && c.highlightsPct === 0);
}

console.log(failed === 0 ? "\nALL HISTOGRAM TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
