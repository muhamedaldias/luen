import { cloneEfficient, type LayerRef } from "./layerSystem";
import type { TextLayer } from "./textLayers";
import type { ImageLayer, ShapeLayer, SolidLayer, StrokeLayer } from "./layers";

/* Undo/Redo history — extracted from App.tsx as a first isolation step:
 * every snapshot (Memento) holds the full state, with an adaptive cap based on image size
 * to prevent memory blow-ups (an 8000px image dataURL × 25 snapshots = hundreds of MB). */

export interface CanvasImage {
  url: string;
  imageId: string | null;
  width: number;
  height: number;
}

export interface HistoryEntry {
  label: string;
  image: CanvasImage | null;
  layers: TextLayer[];
  imageLayers: ImageLayer[];
  shapeLayers: ShapeLayer[];
  solidLayers: SolidLayer[];
  strokeLayers?: StrokeLayer[];
  /** The base image before the first library backdrop — so later backdrops can replace it. */
  baseBeforeBackdrop?: CanvasImage | null;
  /** Is the snapshot image a bare backdrop with no product image and no committed user content? */
  pureBackdrop?: boolean;
  strokes: object[];
  order: LayerRef[];
  groups: Record<string, string>;
  /** Magic-wand selection mask (PNG dataURL, white = selected) + invert flag. */
  selectionMask: string | null;
  selectionInverted: boolean;
}

/** History depth based on the estimated image size. */
export const DEFAULT_MAX_HISTORY = 25;
export const MEDIUM_IMAGE_MAX_HISTORY = 15;
export const LARGE_IMAGE_MAX_HISTORY = 10;

const MEDIUM_BYTES = 4 * 1024 * 1024;
const LARGE_BYTES = 10 * 1024 * 1024;

export function cloneLayers<T>(ls: T[]): T[] {
  return cloneEfficient(ls);
}

export function emptyEntry(label: string): HistoryEntry {
  return {
    label,
    image: null,
    layers: [],
    imageLayers: [],
    shapeLayers: [],
    solidLayers: [],
    strokes: [],
    order: [],
    groups: {},
    selectionMask: null,
    selectionInverted: false,
  };
}

/** Estimate the image size in bytes: a dataURL from its length, a remote URL from its dimensions. */
export function estimateImageBytes(img: CanvasImage | null): number {
  if (!img?.url) return 0;
  const u = img.url;
  if (u.startsWith("data:")) {
    const comma = u.indexOf(",");
    const b64len = comma >= 0 ? u.length - comma - 1 : u.length;
    return Math.floor(Math.max(0, b64len) * 0.75);
  }
  const w = img.width || 0;
  const h = img.height || 0;
  return Math.floor(w * h * 4);
}

/** Snapshot cap: large images (print/camera) = 10, medium = 15, ordinary = 25. */
export function getMaxHistory(img: CanvasImage | null): number {
  const bytes = estimateImageBytes(img);
  if (bytes > LARGE_BYTES) return LARGE_IMAGE_MAX_HISTORY;
  if (bytes > MEDIUM_BYTES) return MEDIUM_IMAGE_MAX_HISTORY;
  return DEFAULT_MAX_HISTORY;
}
