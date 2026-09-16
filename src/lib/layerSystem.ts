import type { TextLayer } from "./textLayers";
import type { ImageLayer, ShapeLayer, SolidLayer, LayerBlendMode } from "./layers";

export type { LayerBlendMode };
export const BG_ID = "__background__";

export type LayerKind = "background" | "text" | "image" | "shape" | "solid";
export interface LayerRef {
  kind: LayerKind;
  id: string;
}

export const BLEND_MODES: { value: LayerBlendMode; label: string }[] = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

const BLEND_SET = new Set<string>(BLEND_MODES.map((b) => b.value));

export function normBlend(v: unknown): LayerBlendMode {
  return typeof v === "string" && BLEND_SET.has(v) ? (v as LayerBlendMode) : "source-over";
}

export function blendLabel(v: unknown): string {
  const n = normBlend(v);
  return BLEND_MODES.find((b) => b.value === n)?.label ?? "Normal";
}

export interface LayerCollections {
  hasBackground: boolean;
  texts: TextLayer[];
  images: ImageLayer[];
  shapes: ShapeLayer[];
  solids: SolidLayer[];
}

export function allIds(c: LayerCollections): Map<string, LayerRef> {
  const m = new Map<string, LayerRef>();
  if (c.hasBackground) m.set(BG_ID, { kind: "background", id: BG_ID });
  for (const l of c.solids) m.set(l.id, { kind: "solid", id: l.id });
  for (const l of c.images) m.set(l.id, { kind: "image", id: l.id });
  for (const l of c.shapes) m.set(l.id, { kind: "shape", id: l.id });
  for (const l of c.texts) m.set(l.id, { kind: "text", id: l.id });
  return m;
}

export function syncOrder(prev: LayerRef[], c: LayerCollections): LayerRef[] {
  const live = allIds(c);
  const kept = prev.filter((r) => live.has(r.id));
  const keptIds = new Set(kept.map((r) => r.id));
  const fresh: LayerRef[] = [];
  for (const [id, ref] of live) {
    if (!keptIds.has(id)) fresh.push(ref);
  }
  const bgIdx = kept.findIndex((r) => r.id === BG_ID);
  let bg: LayerRef | null = null;
  let rest = kept;
  if (bgIdx >= 0) {
    bg = kept[bgIdx];
    rest = [...kept.slice(0, bgIdx), ...kept.slice(bgIdx + 1)];
  } else if (c.hasBackground) {
    bg = { kind: "background", id: BG_ID };
  }
  const freshBg = fresh.filter((r) => r.id === BG_ID);
  const freshRest = fresh.filter((r) => r.id !== BG_ID);
  if (!bg && freshBg.length) bg = freshBg[0];
  const out: LayerRef[] = [];
  if (bg) out.push(bg);
  out.push(...rest, ...freshRest);
  return out;
}

export function moveRef(order: LayerRef[], id: string, dir: "front" | "back" | "forward" | "backward"): LayerRef[] {
  const idx = order.findIndex((r) => r.id === id);
  if (idx < 0) return order;
  if (order[idx].id === BG_ID) return order;
  const arr = [...order];
  const [item] = arr.splice(idx, 1);
  const bottom = arr[0]?.id === BG_ID ? 1 : 0;
  if (dir === "front") arr.push(item);
  else if (dir === "back") arr.splice(bottom, 0, item);
  else if (dir === "forward") arr.splice(Math.min(arr.length, idx + 1), 0, item);
  else arr.splice(Math.max(bottom, idx - 1), 0, item);
  return arr;
}

