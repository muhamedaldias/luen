import { hexToRgba, type TextLayer } from "./textLayers";
import { loadCleanImage } from "./safeImage";
import type { ImageLayer, ShapeLayer, SolidLayer } from "./layers";
import { effectiveMask, maskUrlToAlphaCanvas, type LayerMask } from "./layers";
import { normBlend, type LayerRef } from "./layerSystem";

/* تصدير مسطّح آمن 100% من التلوّث (taint-free):
 * - لا يستخدم SVG foreignObject أبداً (هو السبب الأول لخطأ
 *   "failed to execute 'toDataURL' ... tainted canvases may not be exported").
 * - كل الرسم يتم عبر Canvas2D مباشرة (نص + صورة + شكل + لون).
 * - تحميل الصور عبر loadCleanImage (بدون crossOrigin للـ data:/blob:/relative).
 */

export interface FlattenOpts {
  imageUrl: string | null;
  width: number;
  height: number;
  textLayers: TextLayer[];
  imageLayers?: ImageLayer[];
  shapeLayers?: ShapeLayer[];
  solidLayers?: SolidLayer[];
  order?: LayerRef[];
}

export async function exportFlattenedDataUrl(opts: FlattenOpts): Promise<string> {
  const { imageUrl, textLayers } = opts;
  const imageLayers = opts.imageLayers ?? [];
  const shapeLayers = opts.shapeLayers ?? [];
  const solidLayers = opts.solidLayers ?? [];
  let W = opts.width;
  let H = opts.height;
  let baseImg: HTMLImageElement | null = null;
  if (imageUrl) {
    try {
      baseImg = await loadCleanImage(imageUrl);
      W = baseImg.naturalWidth || W;
      H = baseImg.naturalHeight || H;
    } catch {
      baseImg = null;
    }
  }
  if (!W || !H) {
    W = 1200;
    H = 800;
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  if (!ctx) throw new Error("no ctx");
  ctx.fillStyle = "#0F0E0D";
  ctx.fillRect(0, 0, W, H);
  if (baseImg) {
    ctx.drawImage(baseImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#1C1B1A";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  const scale = W > 900 ? W / 900 : 1;

  async function drawSolid(s: SolidLayer) {
    if (!s.visible || s.opacity <= 0) return;
    const m = effectiveMask(s);
    if (!m) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity / 100));
      try {
        ctx.globalCompositeOperation = normBlend(s.blendMode) as GlobalCompositeOperation;
      } catch { /* تجاهل */ }
      ctx.fillStyle = s.color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    const buf = makeOffscreen(W, H);
    if (!buf) return;
    const [off, o] = buf;
    o.fillStyle = s.color;
    o.fillRect(0, 0, W, H);
    await destinationInMask(o, m, 0, 0, W, H, 0);
    compositeOffscreen(ctx, s.opacity, s.blendMode, off);
  }

  async function drawImageLayer(l: ImageLayer) {
    if (!l.visible || l.opacity <= 0 || !l.url) return;
    try {
      const img = await loadCleanImage(l.url);
      const dw = l.w * W;
      const dh = l.h * H;
      const dx = l.x * W;
      const dy = l.y * H;
      const m = effectiveMask(l);
      if (!m) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity / 100));
        try {
          ctx.globalCompositeOperation = normBlend(l.blendMode) as GlobalCompositeOperation;
        } catch { /* تجاهل */ }
        if (l.rotation) {
          ctx.translate(dx + dw / 2, dy + dh / 2);
          ctx.rotate((l.rotation * Math.PI) / 180);
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        } else {
          ctx.drawImage(img, dx, dy, dw, dh);
        }
        ctx.restore();
        return;
      }
      const buf = makeOffscreen(W, H);
      if (!buf) return;
      const [off, o] = buf;
      if (l.rotation) {
        o.translate(dx + dw / 2, dy + dh / 2);
        o.rotate((l.rotation * Math.PI) / 180);
        o.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } else {
        o.drawImage(img, dx, dy, dw, dh);
      }
      await destinationInMask(o, m, dx, dy, dw, dh, l.rotation || 0);
      compositeOffscreen(ctx, l.opacity, l.blendMode, off);
    } catch {
      /* طبقة تالفة تُتجاهل — لا تفشل التصدير كله */
    }
  }

  if (opts.order && opts.order.length) {
    const tMap = new Map(textLayers.map((l) => [l.id, l]));
    const iMap = new Map(imageLayers.map((l) => [l.id, l]));
    const sMap = new Map(shapeLayers.map((l) => [l.id, l]));
    const fMap = new Map(solidLayers.map((l) => [l.id, l]));
    for (const ref of opts.order) {
      if (ref.id === "__background__") continue;
      if (ref.kind === "solid") {
        const s = fMap.get(ref.id);
        if (s) await drawSolid(s);
      } else if (ref.kind === "image") {
        const l = iMap.get(ref.id);
        if (l) await drawImageLayer(l);
      } else if (ref.kind === "shape") {
        const s = sMap.get(ref.id);
        if (s && s.visible && s.opacity > 0) await drawShapeCanvas(ctx, W, H, s, scale);
      } else if (ref.kind === "text") {
        const l = tMap.get(ref.id);
        if (l && l.visible) {
          try {
            await drawLayerCanvas(ctx, W, H, l, scale);
          } catch { /* تجاهل */ }
        }
      }
    }
  } else {
    for (const s of solidLayers) await drawSolid(s);
    for (const l of imageLayers) await drawImageLayer(l);
    for (const s of shapeLayers) {
      if (!s.visible || s.opacity <= 0) continue;
      await drawShapeCanvas(ctx, W, H, s, scale);
    }
    const visible = textLayers.filter((l) => l.visible);
    for (const l of visible) {
      try {
        await drawLayerCanvas(ctx, W, H, l, scale);
      } catch {
        /* تجاهل الطبقة التالفة */
      }
    }
  }
  // toDataURL هنا آمن دائماً: كل المصادر نظيفة (data/blob/same-origin CORS-clean)
  // ولا يوجد أي SVG foreignObject.
  try {
    return canvas.toDataURL("image/png");
  } catch (e) {
    throw new Error(
      "Export blocked: canvas is tainted by a cross-origin image without CORS. " +
        "Open the image from file (dataURL) or ensure the server sends Access-Control-Allow-Origin."
    );
  }
}

