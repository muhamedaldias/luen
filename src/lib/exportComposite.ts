import { hexToRgba, type TextLayer } from "./textLayers";
import { loadCleanImage } from "./safeImage";
import type { ImageLayer, ShapeLayer, SolidLayer } from "./layers";
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
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity / 100));
    try {
      ctx.globalCompositeOperation = normBlend(s.blendMode) as GlobalCompositeOperation;
    } catch { /* تجاهل */ }
    ctx.fillStyle = s.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  async function drawImageLayer(l: ImageLayer) {
    if (!l.visible || l.opacity <= 0 || !l.url) return;
    try {
      const img = await loadCleanImage(l.url);
      const dw = l.w * W;
      const dh = l.h * H;
      const dx = l.x * W;
      const dy = l.y * H;
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
        if (s && s.visible && s.opacity > 0) drawShapeCanvas(ctx, W, H, s, scale);
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
      drawShapeCanvas(ctx, W, H, s, scale);
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

function drawShapeCanvas(ctx: CanvasRenderingContext2D, W: number, H: number, s: ShapeLayer, scale: number) {
  const dw = Math.max(1, s.w * W);
  const dh = Math.max(1, s.h * H);
  const dx = s.x * W;
  const dy = s.y * H;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity / 100));
  try {
    ctx.globalCompositeOperation = normBlend(s.blendMode) as GlobalCompositeOperation;
  } catch { /* تجاهل */ }
  ctx.translate(dx + dw / 2, dy + dh / 2);
  ctx.rotate(((s.rotation || 0) * Math.PI) / 180);
  ctx.translate(-dw / 2, -dh / 2);
  const lw = Math.max(0, s.strokeWidth * scale);
  if (s.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(dw / 2, dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
    if (s.fillEnabled) {
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    if (lw > 0) {
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  } else if (s.shape === "line" || s.shape === "arrow") {
    ctx.beginPath();
    ctx.moveTo(0, dh / 2);
    ctx.lineTo(dw, dh / 2);
    ctx.strokeStyle = s.strokeWidth > 0 ? s.strokeColor : s.color;
    ctx.lineWidth = Math.max(1, lw || 3 * scale);
    ctx.lineCap = "round";
    ctx.stroke();
    if (s.shape === "arrow") {
      const ah = Math.min(dh, 14 * scale) + 6 * scale;
      const aw = 14 * scale;
      ctx.beginPath();
      ctx.moveTo(dw, dh / 2);
      ctx.lineTo(dw - aw, dh / 2 - ah / 2);
      ctx.lineTo(dw - aw, dh / 2 + ah / 2);
      ctx.closePath();
      ctx.fillStyle = s.strokeWidth > 0 ? s.strokeColor : s.color;
      ctx.fill();
    }
  } else {
    drawRoundRect(ctx, 0, 0, dw, dh, Math.min(10 * scale, dw / 4, dh / 4));
    if (s.fillEnabled) {
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    if (lw > 0) {
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  ctx.restore();
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
  ctx.save();
  ctx.globalAlpha = l.opacity / 100;
  try {
    ctx.globalCompositeOperation = normBlend((l as { blendMode?: unknown }).blendMode) as GlobalCompositeOperation;
  } catch { /* تجاهل */ }
  if (l.blur > 0) ctx.filter = `blur(${l.blur * scale}px)`;
  const cx = left + boxW / 2;
  const textH = estimateTextHeight(ctx, l, scaledFont, boxW - pad * 2, scale);
  const boxH = textH + pad * 2;
  const cy = top + boxH / 2;
  ctx.translate(cx, cy);
  ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.translate(-boxW / 2, -boxH / 2);
  if (l.boxEnabled || l.borderEnabled) {
    const r = l.borderRadius * scale;
    drawRoundRect(ctx, 0, 0, boxW, boxH, r);
    if (l.boxEnabled) {
      ctx.fillStyle = hexToRgba(l.boxColor, l.boxOpacity);
      ctx.fill();
    }
    if (l.borderEnabled) {
      ctx.strokeStyle = l.borderColor;
      ctx.lineWidth = l.borderWidth * scale;
      ctx.stroke();
    }
  }
  if (l.shadowEnabled) {
    ctx.shadowColor = hexToRgba(l.shadowColor, 55);
    ctx.shadowOffsetX = l.shadowX * scale;
    ctx.shadowOffsetY = l.shadowY * scale;
    ctx.shadowBlur = l.shadowBlur * scale;
  }
  ctx.font = `${l.italic ? "italic " : ""}${l.fontWeight} ${scaledFont}px ${l.fontFamily}`;
  ctx.textBaseline = "top";
  let fill: string | CanvasGradient = l.color;
  if (l.fillType === "gradient") {
    const g = ctx.createLinearGradient(0, 0, Math.cos((l.gradientAngle * Math.PI) / 180) * boxW, Math.sin((l.gradientAngle * Math.PI) / 180) * boxH);
    g.addColorStop(0, l.gradientFrom);
    g.addColorStop(1, l.gradientTo);
    fill = g;
  }
  ctx.fillStyle = fill as string;
  const lines = wrapLines(ctx, l.text, boxW - pad * 2, l.letterSpacing * scale);
  let y = pad;
  const lh = scaledFont * l.lineHeight;
  for (const line of lines) {
    const w = measureLine(ctx, line, l.letterSpacing * scale);
    let x = pad;
    if (l.align === "center") x = (boxW - w) / 2;
    else if (l.align === "right") x = boxW - pad - w;
    else if (l.align === "justify" && lines.length > 1) x = pad;
    if (l.letterSpacing !== 0) {
      let cur = x;
      for (const ch of line) {
        ctx.fillText(ch, cur, y);
        cur += ctx.measureText(ch).width + l.letterSpacing * scale;
      }
    } else {
      ctx.fillText(line, x, y);
    }
    if (l.underline) {
      ctx.fillRect(x, y + scaledFont + 1, w, Math.max(1, scaledFont * 0.06));
    }
    y += lh;
  }
  ctx.restore();
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
