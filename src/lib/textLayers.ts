export type FillType = "solid" | "gradient";

export type TextAlign = "left" | "center" | "right" | "justify";

export type TextBlendMode =
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

export interface TextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  w: number;
  rotation: number;
  blendMode?: TextBlendMode;
  groupId?: string | null;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  fillType: FillType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  padding: number;
  borderRadius: number;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  blur: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  visible: boolean;
  locked: boolean;
}

export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times" },
  { value: "'Courier New', Courier, monospace", label: "Courier" },
  { value: "Tahoma, Verdana, sans-serif", label: "Tahoma" },
  { value: "'Segoe UI', Tahoma, sans-serif", label: "Segoe UI" },
  { value: "Impact, Haettenschweiler, sans-serif", label: "Impact" },
];

export const WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "SemiBold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "ExtraBold" },
];

export function createTextLayer(partial?: Partial<TextLayer> & { x?: number; y?: number }): TextLayer {
  const id = partial?.id ?? `txt-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
  return {
    id,
    name: partial?.name ?? "Text layer",
    text: partial?.text ?? "Double click to edit",
    x: partial?.x ?? 0.3,
    y: partial?.y ?? 0.3,
    w: partial?.w ?? 0.4,
    rotation: partial?.rotation ?? 0,
    fontFamily: partial?.fontFamily ?? FONT_OPTIONS[0].value,
    fontSize: partial?.fontSize ?? 28,
    fontWeight: partial?.fontWeight ?? 600,
    italic: partial?.italic ?? false,
    underline: partial?.underline ?? false,
    align: partial?.align ?? "center",
    lineHeight: partial?.lineHeight ?? 1.25,
    letterSpacing: partial?.letterSpacing ?? 0,
    fillType: partial?.fillType ?? "solid",
    color: partial?.color ?? "#EDEBE7",
    gradientFrom: partial?.gradientFrom ?? "#C97B4A",
    gradientTo: partial?.gradientTo ?? "#EDEBE7",
    gradientAngle: partial?.gradientAngle ?? 90,
    boxEnabled: partial?.boxEnabled ?? false,
    boxColor: partial?.boxColor ?? "#1C1B1A",
    boxOpacity: partial?.boxOpacity ?? 100,
    padding: partial?.padding ?? 12,
    borderRadius: partial?.borderRadius ?? 8,
    borderEnabled: partial?.borderEnabled ?? false,
    borderColor: partial?.borderColor ?? "#2A2927",
    borderWidth: partial?.borderWidth ?? 1,
    opacity: partial?.opacity ?? 100,
    blur: partial?.blur ?? 0,
    shadowEnabled: partial?.shadowEnabled ?? true,
    shadowColor: partial?.shadowColor ?? "#000000",
    shadowX: partial?.shadowX ?? 0,
    shadowY: partial?.shadowY ?? 4,
    shadowBlur: partial?.shadowBlur ?? 16,
    visible: partial?.visible ?? true,
    locked: partial?.locked ?? false,
    blendMode: partial?.blendMode ?? "source-over",
    groupId: partial?.groupId ?? null,
  };
}

export function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

export function gradientCss(layer: Pick<TextLayer, "gradientFrom" | "gradientTo" | "gradientAngle">): string {
  return `linear-gradient(${layer.gradientAngle}deg, ${layer.gradientFrom}, ${layer.gradientTo})`;
}
