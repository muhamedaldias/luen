/* معالجة صور محلية (Offline) داخل المتصفح عبر Canvas 2D.
   تُستخدم تلقائياً عندما لا يوجد imageId (الباكند غير متصل) —
   كل فلاتر القائمة العلوية تعمل دائماً، والباكند يُستخدم عند توفره لجودة أعلى. */

import {
  keepMajorMaskComponents,
  keepAnchorMaskComponents,
  sharpenAlpha,
  erodeAlpha,
  featherAlpha,
  maskSoftnessRatio,
  refineRadii,
} from "./maskRefine";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

export function getNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return loadImg(src)
    .then((img) => ({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 }))
    .catch(() => ({ width: 0, height: 0 }));
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  return [c, ctx];
}

function drawFiltered(img: HTMLImageElement, filter: string): HTMLCanvasElement {
  const [c, ctx] = canvasOf(img.naturalWidth, img.naturalHeight);
  ctx.filter = filter;
  ctx.drawImage(img, 0, 0);
  ctx.filter = "none";
  return c;
}

function convolve(src: HTMLCanvasElement, kernel: number[], divisor = 1): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const s = ctx.getImageData(0, 0, c.width, c.height);
  const out = ctx.createImageData(c.width, c.height);
  const d = s.data;
  const o = out.data;
  const W = c.width;
  const H = c.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const yy = Math.min(H - 1, Math.max(0, y + ky));
        for (let kx = -1; kx <= 1; kx++) {
          const xx = Math.min(W - 1, Math.max(0, x + kx));
          const kv = kernel[(ky + 1) * 3 + (kx + 1)] / divisor;
          const i = (yy * W + xx) * 4;
          r += d[i] * kv;
          g += d[i + 1] * kv;
          b += d[i + 2] * kv;
        }
      }
      const j = (y * W + x) * 4;
      o[j] = Math.max(0, Math.min(255, Math.round(r)));
      o[j + 1] = Math.max(0, Math.min(255, Math.round(g)));
      o[j + 2] = Math.max(0, Math.min(255, Math.round(b)));
      o[j + 3] = d[j + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function sharpen(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const a = Math.max(0, Math.min(5, amount));
  if (a === 0) return src;
  return convolve(src, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]);
}

