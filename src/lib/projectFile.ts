import type { TextLayer } from "./textLayers";
import type { ImageLayer, ShapeLayer, SolidLayer } from "./layers";
import type { LayerRef } from "./layerSystem";
import type { CanvasImage } from "./history";

/* ملف مشروع Lumen (‎.lumen): JSON يحفظ الحالة القابلة للتحرير كاملة
 * (الصورة + كل الطبقات + الترتيب + المجموعات + مقاس المستند).
 * الضربات الحرة المدمجة تُحفظ ضمن الصورة؛ المعلقة تُتجاهل عمدًا. */

export interface LumenProject {
  app: "lumen";
  version: 1;
  docSize: { w: number; h: number };
  image: CanvasImage | null;
  textLayers: TextLayer[];
  imageLayers: ImageLayer[];
  shapeLayers: ShapeLayer[];
  solidLayers: SolidLayer[];
  order: LayerRef[];
  groups: Record<string, string>;
}

export function serializeProject(p: Omit<LumenProject, "app" | "version">): string {
  const doc: LumenProject = { app: "lumen", version: 1, ...p };
  return JSON.stringify(doc);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function parseProject(json: string): LumenProject {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not a valid project file");
  }
  if (!isRecord(raw) || raw.app !== "lumen" || typeof raw.version !== "number") {
    throw new Error("Not a Lumen project file");
  }
  if ((raw.version as number) > 1) {
    throw new Error("Project was saved by a newer version of Lumen");
  }
  const docSize = isRecord(raw.docSize)
    ? {
        w: Math.max(64, Math.min(12000, Math.round(Number(raw.docSize.w) || 1200))),
        h: Math.max(64, Math.min(12000, Math.round(Number(raw.docSize.h) || 800))),
      }
    : { w: 1200, h: 800 };
  const image = isRecord(raw.image) && typeof raw.image.url === "string"
    ? {
        url: raw.image.url as string,
        imageId: typeof raw.image.imageId === "string" ? (raw.image.imageId as string) : null,
        width: Math.round(Number(raw.image.width) || 0),
        height: Math.round(Number(raw.image.height) || 0),
      }
    : null;
  return {
    app: "lumen",
    version: 1,
    docSize,
    image,
    textLayers: asArray<TextLayer>(raw.textLayers),
    imageLayers: asArray<ImageLayer>(raw.imageLayers),
    shapeLayers: asArray<ShapeLayer>(raw.shapeLayers),
    solidLayers: asArray<SolidLayer>(raw.solidLayers),
    order: asArray<LayerRef>(raw.order),
    groups: isRecord(raw.groups) ? (raw.groups as Record<string, string>) : {},
  };
}

export function downloadProject(p: Omit<LumenProject, "app" | "version">, filename = "lumen-project.lumen"): void {
  const blob = new Blob([serializeProject(p)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function readProjectFile(file: File): Promise<LumenProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseProject(reader.result as string));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Could not read project"));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}
