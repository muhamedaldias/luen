/* معالجة صور محلية (Offline) داخل المتصفح عبر Canvas 2D.
   تُستخدم تلقائياً عندما لا يوجد imageId (الباكند غير متصل) —
   كل فلاتر القائمة العلوية تعمل دائماً، والباكند يُستخدم عند توفره لجودة أعلى. */

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

/** إزالة خلفية محلية: region-growing من الحواف + تنعيم. تعمل بلا سيرفر. */
function removeBackground(src: HTMLCanvasElement): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const MAXS = 400;
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
  const mimg = mctx.createImageData(sw, sh);
  if (ratio < 0.02 || ratio > 0.98) {
    // تراجع آمن: قطع ناقص مركزي
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, sw, sh);
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.ellipse(sw / 2, sh / 2, sw * 0.38, sh * 0.38, 0, 0, Math.PI * 2);
    mctx.fill();
  } else {
    const md = mimg.data;
    for (let p = 0; p < sw * sh; p++) {
      const v = seen[p] ? 0 : 255;
      md[p * 4] = v; md[p * 4 + 1] = v; md[p * 4 + 2] = v; md[p * 4 + 3] = 255;
    }
    mctx.putImageData(mimg, 0, 0);
  }

  // تكبير ناعم للقناع (feather طبيعي) ثم تطبيقه
  const [big, bctx] = canvasOf(W, H);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(maskC, 0, 0, W, H);
  const maskAlpha = bctx.getImageData(0, 0, W, H).data;

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

export interface LocalResult {
  url: string;
  width: number;
  height: number;
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
    case "adjust": {
      const b = Math.max(-100, Math.min(100, num(params.brightness, 0)));
      const ct = Math.max(-100, Math.min(100, num(params.contrast, 0)));
      const s = Math.max(-100, Math.min(100, num(params.saturation, 0)));
      let tmp = drawFiltered(img, `brightness(${(1 + b / 100).toFixed(3)}) contrast(${(1 + ct / 100).toFixed(3)}) saturate(${(1 + s / 100).toFixed(3)})`);
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
    case "remove_background":
      out = removeBackground(base);
      break;
    case "remove_object": {
      const mask = params.mask;
      if (typeof mask !== "string" || !mask) throw new Error("mask is required");
      out = await removeObject(base, mask);
      break;
    }
    default:
      throw new Error(`unsupported local operation: ${op}`);
  }
  return { url: out.toDataURL("image/png"), width: out.width, height: out.height };
}