function vignette(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const k = Math.max(0, Math.min(100, strength)) / 100;
  if (k === 0) return c;
  const r = Math.hypot(c.width, c.height) / 2;
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, r * 0.35, c.width / 2, c.height / 2, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(0.9 * k).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function rotate(src: HTMLCanvasElement, angle: number): HTMLCanvasElement {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  if (a === 0) return src;
  const swap = a === 90 || a === 270;
  const [c, ctx] = canvasOf(swap ? src.height : src.width, swap ? src.width : src.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((a * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

function flip(src: HTMLCanvasElement, axis: string): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  if (axis === "vertical") {
    ctx.translate(0, c.height);
    ctx.scale(1, -1);
  } else {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0);
  return c;
}

function resize(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvasOf(Math.max(1, Math.min(20000, Math.round(w))), Math.max(1, Math.min(20000, Math.round(h))));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const ANCHOR_POS: Record<string, [number, number]> = {
  topleft: [0, 0], top: [0.5, 0], topright: [1, 0],
  left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5],
  bottomleft: [0, 1], bottom: [0.5, 1], bottomright: [1, 1],
};

function resizeCanvas(src: HTMLCanvasElement, w: number, h: number, anchor: string, bg: string): HTMLCanvasElement {
  const tw = Math.max(1, Math.min(20000, Math.round(w)));
  const th = Math.max(1, Math.min(20000, Math.round(h)));
  const [ax, ay] = ANCHOR_POS[String(anchor).toLowerCase()] ?? [0.5, 0.5];
  const [c, ctx] = canvasOf(tw, th);
  ctx.fillStyle = typeof bg === "string" && bg ? bg : "#1C1B1A";
  ctx.fillRect(0, 0, tw, th);
  const ox = Math.round((tw - src.width) * ax);
  const oy = Math.round((th - src.height) * ay);
  const sx = Math.max(0, -ox);
  const sy = Math.max(0, -oy);
  const dx = Math.max(0, ox);
  const dy = Math.max(0, oy);
  const dw = Math.min(src.width - sx, tw - dx);
  const dh = Math.min(src.height - sy, th - dy);
  if (dw > 0 && dh > 0) ctx.drawImage(src, sx, sy, dw, dh, dx, dy, dw, dh);
  return c;
}

/** Auto Enhance حقيقي: تمديد تباين per-channel عند 1%/99% percentiles. */
function autoEnhance(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const n = c.width * c.height;
  const hist: number[][] = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)];
  for (let i = 0; i < d.length; i += 4) {
    hist[0][d[i]]++;
    hist[1][d[i + 1]]++;
    hist[2][d[i + 2]]++;
  }
  const lo = [0, 0, 0];
  const hi = [255, 255, 255];
  for (let ch = 0; ch < 3; ch++) {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[ch][v];
      if (acc >= n * 0.01) { lo[ch] = v; break; }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[ch][v];
      if (acc >= n * 0.01) { hi[ch] = v; break; }
    }
    if (hi[ch] - lo[ch] < 8) { lo[ch] = 0; hi[ch] = 255; }
  }
  for (let i = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = d[i + ch];
      d[i + ch] = Math.max(0, Math.min(255, Math.round(((v - lo[ch]) * 255) / (hi[ch] - lo[ch]))));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ── إزالة الخلفية العصبية (u2netp + onnxruntime-web) ──
 * U²-Netp (~4.5MB، Apache-2.0) مستضاف محلياً في public/models — كشف كائنات
 * بارزة يناسب صور المنتجات، يعمل أوفلاين بالكامل عبر WASM.
 * المعالجة المسبقة/اللاحقة مطابقة لمرجع rembg: 320×320 وتطبيع ImageNet. */
const U2NET_MODEL = "/models/u2netp.onnx";
const U2NET_SIZE = 320;
const U2NET_MEAN = [0.485, 0.456, 0.406];
const U2NET_STD = [0.229, 0.224, 0.225];
// ملفات تشغيل ORT من CDN — الروابط الخارجية لا يلمسها Vite (مسار /public/?import يرجع index.html).
// النموذج نفسه (u2netp.onnx) مستضاف محلياً — بلا اعتماد على huggingface.
const ORT_WASM_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";
type OrtValue = { data: Float32Array; dims: number[] };
type OrtSession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtValue>>;
  inputNames: readonly string[];
  outputNames: readonly string[];
};
type OrtModule = {
  InferenceSession: { create: (path: string, opts?: Record<string, unknown>) => Promise<OrtSession> };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  env: { wasm: { wasmPaths: string | { mjs: string; wasm: string } } };
};

let ortSessionPromise: Promise<OrtSession> | null = null;

async function loadNeuralSession(): Promise<{ session: OrtSession; ort: OrtModule }> {
  if (!ortSessionPromise) {
    ortSessionPromise = (async () => {
      const ort = (await import("onnxruntime-web")) as unknown as OrtModule;
      ort.env.wasm.wasmPaths = ORT_WASM_CDN;
      return await ort.InferenceSession.create(U2NET_MODEL, { executionProviders: ["wasm"] });
    })();
    // فشل التحميل لا يُقفل المسار العصبي — تُعاد المحاولة في النداء التالي.
    ortSessionPromise.catch(() => {
      ortSessionPromise = null;
    });
  }
  const ort = (await import("onnxruntime-web")) as unknown as OrtModule;
  return { session: await ortSessionPromise, ort };
}

/** إزالة خلفية عصبية: u2netp يقنّع الكائن البارز، والقناع يُطبَّق على ألفا الصورة.
 * anchor: نسبة نقرة المستخدم (0..1) — إن وُجدت يُبقى مكوّنها حصرًا مع المكوّنات
 * الموثوقة، فلا تنجو بقايا الانعكاسات الكبيرة مهما بلغ حجمها. */
async function removeBackgroundNeural(
  src: HTMLCanvasElement,
  anchor?: { ax: number; ay: number },
): Promise<HTMLCanvasElement> {
  const { session, ort } = await loadNeuralSession();

  // معالجة مسبقة: 320×320، CHW، تطبيع ImageNet
  const [small, sctx] = canvasOf(U2NET_SIZE, U2NET_SIZE);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(src, 0, 0, U2NET_SIZE, U2NET_SIZE);
  const sd = sctx.getImageData(0, 0, U2NET_SIZE, U2NET_SIZE).data;
  const plane = U2NET_SIZE * U2NET_SIZE;
  const input = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    input[p] = (sd[p * 4] / 255 - U2NET_MEAN[0]) / U2NET_STD[0];
    input[plane + p] = (sd[p * 4 + 1] / 255 - U2NET_MEAN[1]) / U2NET_STD[1];
    input[2 * plane + p] = (sd[p * 4 + 2] / 255 - U2NET_MEAN[2]) / U2NET_STD[2];
  }

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const feeds: Record<string, unknown> = {
    [inputName]: new ort.Tensor("float32", input, [1, 3, U2NET_SIZE, U2NET_SIZE]),
  };
  const results = await session.run(feeds);
  const out = results[outputName] ?? Object.values(results)[0];
  if (!out || !out.data || out.data.length === 0) {
    throw new Error("segmentation returned no usable mask");
  }
  const od = out.data;
  const ow = out.dims[out.dims.length - 1];
  const oh = out.dims[out.dims.length - 2];
  const n = ow * oh;

  // مخرج d0 بعد السيجمويد: تطبيع min-max إلى 0..255 (عرف rembg)
  let mn = 1;
  let mx = 0;
  for (let p = 0; p < n; p++) {
    const v = od[p];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = Math.max(1e-6, mx - mn);
  // فلتر ثقة: قناع موضوع حقيقي تباينه واسع؛ هلوسة التدرجات مداها ضيق — نرفضها.
  if (mx - mn < 0.35) {
    throw new Error("No clear subject found — nothing to remove");
  }
  const vals = new Uint8ClampedArray(n);
  let keep = 0;
  for (let p = 0; p < n; p++) {
    const v = Math.round(((od[p] - mn) / range) * 255);
    vals[p] = v;
    if (v > 127) keep++;
  }
  const keepRatio = keep / n;
  // خلفية مجردة بلا موضوع واضح: نرفض بدل إنتاج نتيجة مضلِّلة.
  if (keepRatio < 0.02 || keepRatio > 0.98) {
    throw new Error("No clear subject found — nothing to remove");
  }

  // تنقية 1: حذف البقع الشاردة والانعكاسات (دقة القناع 320 تُنتجها كثيرًا).
  // مع نقرة المستخدم: المكوّن المُنقر هو الموضوع — يُبقى هو وموثوقاته فقط.
  if (anchor) {
    keepAnchorMaskComponents(vals, ow, oh, anchor.ax * ow, anchor.ay * oh);
  } else {
    keepMajorMaskComponents(vals, ow, oh);
  }

  const [mc, mctx] = canvasOf(ow, oh);
  const mimg = mctx.createImageData(ow, oh);
  for (let p = 0; p < n; p++) {
    const v = vals[p];
    mimg.data[p * 4] = v;
    mimg.data[p * 4 + 1] = v;
    mimg.data[p * 4 + 2] = v;
    mimg.data[p * 4 + 3] = 255;
  }
  mctx.putImageData(mimg, 0, 0);

  // تكبير القناع بحواف ناعمة ثم ضربه في قناة الألفا
  const W = src.width;
  const H = src.height;
  const [big, bctx] = canvasOf(W, H);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(mc, 0, 0, W, H);
  const maskAlpha = bctx.getImageData(0, 0, W, H).data;

  // تنقية 2: منحنى الثقة + تآكل تكيفي + ريشة — التآكل يُلغى تلقائيًا للموضوعات
  // الناعمة (زجاج/شفاف) حيث نسبة البكسلات الوسطية عالية، كي لا تُؤكل الحواف الرقيقة.
  const softness = maskSoftnessRatio(vals, n);
  const radii = refineRadii(Math.min(W, H));
  const erode = softness > 0.25 ? 0 : radii.erode;
  const refined = new Uint8ClampedArray(W * H);
  for (let p = 0; p < W * H; p++) refined[p] = sharpenAlpha(maskAlpha[p * 4]);
  erodeAlpha(refined, W, H, erode);
  featherAlpha(refined, W, H, radii.feather);
  for (let p = 0; p < W * H; p++) {
    const v = refined[p];
    maskAlpha[p * 4] = v;
    maskAlpha[p * 4 + 1] = v;
    maskAlpha[p * 4 + 2] = v;
  }

  const [outC, octx] = canvasOf(W, H);
  octx.drawImage(src, 0, 0);
  const img = octx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = Math.round((d[i + 3] * maskAlpha[i]) / 255);
  }
  octx.putImageData(img, 0, 0);
  return outC;
}

/** إزالة الخلفية الذكية: العصبية أولاً، والكلاسيكية احتياط. */
async function removeBackgroundSmart(
  src: HTMLCanvasElement,
  anchor?: { ax: number; ay: number },
): Promise<HTMLCanvasElement> {
  try {
    return await removeBackgroundNeural(src, anchor);
  } catch {
    return removeBackgroundClassic(src);
  }
}

/** إزالة خلفية كلاسيكية (احتياطية): region-growing من الحواف + تنعيم. تعمل بلا سيرفر. */
function removeBackgroundClassic(src: HTMLCanvasElement): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const MAXS = 640;
  const s = Math.min(1, MAXS / Math.max(W, H));
  const sw = Math.max(8, Math.round(W * s));
  const sh = Math.max(8, Math.round(H * s));
  const [small, sctx] = canvasOf(sw, sh);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(src, 0, 0, sw, sh);
  const sd = sctx.getImageData(0, 0, sw, sh).data;

  // متوسط لون الحواف كمرجع للخلفية
  let br = 0;
  let bg = 0;
  let bb = 0;
  let bn = 0;
  const edge = (x: number, y: number) => {
    const i = (y * sw + x) * 4;
    br += sd[i]; bg += sd[i + 1]; bb += sd[i + 2]; bn++;
  };
  for (let x = 0; x < sw; x++) { edge(x, 0); edge(x, sh - 1); }
  for (let y = 1; y < sh - 1; y++) { edge(0, y); edge(sw - 1, y); }
  br /= bn; bg /= bn; bb /= bn;

  const TOL = 60;
  const isBg = (i: number) => {
    const dr = sd[i] - br;
    const dg = sd[i + 1] - bg;
    const db = sd[i + 2] - bb;
    return dr * dr + dg * dg + db * db < TOL * TOL;
  };

  // BFS من الحواف عبر البكسلات المرشحة فقط
  const seen = new Uint8Array(sw * sh);
  const queue: number[] = [];
  for (let x = 0; x < sw; x++) {
    if (isBg(x * 4)) { seen[x] = 1; queue.push(x); }
    const b = (sh - 1) * sw + x;
    if (isBg(b * 4) && !seen[b]) { seen[b] = 1; queue.push(b); }
  }
  for (let y = 1; y < sh - 1; y++) {
    const l = y * sw;
    if (isBg(l * 4) && !seen[l]) { seen[l] = 1; queue.push(l); }
    const r = y * sw + sw - 1;
    if (isBg(r * 4) && !seen[r]) { seen[r] = 1; queue.push(r); }
  }
  let qi = 0;
  while (qi < queue.length) {
    const p = queue[qi++];
    const px = p % sw;
    const py = (p / sw) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const q = ny * sw + nx;
      if (seen[q]) continue;
      if (!isBg(q * 4)) continue;
      seen[q] = 1;
      queue.push(q);
    }
  }

  let fgCount = 0;
  for (let p = 0; p < sw * sh; p++) if (!seen[p]) fgCount++;
  const ratio = fgCount / (sw * sh);

  const [maskC, mctx] = canvasOf(sw, sh);
  if (ratio < 0.02 || ratio > 0.98) {
    // لا موضوع واضح: خطأ صريح بدل قناع دائري مضلِّل.
    throw new Error("No clear subject found — background removal needs a distinct subject");
  }
  const mimg = mctx.createImageData(sw, sh);
  {
    const md = mimg.data;
    // تنقية: حذف جزر المقدمة الشاردة قبل التكبير (رخيصة التكلفة بدقة العمل المصغّرة)
    const packed = new Uint8ClampedArray(sw * sh);
    for (let p = 0; p < sw * sh; p++) packed[p] = seen[p] ? 0 : 255;
    keepMajorMaskComponents(packed, sw, sh);
    for (let p = 0; p < sw * sh; p++) {
      const v = packed[p];
      md[p * 4] = v; md[p * 4 + 1] = v; md[p * 4 + 2] = v; md[p * 4 + 3] = 255;
    }
    mctx.putImageData(mimg, 0, 0);
  }

  // تكبير ناعم للقناع ثم تنقية الحواف (تآكل يزيل الهالة + ريشة) قبل تطبيق الألفا
  const [big, bctx] = canvasOf(W, H);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(maskC, 0, 0, W, H);
  const maskAlpha = bctx.getImageData(0, 0, W, H).data;
  {
    const { erode, feather } = refineRadii(Math.min(W, H));
    const refined = new Uint8ClampedArray(W * H);
    for (let p = 0; p < W * H; p++) refined[p] = maskAlpha[p * 4];
    erodeAlpha(refined, W, H, erode);
    featherAlpha(refined, W, H, feather);
    for (let p = 0; p < W * H; p++) {
      const v = refined[p];
      maskAlpha[p * 4] = v;
      maskAlpha[p * 4 + 1] = v;
      maskAlpha[p * 4 + 2] = v;
    }
  }

  const [c, ctx] = canvasOf(W, H);
  ctx.drawImage(src, 0, 0);
  const out = ctx.getImageData(0, 0, W, H);
  const od = out.data;
  for (let i = 0; i < od.length; i += 4) {
    od[i + 3] = Math.round((od[i + 3] * maskAlpha[i]) / 255);
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

/** Inpaint محلي محسّن: توسيع قناع + ملء بالوسيط من 8 جيران + مزج حواف.
 *  يقلل التشوه والضبابية مقارنة بالمتوسط البسيط من 4 جيران. */
async function removeObject(src: HTMLCanvasElement, maskUrl: string): Promise<HTMLCanvasElement> {
  const maskImg = await loadImg(maskUrl);
  const [mc, mctx] = canvasOf(src.width, src.height);
  mctx.imageSmoothingEnabled = false;
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, mc.width, mc.height);
  mctx.drawImage(maskImg, 0, 0, mc.width, mc.height);
  const md = mctx.getImageData(0, 0, mc.width, mc.height).data;

  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const W = c.width;
  const H = c.height;

  const unknown = new Uint8Array(W * H);
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let p = 0; p < W * H; p++) {
    if (md[p * 4] > 110) {
      unknown[p] = 1;
      const x = p % W;
      const y = (p / W) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return c;
  // توسيع القناع 3px لابتلاع هالة الحواف (سبب التشوه الأشهر)
  {
    const copy = unknown.slice();
    const R = 3;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!copy[y * W + x]) continue;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > R * R + 2) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            unknown[ny * W + nx] = 1;
          }
        }
      }
    }
    minX = Math.max(0, minX - R - 2);
    minY = Math.max(0, minY - R - 2);
    maxX = Math.min(W - 1, maxX + R + 2);
    maxY = Math.min(H - 1, maxY + R + 2);
  }
  const M = 64;
  minX = Math.max(0, minX - M);
  minY = Math.max(0, minY - M);
  maxX = Math.min(W - 1, maxX + M);
  maxY = Math.min(H - 1, maxY + M);

  // نسخة أصلية للدمج النهائي للحواف
  const orig = new Uint8ClampedArray(d);
  const filledMask = new Uint8Array(W * H); // 1 = عولج بـinpaint

  let remaining = 0;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (unknown[y * W + x]) remaining++;

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  let guard = 0;
  while (remaining > 0 && guard++ < 900) {
    let filled = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = y * W + x;
        if (!unknown[p]) continue;
        const rs: number[] = [];
        const gs: number[] = [];
        const bs: number[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < minX || ny < minY || nx > maxX || ny > maxY) continue;
            const q = ny * W + nx;
            if (unknown[q]) continue;
            const i = q * 4;
            rs.push(d[i]);
            gs.push(d[i + 1]);
            bs.push(d[i + 2]);
          }
        }
        if (rs.length >= 3) {
          const j = p * 4;
          d[j] = median(rs);
          d[j + 1] = median(gs);
          d[j + 2] = median(bs);
          unknown[p] = 0;
          filledMask[p] = 1;
          filled++;
        }
      }
    }
    if (filled === 0) break;
    remaining -= filled;
  }
  if (remaining > 0) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = y * W + x;
        if (!unknown[p]) { r += d[p * 4]; g += d[p * 4 + 1]; b += d[p * 4 + 2]; n++; }
      }
    }
    r = Math.round(r / Math.max(1, n));
    g = Math.round(g / Math.max(1, n));
    b = Math.round(b / Math.max(1, n));
    for (let p = 0; p < W * H; p++) {
      if (unknown[p]) { d[p * 4] = r; d[p * 4 + 1] = g; d[p * 4 + 2] = b; filledMask[p] = 1; }
    }
  }
  // مزج حواف 2px مع الأصل لإخفاء حلقة الدمج (يُبقي الداخل صرفاً من Inpaint)
  for (let y = Math.max(1, minY); y <= Math.min(H - 2, maxY); y++) {
    for (let x = Math.max(1, minX); x <= Math.min(W - 2, maxX); x++) {
      const p = y * W + x;
      if (!filledMask[p]) continue;
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const q = (y + dy) * W + (x + dx);
          if (!filledMask[q]) { edge = true; break; }
        }
      }
      if (edge) {
        const j = p * 4;
        d[j] = Math.round(d[j] * 0.72 + orig[j] * 0.28);
        d[j + 1] = Math.round(d[j + 1] * 0.72 + orig[j + 1] * 0.28);
        d[j + 2] = Math.round(d[j + 2] * 0.72 + orig[j + 2] * 0.28);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** تحسين احترافي محلي: توازن أبيض + تمديد تباين + حيوية + حدة — نسخة خفيفة من pro_enhance. */
function proEnhance(src: HTMLCanvasElement, strengthPct: number): HTMLCanvasElement {
  const k = Math.max(0, Math.min(100, strengthPct)) / 100;
  if (k <= 0) return src;
  // 1) توازن أبيض Gray-World جزئي
  let cur = src;
  {
    const [c, ctx] = canvasOf(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; }
    sr /= n; sg /= n; sb /= n;
    const gray = (sr + sg + sb) / 3 || 1;
    const gr = Math.max(0.9, Math.min(1.1, 1 + ((gray / Math.max(sr, 1)) - 1) * 0.5 * k));
    const gg = Math.max(0.9, Math.min(1.1, 1 + ((gray / Math.max(sg, 1)) - 1) * 0.5 * k));
    const gb = Math.max(0.9, Math.min(1.1, 1 + ((gray / Math.max(sb, 1)) - 1) * 0.5 * k));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, d[i] * gr));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * gg));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * gb));
    }
    ctx.putImageData(img, 0, 0);
    cur = c;
  }
  // 2) تمديد تباين (نفس autoEnhance)
  cur = autoEnhance(cur);
  // 3) تشبع حيوي عبر CSS filter (للألوان الباهتة تأثير أكبر بصرياً)
  {
    const tmp = document.createElement("canvas");
    tmp.width = cur.width;
    tmp.height = cur.height;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    if (tctx) {
      tctx.filter = `saturate(${(1 + 0.28 * k).toFixed(3)}) contrast(${(1 + 0.07 * k).toFixed(3)}) brightness(${(1 + 0.03 * k).toFixed(3)})`;
      tctx.drawImage(cur, 0, 0);
      tctx.filter = "none";
      cur = tmp;
    }
  }
  // 4) حدة تكيفية خفيفة
  if (k > 0.1) cur = sharpen(cur, 0.35 + 0.9 * k);
  return cur;
}

