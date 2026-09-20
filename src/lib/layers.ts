/* طبقات عامة: صورة / شكل / تعبئة لونية — بجانب طبقات النص الموجودة.
   كل طبقة نسبية (0..1) لدقة مستقلة عن الأبعاد + visible/locked/opacity. */

export type LayerBlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface ImageLayer {
  id: string;
  kind: "image";
  name: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode?: LayerBlendMode;
  groupId?: string | null;
  mask?: LayerMask;
}

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";

export interface ShapeLayer {
  id: string;
  kind: "shape";
  name: string;
  shape: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  fillEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode?: LayerBlendMode;
  groupId?: string | null;
  mask?: LayerMask;
}

export interface SolidLayer {
  id: string;
  kind: "solid";
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode?: LayerBlendMode;
  groupId?: string | null;
  mask?: LayerMask;
}

export type AnyLayer = ImageLayer | ShapeLayer | SolidLayer;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

export function createImageLayer(partial: Partial<ImageLayer> & { url: string }): ImageLayer {
  return {
    id: partial.id ?? uid("img"),
    kind: "image",
    name: partial.name ?? "Image layer",
    url: partial.url,
    x: partial.x ?? 0.25,
    y: partial.y ?? 0.25,
    w: partial.w ?? 0.4,
    h: partial.h ?? 0.4,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 100,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    blendMode: partial.blendMode ?? "source-over",
    groupId: partial.groupId ?? null,
    ...(partial.mask ? { mask: partial.mask } : {}),
  };
}

export function createShapeLayer(partial?: Partial<ShapeLayer>): ShapeLayer {
  return {
    id: partial?.id ?? uid("shp"),
    kind: "shape",
    name: partial?.name ?? "Shape layer",
    shape: partial?.shape ?? "rect",
    x: partial?.x ?? 0.3,
    y: partial?.y ?? 0.3,
    w: partial?.w ?? 0.3,
    h: partial?.h ?? 0.2,
    rotation: partial?.rotation ?? 0,
    color: partial?.color ?? "#C97B4A",
    fillEnabled: partial?.fillEnabled ?? true,
    strokeColor: partial?.strokeColor ?? "#EDEBE7",
    strokeWidth: partial?.strokeWidth ?? 0,
    opacity: partial?.opacity ?? 100,
    visible: partial?.visible ?? true,
    locked: partial?.locked ?? false,
    blendMode: partial?.blendMode ?? "source-over",
    groupId: partial?.groupId ?? null,
    ...(partial?.mask ? { mask: partial.mask } : {}),
  };
}

export function createSolidLayer(partial?: Partial<SolidLayer>): SolidLayer {
  return {
    id: partial?.id ?? uid("sol"),
    kind: "solid",
    name: partial?.name ?? "Solid fill",
    color: partial?.color ?? "#C97B4A",
    opacity: partial?.opacity ?? 100,
    visible: partial?.visible ?? true,
    locked: partial?.locked ?? false,
    blendMode: partial?.blendMode ?? "source-over",
    groupId: partial?.groupId ?? null,
    ...(partial?.mask ? { mask: partial.mask } : {}),
  };
}

/* ── Layer masks (non-destructive, per-layer alpha) ──
 * A mask is a grayscale/alpha image stretched over the layer's bounds:
 * white = reveal, black = hide. Stored as a data URL so it survives
 * history snapshots, project files, and export without extra assets. */

export interface LayerMask {
  /** Grayscale/alpha mask image (data URL), stretched to the layer bounds. */
  url: string;
  /** Disabled masks are kept but ignored by renderers (non-destructive). */
  visible: boolean;
  /** When true, black reveals and white hides. */
  invert: boolean;
  /** 0..100 — scales the mask strength. */
  opacity: number;
}

function solidMaskDataUrl(white: boolean): string {
  try {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = white ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, 8, 8);
    return c.toDataURL("image/png");
  } catch {
    return "";
  }
}

/** New mask: 'white' reveals everything, 'black' hides everything.
 *  'selection' falls back to white until a selection-to-mask flow exists. */
export function createLayerMask(initialValue: "white" | "black" | "selection" = "white"): LayerMask {
  return {
    url: solidMaskDataUrl(initialValue !== "black"),
    visible: true,
    invert: false,
    opacity: 100,
  };
}