export function dragReorder(order: LayerRef[], dragId: string, targetId: string, after: boolean): LayerRef[] {
  if (dragId === targetId || dragId === BG_ID) return order;
  const from = order.findIndex((r) => r.id === dragId);
  let to = order.findIndex((r) => r.id === targetId);
  if (from < 0 || to < 0) return order;
  const arr = [...order];
  const [item] = arr.splice(from, 1);
  to = arr.findIndex((r) => r.id === targetId);
  if (to < 0) return order;
  arr.splice(after ? to + 1 : to, 0, item);
  if (arr[0]?.id !== BG_ID) {
    const bi = arr.findIndex((r) => r.id === BG_ID);
    if (bi > 0) {
      const [bg] = arr.splice(bi, 1);
      arr.unshift(bg);
    }
  }
  return arr;
}

export interface GeomBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

export function alignPatches(boxes: GeomBox[], ids: string[], mode: AlignMode): Record<string, { x: number; y: number }> {
  const sel = boxes.filter((b) => ids.includes(b.id));
  if (sel.length < 2) return {};
  const minX = Math.min(...sel.map((b) => b.x));
  const maxX = Math.max(...sel.map((b) => b.x + b.w));
  const minY = Math.min(...sel.map((b) => b.y));
  const maxY = Math.max(...sel.map((b) => b.y + b.h));
  const out: Record<string, { x: number; y: number }> = {};
  for (const b of sel) {
    let nx = b.x;
    let ny = b.y;
    if (mode === "left") nx = minX;
    else if (mode === "right") nx = maxX - b.w;
    else if (mode === "centerX") nx = (minX + maxX) / 2 - b.w / 2;
    else if (mode === "top") ny = minY;
    else if (mode === "bottom") ny = maxY - b.h;
    else if (mode === "centerY") ny = (minY + maxY) / 2 - b.h / 2;
    nx = Math.round(nx * 10000) / 10000;
    ny = Math.round(ny * 10000) / 10000;
    if (nx !== b.x || ny !== b.y) out[b.id] = { x: nx, y: ny };
  }
  return out;
}

export function distributePatches(boxes: GeomBox[], ids: string[], axis: "x" | "y"): Record<string, { x: number; y: number }> {
  const sel = boxes.filter((b) => ids.includes(b.id)).sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
  if (sel.length < 3) return {};
  const first = sel[0];
  const last = sel[sel.length - 1];
  const spanStart = axis === "x" ? first.x : first.y;
  const spanEnd = axis === "x" ? last.x + last.w : last.y + last.h;
  const totalSize = sel.reduce((s, b) => s + (axis === "x" ? b.w : b.h), 0);
  const gap = (spanEnd - spanStart - totalSize) / (sel.length - 1);
  const out: Record<string, { x: number; y: number }> = {};
  let cursor = spanStart;
  for (let i = 0; i < sel.length; i++) {
    const b = sel[i];
    if (i === 0 || i === sel.length - 1) {
      cursor += (axis === "x" ? b.w : b.h) + gap;
      continue;
    }
    const v = Math.round(cursor * 10000) / 10000;
    if (axis === "x") {
      if (v !== b.x) out[b.id] = { x: v, y: b.y };
      cursor += b.w + gap;
    } else {
      if (v !== b.y) out[b.id] = { x: b.x, y: v };
      cursor += b.h + gap;
    }
  }
  return out;
}

export function createGroupId(): string {
  return `grp-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

export function cloneEfficient<T>(v: T): T {
  try {
    const sc = (globalThis as unknown as { structuredClone?: (x: unknown) => unknown }).structuredClone;
    if (typeof sc === "function") return sc(v) as T;
  } catch {
    /* fallback below */
  }
  try {
    return JSON.parse(JSON.stringify(v)) as T;
  } catch {
    if (Array.isArray(v)) return (v as unknown[]).map((l) => ({ ...(l as object) })) as unknown as T;
    return { ...(v as object) } as T;
  }
}

export function estimateJsonBytes(v: unknown): number {
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return 0;
  }
}

export function toggleSelection(sel: string[], id: string, multi: boolean): string[] {
  if (!multi) return [id];
  return sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
}

export function groupNameFor(count: number): string {
  return `Group ${count}`;
}