/** دمج محلي: مزج ألفا ناعم مع مطابقة سطوع بسيطة — يعمل بلا سيرفر. */
async function blendLocal(src: HTMLCanvasElement, params: Record<string, number | string>): Promise<HTMLCanvasElement> {
  const fgParam = params.foreground;
  if (typeof fgParam !== "string" || !fgParam) throw new Error("foreground is required");
  const fgImg = await loadImg(fgParam);
  const W = src.width;
  const H = src.height;
  const scalePct = Math.max(5, Math.min(100, num(params.scale, 40)));
  const cxPct = Math.max(0, Math.min(100, num(params.x, 50)));
  const cyPct = Math.max(0, Math.min(100, num(params.y, 50)));
  const feather = Math.max(0, Math.min(80, Math.round(num(params.feather, 12))));
  const fw = Math.max(8, Math.round((W * scalePct) / 100));
  const fh = Math.max(8, Math.round((fgImg.naturalHeight / Math.max(1, fgImg.naturalWidth)) * fw));
  const cx = Math.round((W * cxPct) / 100);
  const cy = Math.round((H * cyPct) / 100);
  const x0 = Math.max(0, Math.min(W - fw, cx - (fw >> 1)));
  const y0 = Math.max(0, Math.min(H - fh, cy - (fh >> 1)));
  // مطابقة سطوع بسيطة: فرق متوسط الإضاءة بين المنطقتين
  const [base, bctx] = canvasOf(W, H);
  bctx.drawImage(src, 0, 0);
  const [fgC, fctx] = canvasOf(fw, fh);
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(fgImg, 0, 0, fw, fh);
  try {
    const bgData = bctx.getImageData(x0, y0, Math.min(fw, W - x0), Math.min(fh, H - y0)).data;
    const fgData = fctx.getImageData(0, 0, fw, fh).data;
    let bL = 0;
    let fL = 0;
    let bn = 0;
    let fn = 0;
    for (let i = 0; i < bgData.length; i += 16) { bL += (bgData[i] + bgData[i + 1] + bgData[i + 2]) / 3; bn++; }
    for (let i = 0; i < fgData.length; i += 16) { fL += (fgData[i] + fgData[i + 1] + fgData[i + 2]) / 3; fn++; }
    bL /= Math.max(1, bn); fL /= Math.max(1, fn);
    const diff = Math.max(-28, Math.min(28, (bL - fL) * 0.55));
    if (Math.abs(diff) > 1.5) {
      const img = fctx.getImageData(0, 0, fw, fh);
      const dd = img.data;
      for (let i = 0; i < dd.length; i += 4) {
        dd[i] = Math.max(0, Math.min(255, dd[i] + diff));
        dd[i + 1] = Math.max(0, Math.min(255, dd[i + 1] + diff));
        dd[i + 2] = Math.max(0, Math.min(255, dd[i + 2] + diff));
      }
      fctx.putImageData(img, 0, 0);
    }
  } catch { /* تجاهل — الدمج يكمل */ }
  // قناع ناعم للحواف
  const [mC, mctx] = canvasOf(fw, fh);
  mctx.fillStyle = "#fff";
  mctx.fillRect(0, 0, fw, fh);
  if (feather > 0) {
    mctx.strokeStyle = "#000";
    mctx.lineWidth = Math.min(feather * 2, Math.min(fw, fh) - 2);
    mctx.strokeRect(0, 0, fw, fh);
    try {
      (mctx as CanvasRenderingContext2D).filter = `blur(${Math.min(24, feather)}px)`;
      mctx.drawImage(mC, 0, 0);
      (mctx as CanvasRenderingContext2D).filter = "none";
    } catch { /* تجاهل */ }
  }
  const out = base;
  const octx = out.getContext("2d", { willReadFrequently: true });
  if (!octx) return base;
  octx.save();
  octx.drawImage(fgC, x0, y0);
  // تطبيق القناع الناعم عبر globalCompositeOperation على نسخة ثم دمج
  try {
    const tmp = document.createElement("canvas");
    tmp.width = fw; tmp.height = fh;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.drawImage(fgC, 0, 0);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(mC, 0, 0);
      octx.clearRect(x0, y0, fw, fh);
      // أعد رسم الخلفية الأصلية في المنطقة ثم الأمامية المقنعة
      octx.drawImage(src, x0, y0, fw, fh, x0, y0, fw, fh);
      octx.drawImage(tmp, x0, y0);
    }
  } catch { octx.drawImage(fgC, x0, y0); }
  octx.restore();
  return out;
}