/** Validate an unknown value into a LayerMask; invalid/missing → undefined (never throws). */
export function sanitizeLayerMask(v: unknown): LayerMask | undefined {
  try {
    if (typeof v !== "object" || v === null) return undefined;
    const m = v as Record<string, unknown>;
    if (typeof m.url !== "string" || !m.url) return undefined;
    const op = typeof m.opacity === "number" && Number.isFinite(m.opacity) ? m.opacity : 100;
    return {
      url: m.url,
      visible: m.visible !== false,
      invert: m.invert === true,
      opacity: Math.max(0, Math.min(100, op)),
    };
  } catch {
    return undefined;
  }
}

/** The mask a renderer should apply: present, has a URL, and enabled. Otherwise undefined. */
export function effectiveMask(layer: { mask?: LayerMask | null | undefined }): LayerMask | undefined {
  try {
    const m = sanitizeLayerMask(layer?.mask);
    if (!m || m.visible === false) return undefined;
    return m;
  } catch {
    return undefined;
  }
}

/** Canvas → PNG data URL helper for mask painting flows. */
export function maskCanvasToDataURL(c: HTMLCanvasElement): string {
  return c.toDataURL("image/png");
}

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("mask decode failed"));
    img.src = url;
  });
}

/** CPU pixel op: multiply image alpha by mask luminance (× mask alpha), optional invert.
 *  RGB is untouched and alpha is only ever reduced — never created. Sizes are
 *  intersected; a null/empty mask returns the source unchanged. */
export function applyMaskToImageData(image: ImageData, mask: ImageData | null, invert = false): ImageData {
  if (!mask || mask.width < 1 || mask.height < 1) return image;
  const w = Math.min(image.width, mask.width);
  const h = Math.min(image.height, mask.height);
  if (w < 1 || h < 1) return image;
  let out: ImageData;
  try {
    out = new ImageData(w, h);
  } catch {
    return image;
  }
  const src = image.data;
  const md = mask.data;
  const dst = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * image.width + x) * 4;
      const mi = (y * mask.width + x) * 4;
      const lum = (md[mi] * 0.299 + md[mi + 1] * 0.587 + md[mi + 2] * 0.114) / 255;
      const ma = md[mi + 3] / 255;
      let k = lum * ma;
      if (invert) k = 1 - k;
      const di = (y * w + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = Math.round(src[si + 3] * Math.max(0, Math.min(1, k)));
    }
  }
  return out;
}

/** Mask data URL → alpha canvas of the requested size (white = opaque).
 *  Luminance becomes alpha; invert/opacity applied. Null on any failure. */
export async function maskUrlToAlphaCanvas(
  mask: LayerMask,
  w: number,
  h: number
): Promise<HTMLCanvasElement | null> {
  try {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    if (!mask.url) return null;
    const el = await loadImageEl(mask.url);
    const mc = document.createElement("canvas");
    mc.width = W;
    mc.height = H;
    const mctx = mc.getContext("2d", { willReadFrequently: true });
    if (!mctx) return null;
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(el, 0, 0, W, H);
    const img = mctx.getImageData(0, 0, W, H);
    const d = img.data;
    const kop = Math.max(0, Math.min(1, mask.opacity / 100));
    const inv = mask.invert === true;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const ma = d[i + 3] / 255;
      let k = (inv ? 1 - lum * ma : lum * ma) * kop;
      k = Math.max(0, Math.min(1, k));
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(k * 255);
    }
    mctx.putImageData(img, 0, 0);
    return mc;
  } catch {
    return null;
  }
}

/** Composite a mask onto a canvas via destination-in. No-op (original kept) on failure. */
export async function applyMaskUrlToCanvas(
  src: HTMLCanvasElement,
  mask: LayerMask,
  dx = 0,
  dy = 0,
  dw?: number,
  dh?: number
): Promise<HTMLCanvasElement> {
  try {
    const W = src.width;
    const H = src.height;
    if (W < 1 || H < 1) return src;
    const bw = Math.max(1, Math.round(dw ?? W));
    const bh = Math.max(1, Math.round(dh ?? H));
    const alpha = await maskUrlToAlphaCanvas(mask, bw, bh);
    if (!alpha) return src;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d");
    if (!octx) return src;
    octx.drawImage(src, 0, 0);
    octx.save();
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(alpha, Math.round(dx), Math.round(dy), bw, bh);
    octx.restore();
    return out;
  } catch {
    return src;
  }
}

/** Destructive bake: burn a layer mask into an image URL (for Apply Mask). */
export async function bakeMaskIntoImage(imageUrl: string, mask: LayerMask): Promise<string> {
  const el = await loadImageEl(imageUrl);
  const W = el.naturalWidth || el.width || 1;
  const H = el.naturalHeight || el.height || 1;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(el, 0, 0, W, H);
  const masked = await applyMaskUrlToCanvas(c, mask);
  return masked.toDataURL("image/png");
}