function makeOffscreen(W: number, H: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  try {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d");
    if (!o) return null;
    return [off, o];
  } catch {
    return null;
  }
}

function compositeOffscreen(
  ctx: CanvasRenderingContext2D,
  layerOpacityPct: number,
  blend: unknown,
  off: HTMLCanvasElement
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, layerOpacityPct / 100));
  try {
    ctx.globalCompositeOperation = normBlend(blend) as GlobalCompositeOperation;
  } catch { /* تجاهل */ }
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

async function destinationInMask(
  o: CanvasRenderingContext2D,
  mask: LayerMask,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  rotationDeg: number
) {
  try {
    const wpx = Math.max(1, Math.round(bw));
    const hpx = Math.max(1, Math.round(bh));
    const alpha = await maskUrlToAlphaCanvas(mask, wpx, hpx);
    if (!alpha) return;
    o.save();
    o.globalCompositeOperation = "destination-in";
    if (rotationDeg) {
      o.translate(bx + bw / 2, by + bh / 2);
      o.rotate((rotationDeg * Math.PI) / 180);
      o.drawImage(alpha, -bw / 2, -bh / 2, bw, bh);
    } else {
      o.drawImage(alpha, bx, by, bw, bh);
    }
    o.restore();
  } catch {
    /* mask failure is ignored — the layer exports unmasked */
  }
}