function num(v: unknown, def: number): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : def;
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

function pixelLoop(
  src: HTMLCanvasElement,
  fn: (r: number, g: number, b: number, x: number, y: number) => [number, number, number]
): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const [r, g, b] = fn(d[i], d[i + 1], d[i + 2], x, y);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function blurCanvas(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  if (px <= 0) return src;
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.filter = `blur(${px.toFixed(2)}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = "none";
  return c;
}

function motionBlur(src: HTMLCanvasElement, size: number, angleDeg: number): HTMLCanvasElement {
  const R = Math.max(1, Math.min(25, size / 2));
  const rad = ((angleDeg % 180) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.globalAlpha = 1 / 7;
  for (let k = -3; k <= 3; k++) {
    ctx.drawImage(src, (dx * R * k) / 3, (dy * R * k) / 3);
  }
  ctx.globalAlpha = 1;
  return c;
}

function radialBlur(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const s = Math.max(0, Math.min(100, strength));
  if (s <= 0) return src;
  const samples = 6;
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.globalAlpha = 1 / samples;
  for (let i = 0; i < samples; i++) {
    const z = 1 + ((s / 100) * 0.25 * i) / (samples - 1);
    const w2 = src.width * z;
    const h2 = src.height * z;
    ctx.drawImage(src, (src.width - w2) / 2, (src.height - h2) / 2, w2, h2);
  }
  ctx.globalAlpha = 1;
  return c;
}

function pixelateLocal(src: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const s = Math.max(2, Math.min(64, Math.round(size)));
  const tw = Math.max(1, Math.floor(src.width / s));
  const th = Math.max(1, Math.floor(src.height / s));
  const tiny = document.createElement("canvas");
  tiny.width = tw;
  tiny.height = th;
  const tctx = tiny.getContext("2d");
  if (!tctx) return src;
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(src, 0, 0, tw, th);
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, src.width, src.height);
  return c;
}

function grainLocal(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const a = Math.max(0, Math.min(100, amount));
  if (a <= 0) return src;
  const sigma = a * 0.9;
  return pixelLoop(src, (r, g, b) => {
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * sigma;
    return [clamp255(r + n), clamp255(g + n), clamp255(b + n)];
  });
}

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function glitchLocal(src: HTMLCanvasElement, shift: number, slices: number, seed: number): HTMLCanvasElement {
  const sh = Math.max(0, Math.min(60, Math.round(shift)));
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const base = c.getContext("2d", { willReadFrequently: true });
  if (!base) return src;
  const data = base.getImageData(0, 0, src.width, src.height);
  const d = data.data;
  const W = src.width;
  const H = src.height;
  const rnd = lcg(Math.round(seed));
  const out = base.createImageData(W, H);
  const o = out.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const xr = Math.min(W - 1, Math.max(0, x + sh));
      const xb = Math.min(W - 1, Math.max(0, x - sh));
      o[i] = d[(y * W + xr) * 4];
      o[i + 1] = d[i + 1];
      o[i + 2] = d[(y * W + xb) * 4 + 2];
      o[i + 3] = d[i + 3];
    }
  }
  base.putImageData(out, 0, 0);
  const [snapC, snapCtx] = canvasOf(W, H);
  snapCtx.drawImage(c, 0, 0);
  const bands = Math.max(2, Math.min(12, Math.round(slices)));
  const edges: number[] = [0];
  for (let k = 0; k < bands; k++) edges.push(Math.floor(rnd() * H));
  edges.push(H);
  edges.sort((p, q) => p - q);
  for (let k = 0; k < edges.length - 1; k++) {
    const y0 = edges[k];
    const y1 = edges[k + 1];
    if (y1 <= y0) continue;
    const off = Math.floor(rnd() * (sh * 4 + 1)) - sh * 2;
    if (off) base.drawImage(snapC, 0, y0, W, y1 - y0, off, y0, W, y1 - y0);
  }
  return c;
}

function styleLocal(src: HTMLCanvasElement, name: string): HTMLCanvasElement {
  const n = name.toLowerCase();
  if (n === "warm") return pixelLoop(src, (r, g, b) => [clamp255(r + 18), g, clamp255(b - 18)]);
  if (n === "cold") return pixelLoop(src, (r, g, b) => [clamp255(r - 16), g, clamp255(b + 22)]);
  if (n === "noir") {
    return pixelLoop(src, (r, g, b) => {
      const v = clamp255(((r + g + b) / 3 - 127.5) * 1.35 + 127.5);
      return [v, v, v];
    });
  }
  if (n === "faded") return pixelLoop(src, (r, g, b) => [clamp255(r * 0.85 + 40), clamp255(g * 0.85 + 30), clamp255(b * 0.85 + 30)]);
  if (n === "vivid") return pixelLoop(src, (r, g, b) => [clamp255((r - 127.5) * 1.12 + 127.5), clamp255((g - 127.5) * 1.12 + 127.5), clamp255((b - 127.5) * 1.12 + 127.5)]);
  if (n === "cinematic") {
    return pixelLoop(src, (r, g, b) => {
      const lum = (r + g + b) / 3 / 255;
      const nr = clamp255(((r + (lum - 0.5) * 44 + 6 - 127.5) * 1.08 + 127.5));
      const nb = clamp255(b - (lum - 0.5) * 30 + 8);
      return [nr, g, nb];
    });
  }
  throw new Error(`unknown style: ${name}`);
}

export interface LocalResult {
  url: string;
  width: number;
  height: number;
}

function clamp100(v: unknown): number {
  return Math.max(-100, Math.min(100, num(v, 0)));
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, mx === 0 ? 0 : d / mx, mx];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return [clamp255((rp + m) * 255), clamp255((gp + m) * 255), clamp255((bp + m) * 255)];
}

function colorBalanceLocal(src: HTMLCanvasElement, params: Record<string, number | string>): HTMLCanvasElement {
  const ranges = ["shadows", "midtones", "highlights"] as const;
  const cfg = ranges.map((p) => ({
    cr: clamp100(params[`${p}_cyan_red`]),
    mg: clamp100(params[`${p}_magenta_green`]),
    yb: clamp100(params[`${p}_yellow_blue`]),
  }));
  if (cfg.every((c) => c.cr === 0 && c.mg === 0 && c.yb === 0)) return src;
  return pixelLoop(src, (r, g, b) => {
    const lum = (r + g + b) / 3 / 255;
    const masks = [(1 - lum) ** 2, 4 * lum * (1 - lum), lum ** 2];
    let dr = 0;
    let dg = 0;
    let db = 0;
    for (let k = 0; k < 3; k++) {
      const m = masks[k];
      if (m <= 0) continue;
      const da = ((cfg[k].cr + cfg[k].mg) / 100) * m * 25;
      const dyb = (cfg[k].yb / 100) * m * 25;
      dr += da / 2 + dyb / 4;
      dg += -da / 2 + dyb / 4;
      db += -dyb / 2;
    }
    return [clamp255(r + dr), clamp255(g + dg), clamp255(b + db)];
  });
}

function vibranceLocal(src: HTMLCanvasElement, params: Record<string, number | string>): HTMLCanvasElement {
  const amount = clamp100(params.amount);
  if (amount === 0) return src;
  return pixelLoop(src, (r, g, b) => {
    const [h, s, v] = rgbToHsv(r, g, b);
    let boost = (1 - s) * (amount / 100) * 0.5;
    const skin = (h < 60 || h > 330) && s < 0.6 && v > 0.2;
    if (skin) boost *= 0.25;
    const ns = Math.max(0, Math.min(1, s + boost));
    return hsvToRgb(h, ns, v);
  });
}

function channelMask(channel: unknown): [boolean, boolean, boolean] {
  const c = String(channel ?? "rgb").toLowerCase();
  if (c === "r") return [true, false, false];
  if (c === "g") return [false, true, false];
  if (c === "b") return [false, false, true];
  return [true, true, true];
}

function levelsLUT(shadows: number, gamma: number, highlights: number, outMin: number, outMax: number): Uint8Array {
  const lut = new Uint8Array(256);
  const span = Math.max(1, highlights - shadows);
  for (let i = 0; i < 256; i++) {
    let v = ((i - shadows) / span) * 255;
    v = Math.max(0, Math.min(255, v));
    v = 255 * Math.pow(v / 255, gamma);
    v = outMin + (v / 255) * (outMax - outMin);
    lut[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return lut;
}

function levelsLocal(src: HTMLCanvasElement, params: Record<string, number | string>): HTMLCanvasElement {
  const shadows = Math.max(0, Math.min(255, Math.round(num(params.shadows, 0))));
  let highlights = Math.max(0, Math.min(255, Math.round(num(params.highlights, 255))));
  const gamma = Math.max(0.1, Math.min(10, num(params.gamma ?? params.midtones, 1)));
  const outMin = Math.max(0, Math.min(255, Math.round(num(params.output_min, 0))));
  const outMax = Math.max(0, Math.min(255, Math.round(num(params.output_max, 255))));
  if (highlights <= shadows) highlights = Math.min(255, shadows + 1);
  const lut = levelsLUT(shadows, gamma, highlights, outMin, outMax);
  const [useR, useG, useB] = channelMask(params.channel);
  return pixelLoop(src, (r, g, b) => [useR ? lut[r] : r, useG ? lut[g] : g, useB ? lut[b] : b]);
}

interface CurvePt {
  x: number;
  y: number;
}

function parseCurvePoints(raw: unknown): CurvePt[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      throw new Error("invalid curve points");
    }
  }
  if (!Array.isArray(arr) || arr.length < 2) throw new Error("curves needs at least 2 points");
  const pts: CurvePt[] = (arr as Array<{ x?: unknown; y?: unknown }>)
    .map((p) => ({
      x: Math.max(0, Math.min(255, Number(p?.x ?? 0))),
      y: Math.max(0, Math.min(255, Number(p?.y ?? 0))),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  const dedup: CurvePt[] = [];
  for (const p of pts) {
    if (dedup.length && Math.abs(dedup[dedup.length - 1].x - p.x) < 1e-6) dedup[dedup.length - 1] = p;
    else dedup.push(p);
  }
  if (dedup.length < 2) throw new Error("curves needs at least 2 distinct points");
  return dedup;
}

function splineLUT(pts: CurvePt[]): Uint8Array {
  const n = pts.length;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const lut = new Uint8Array(256);
  if (n === 2) {
    for (let i = 0; i < 256; i++) {
      const t = (i - xs[0]) / Math.max(1e-9, xs[1] - xs[0]);
      lut[i] = Math.max(0, Math.min(255, Math.round(ys[0] + t * (ys[1] - ys[0]))));
    }
    return lut;
  }
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const m = new Array(n).fill(0);
  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }
  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / Math.max(1e-12, l[i]);
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / Math.max(1e-12, l[i]);
  }
  const c = new Array(n).fill(0);
  const b = new Array(n).fill(0);
  const dd = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    dd[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  for (let i = 0; i < 256; i++) {
    let k = n - 2;
    for (let j = 0; j < n - 1; j++) {
      if (i >= xs[j] && i <= xs[j + 1]) { k = j; break; }
    }
    const dx = i - xs[k];
    const y = ys[k] + b[k] * dx + c[k] * dx * dx + dd[k] * dx * dx * dx;
    lut[i] = Math.max(0, Math.min(255, Math.round(y)));
  }
  return lut;
}

function curvesLocal(src: HTMLCanvasElement, params: Record<string, number | string>): HTMLCanvasElement {
  const lut = splineLUT(parseCurvePoints(params.points));
  const [useR, useG, useB] = channelMask(params.channel);
  return pixelLoop(src, (r, g, b) => [useR ? lut[r] : r, useG ? lut[g] : g, useB ? lut[b] : b]);
}

/** تنفيذ عملية واحدة محلياً — يرمي Error عند الفشل. */
export async function applyLocalOp(
  imageUrl: string,
  op: string,
  params: Record<string, number | string>
): Promise<LocalResult> {
  const img = await loadImg(imageUrl);
  const [base, bctx] = canvasOf(img.naturalWidth, img.naturalHeight);
  bctx.drawImage(img, 0, 0);

  let out: HTMLCanvasElement;
  switch (op) {
    case "grayscale":
      out = drawFiltered(img, "grayscale(1)");
      break;
    case "sepia":
      out = drawFiltered(img, "sepia(1)");
      break;
    case "brightness_contrast": {
      const b = Math.max(-100, Math.min(100, num(params.brightness, 0)));
      const ct = Math.max(-100, Math.min(100, num(params.contrast, 0)));
      out = drawFiltered(img, `brightness(${(1 + b / 100).toFixed(3)}) contrast(${(1 + ct / 100).toFixed(3)})`);
      break;
    }
    case "hue_saturation": {
      const h = Math.max(-180, Math.min(180, num(params.hue, 0)));
      const s = Math.max(-100, Math.min(100, num(params.saturation, 0)));
      out = drawFiltered(img, `hue-rotate(${h}deg) saturate(${(1 + s / 100).toFixed(3)})`);
      break;
    }
    case "color_balance":
      out = colorBalanceLocal(base, params);
      break;
    case "vibrance":
      out = vibranceLocal(base, params);
      break;
    case "levels":
      out = levelsLocal(base, params);
      break;
    case "curves":
      out = curvesLocal(base, params);
      break;
    case "adjust": {
      const b = Math.max(-100, Math.min(100, num(params.brightness, 0)));
      const ct = Math.max(-100, Math.min(100, num(params.contrast, 0)));
      const s = Math.max(-100, Math.min(100, num(params.saturation, 0)));
      let tmp = drawFiltered(img, `brightness(${(1 + b / 100).toFixed(3)}) contrast(${(1 + ct / 100).toFixed(3)}) saturate(${(1 + s / 100).toFixed(3)})`);
      const bl = Math.max(0, Math.min(40, num(params.blur, 0)));
      if (bl > 0) tmp = blurCanvas(tmp, bl / 5);
      const tp = Math.max(-100, Math.min(100, num(params.temperature, 0)));
      const hi = Math.max(-100, Math.min(100, num(params.highlights, 0)));
      const shd = Math.max(-100, Math.min(100, num(params.shadows, 0)));
      if (tp !== 0 || hi !== 0 || shd !== 0) {
        tmp = pixelLoop(tmp, (r, g, bl2) => {
          const lum = (r + g + bl2) / 3 / 255;
          let l = lum * 255;
          if (shd !== 0) {
            const dark = Math.pow(Math.max(0, Math.min(1, (0.5 - lum) * 2)), 1.5);
            l += shd * 0.6 * dark;
          }
          if (hi !== 0) {
            const bright = Math.pow(Math.max(0, Math.min(1, (lum - 0.5) * 2)), 1.5);
            l += hi * 0.6 * bright;
          }
          const k = l / Math.max(1, lum * 255);
          return [clamp255(r * k + tp * 0.9), clamp255(g * k), clamp255(bl2 * k - tp * 0.9)];
        });
      }
      const sh = num(params.sharpness, 0);
      if (sh) tmp = sharpen(tmp, sh / 50);
      out = tmp;
      break;
    }
    case "blur":
      out = drawFiltered(img, `blur(${Math.max(0, Math.min(20, num(params.radius, 2)))}px)`);
      break;
    case "sharpen":
      out = sharpen(base, num(params.amount, 1));
      break;
    case "vignette":
      out = vignette(base, num(params.strength, 45));
      break;
    case "auto_enhance":
      out = autoEnhance(base);
      break;
    case "pro_enhance":
      out = proEnhance(base, num(params.strength, 70));
      break;
    case "blend": {
      out = await blendLocal(base, params);
      break;
    }
    case "rotate":
      out = rotate(base, num(params.angle, 90));
      break;
    case "flip":
      out = flip(base, String(params.axis ?? "horizontal"));
      break;
    case "resize":
      out = resize(base, num(params.width, base.width), num(params.height, base.height));
      break;
    case "resize_canvas":
      out = resizeCanvas(base, num(params.width, base.width), num(params.height, base.height), String(params.anchor ?? "center"), String(params.bg ?? "#1C1B1A"));
      break;
    case "upscale": {
      let sc = Math.round(num(params.scale, 2));
      sc = sc === 4 ? 4 : 2;
      out = resize(base, base.width * sc, base.height * sc);
      break;
    }
    case "remove_background": {
      const ax = num(params.ax, -1);
      const ay = num(params.ay, -1);
      const anchor = ax >= 0 && ay >= 0 ? { ax, ay } : undefined;
      out = await removeBackgroundSmart(base, anchor);
      break;
    }
    case "remove_object": {
      const mask = params.mask;
      if (typeof mask !== "string" || !mask) throw new Error("mask is required");
      out = await removeObject(base, mask);
      break;
    }
    case "invert":
      out = pixelLoop(base, (r, g, b) => [255 - r, 255 - g, 255 - b]);
      break;
    case "posterize": {
      const bits = Math.max(1, Math.min(7, Math.round(num(params.bits, 3))));
      const mask = (0xff << (8 - bits)) & 0xff;
      out = pixelLoop(base, (r, g, b) => [r & mask, g & mask, b & mask]);
      break;
    }
    case "solarize": {
      const th = Math.max(0, Math.min(255, Math.round(num(params.threshold, 128))));
      out = pixelLoop(base, (r, g, b) => [r > th ? 255 - r : r, g > th ? 255 - g : g, b > th ? 255 - b : b]);
      break;
    }
    case "threshold": {
      const lv = Math.max(0, Math.min(255, Math.round(num(params.level, 128))));
      out = pixelLoop(base, (r, g, b) => {
        const v = (r + g + b) / 3 > lv ? 255 : 0;
        return [v, v, v];
      });
      break;
    }
    case "motion_blur":
      out = motionBlur(base, Math.max(3, Math.min(51, num(params.size, 15))), num(params.angle, 0));
      break;
    case "radial_blur":
      out = radialBlur(base, Math.max(0, Math.min(100, num(params.strength, 40))));
      break;
    case "pixelate":
      out = pixelateLocal(base, num(params.size, 12));
      break;
    case "denoise":
      out = blurCanvas(base, Math.max(0.4, Math.min(5, num(params.strength, 7) / 4)));
      break;
    case "grain":
      out = grainLocal(base, num(params.amount, 25));
      break;
    case "glitch":
      out = glitchLocal(base, num(params.shift, 18), num(params.slices, 5), num(params.seed, 7));
      break;
    case "style":
      out = styleLocal(base, String(params.name ?? "cinematic"));
      break;
    case "filter": {
      const preset = String(params.preset ?? "blur");
      if (preset === "emboss") out = convolve(base, [-2, -1, 0, -1, 1, 1, 0, 1, 2]);
      else if (preset === "contour") {
        const e = convolve(base, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
        out = pixelLoop(e, (r, g, b) => [255 - r, 255 - g, 255 - b]);
      } else if (preset === "edge_enhance") out = convolve(base, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
      else if (preset === "smooth" || preset === "median") out = blurCanvas(base, 1);
      else if (preset === "sharpen") out = sharpen(base, 1);
      else out = drawFiltered(img, `blur(${Math.max(0, Math.min(20, num(params.radius, 2)))}px)`);
      break;
    }
    default:
      throw new Error(`unsupported local operation: ${op}`);
  }
  return { url: out.toDataURL("image/png"), width: out.width, height: out.height };
}
