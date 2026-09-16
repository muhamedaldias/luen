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
  };
}