async function drawShapeCanvas(ctx: CanvasRenderingContext2D, W: number, H: number, s: ShapeLayer, scale: number) {
  const dw = Math.max(1, s.w * W);
  const dh = Math.max(1, s.h * H);
  const dx = s.x * W;
  const dy = s.y * H;
  const m = effectiveMask(s);
  const target = m ? makeOffscreen(W, H) : null;
  const c = target ? target[1] : ctx;
  if (m && !target) return;
  c.save();
  if (!m) {
    c.globalAlpha = Math.max(0, Math.min(1, s.opacity / 100));
    try {
      c.globalCompositeOperation = normBlend(s.blendMode) as GlobalCompositeOperation;
    } catch { /* تجاهل */ }
  }
  c.translate(dx + dw / 2, dy + dh / 2);
  c.rotate(((s.rotation || 0) * Math.PI) / 180);
  c.translate(-dw / 2, -dh / 2);
  const lw = Math.max(0, s.strokeWidth * scale);
  if (s.shape === "ellipse") {
    c.beginPath();
    c.ellipse(dw / 2, dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
    if (s.fillEnabled) {
      c.fillStyle = s.color;
      c.fill();
    }
    if (lw > 0) {
      c.strokeStyle = s.strokeColor;
      c.lineWidth = lw;
      c.stroke();
    }
  } else if (s.shape === "line" || s.shape === "arrow") {
    c.beginPath();
    c.moveTo(0, dh / 2);
    c.lineTo(dw, dh / 2);
    c.strokeStyle = s.strokeWidth > 0 ? s.strokeColor : s.color;
    c.lineWidth = Math.max(1, lw || 3 * scale);
    c.lineCap = "round";
    c.stroke();
    if (s.shape === "arrow") {
      const ah = Math.min(dh, 14 * scale) + 6 * scale;
      const aw = 14 * scale;
      c.beginPath();
      c.moveTo(dw, dh / 2);
      c.lineTo(dw - aw, dh / 2 - ah / 2);
      c.lineTo(dw - aw, dh / 2 + ah / 2);
      c.closePath();
      c.fillStyle = s.strokeWidth > 0 ? s.strokeColor : s.color;
      c.fill();
    }
  } else {
    drawRoundRect(c, 0, 0, dw, dh, Math.min(10 * scale, dw / 4, dh / 4));
    if (s.fillEnabled) {
      c.fillStyle = s.color;
      c.fill();
    }
    if (lw > 0) {
      c.strokeStyle = s.strokeColor;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  c.restore();
  if (m && target) {
    await destinationInMask(target[1], m, dx, dy, dw, dh, s.rotation || 0);
    compositeOffscreen(ctx, s.opacity, s.blendMode, target[0]);
  }
}

async function drawLayerCanvas(ctx: CanvasRenderingContext2D, W: number, H: number, l: TextLayer, scale: number) {
  // انتظار الخطوط قبل القياس لتفادي اختلاف العرض بين المعاينة والتصدير
  try {
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 300))]);
  } catch {
    /* تجاهل */
  }
  const boxW = l.w * W;
  const left = l.x * W;
  const top = l.y * H;
  const pad = l.padding * scale;
  const scaledFont = l.fontSize * scale;
  const m = effectiveMask(l);
  const target = m ? makeOffscreen(W, H) : null;
  if (m && !target) return;
  const c = target ? target[1] : ctx;
  c.save();
  if (!m) {
    c.globalAlpha = l.opacity / 100;
    try {
      c.globalCompositeOperation = normBlend((l as { blendMode?: unknown }).blendMode) as GlobalCompositeOperation;
    } catch { /* تجاهل */ }
  }
  if (l.blur > 0) c.filter = `blur(${l.blur * scale}px)`;
  const cx = left + boxW / 2;
  const textH = estimateTextHeight(c, l, scaledFont, boxW - pad * 2, scale);
  const boxH = textH + pad * 2;
  const cy = top + boxH / 2;
  c.translate(cx, cy);
  c.rotate((l.rotation * Math.PI) / 180);
  c.translate(-boxW / 2, -boxH / 2);
  if (l.boxEnabled || l.borderEnabled) {
    const r = l.borderRadius * scale;
    drawRoundRect(c, 0, 0, boxW, boxH, r);
    if (l.boxEnabled) {
      c.fillStyle = hexToRgba(l.boxColor, l.boxOpacity);
      c.fill();
    }
    if (l.borderEnabled) {
      c.strokeStyle = l.borderColor;
      c.lineWidth = l.borderWidth * scale;
      c.stroke();
    }
  }
  if (l.shadowEnabled) {
    c.shadowColor = hexToRgba(l.shadowColor, 55);
    c.shadowOffsetX = l.shadowX * scale;
    c.shadowOffsetY = l.shadowY * scale;
    c.shadowBlur = l.shadowBlur * scale;
  }
  c.font = `${l.italic ? "italic " : ""}${l.fontWeight} ${scaledFont}px ${l.fontFamily}`;
  c.textBaseline = "top";
  let fill: string | CanvasGradient = l.color;
  if (l.fillType === "gradient") {
    const g = c.createLinearGradient(0, 0, Math.cos((l.gradientAngle * Math.PI) / 180) * boxW, Math.sin((l.gradientAngle * Math.PI) / 180) * boxH);
    g.addColorStop(0, l.gradientFrom);
    g.addColorStop(1, l.gradientTo);
    fill = g;
  }
  c.fillStyle = fill as string;
  const lines = wrapLines(c, l.text, boxW - pad * 2, l.letterSpacing * scale);
  let y = pad;
  const lh = scaledFont * l.lineHeight;
  for (const line of lines) {
    const w = measureLine(c, line, l.letterSpacing * scale);
    let x = pad;
    if (l.align === "center") x = (boxW - w) / 2;
    else if (l.align === "right") x = boxW - pad - w;
    else if (l.align === "justify" && lines.length > 1) x = pad;
    if (l.letterSpacing !== 0) {
      let cur = x;
      for (const ch of line) {
        c.fillText(ch, cur, y);
        cur += c.measureText(ch).width + l.letterSpacing * scale;
      }
    } else {
      c.fillText(line, x, y);
    }
    if (l.underline) {
      c.fillRect(x, y + scaledFont + 1, w, Math.max(1, scaledFont * 0.06));
    }
    y += lh;
  }
  c.restore();
  if (m && target) {
    await destinationInMask(target[1], m, left, top, boxW, boxH, l.rotation || 0);
    compositeOffscreen(ctx, l.opacity, (l as { blendMode?: unknown }).blendMode, target[0]);
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, ls: number): string[] {
  const paras = text.split("\n");
  const out: string[] = [];
  for (const p of paras) {
    if (p === "") { out.push(""); continue; }
    const words = p.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (measureLine(ctx, test, ls) <= maxW || cur === "") cur = test;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}
function measureLine(ctx: CanvasRenderingContext2D, line: string, ls: number): number {
  if (!line) return 0;
  let w = ctx.measureText(line).width;
  if (ls) w += ls * Math.max(0, line.length - 1);
  return w;
}
function estimateTextHeight(ctx: CanvasRenderingContext2D, l: TextLayer, scaledFont: number, maxW: number, scale: number): number {
  ctx.font = `${l.italic ? "italic " : ""}${l.fontWeight} ${scaledFont}px ${l.fontFamily}`;
  const lines = wrapLines(ctx, l.text, maxW, l.letterSpacing * scale);
  return lines.length * scaledFont * l.lineHeight;
}
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
