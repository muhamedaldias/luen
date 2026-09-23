export type FillType = "solid" | "gradient";

import type { LayerMask } from "./layers";

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
  mask?: LayerMask;
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

/** مكتبة الخطوط المضمنة (Google Fonts) مقسمة حسب الفئة — تُحمّل دفعة واحدة في index.css. */
export const FONT_LIBRARY: { category: string; fonts: { value: string; label: string }[] }[] = [
  {
    category: "Arabic · عربي",
    fonts: [
      { value: "'Cairo', sans-serif", label: "Cairo" },
      { value: "'Tajawal', sans-serif", label: "Tajawal" },
      { value: "'Almarai', sans-serif", label: "Almarai" },
      { value: "'IBM Plex Sans Arabic', sans-serif", label: "IBM Plex Sans Arabic" },
      { value: "'Reem Kufi', sans-serif", label: "Reem Kufi" },
      { value: "Amiri, serif", label: "Amiri" },
      { value: "'Noto Kufi Arabic', sans-serif", label: "Noto Kufi Arabic" },
    ],
  },
  {
    category: "Sans",
    fonts: [
      { value: "Inter, system-ui, sans-serif", label: "Inter" },
      { value: "'Poppins', sans-serif", label: "Poppins" },
      { value: "'Montserrat', sans-serif", label: "Montserrat" },
      { value: "'Nunito Sans', sans-serif", label: "Nunito Sans" },
      { value: "'Work Sans', sans-serif", label: "Work Sans" },
      { value: "'Manrope', sans-serif", label: "Manrope" },
      { value: "'DM Sans', sans-serif", label: "DM Sans" },
      { value: "Roboto, sans-serif", label: "Roboto" },
      { value: "'Open Sans', sans-serif", label: "Open Sans" },
      { value: "Lato, sans-serif", label: "Lato" },
    ],
  },
  {
    category: "Serif",
    fonts: [
      { value: "'Playfair Display', serif", label: "Playfair Display" },
      { value: "Merriweather, serif", label: "Merriweather" },
      { value: "Lora, serif", label: "Lora" },
      { value: "'Libre Baskerville', serif", label: "Libre Baskerville" },
      { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
      { value: "'PT Serif', serif", label: "PT Serif" },
    ],
  },
  {
    category: "Display",
    fonts: [
      { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
      { value: "Anton, sans-serif", label: "Anton" },
      { value: "Oswald, sans-serif", label: "Oswald" },
      { value: "'Abril Fatface', serif", label: "Abril Fatface" },
      { value: "Fredoka, sans-serif", label: "Fredoka" },
      { value: "Cinzel, serif", label: "Cinzel" },
      { value: "Righteous, sans-serif", label: "Righteous" },
    ],
  },
  {
    category: "Handwriting",
    fonts: [
      { value: "Pacifico, cursive", label: "Pacifico" },
      { value: "'Dancing Script', cursive", label: "Dancing Script" },
      { value: "Caveat, cursive", label: "Caveat" },
      { value: "Lobster, cursive", label: "Lobster" },
    ],
  },
  {
    category: "Monospace",
    fonts: [
      { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
      { value: "'Space Mono', monospace", label: "Space Mono" },
      { value: "'IBM Plex Mono', monospace", label: "IBM Plex Mono" },
      { value: "'Roboto Mono', monospace", label: "Roboto Mono" },
    ],
  },
  {
    category: "System",
    fonts: FONT_OPTIONS,
  },
];

/** كل عائلات الخطوط المضمنة (للتحميل المسبق عبر document.fonts.load). */
export const FONT_FAMILY_NAMES: string[] = [
  "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Reem Kufi", "Amiri", "Noto Kufi Arabic",
  "Inter", "Poppins", "Montserrat", "Nunito Sans", "Work Sans", "Manrope", "DM Sans", "Roboto",
  "Open Sans", "Lato", "Playfair Display", "Merriweather", "Lora", "Libre Baskerville",
  "Cormorant Garamond", "PT Serif", "Bebas Neue", "Anton", "Oswald", "Abril Fatface", "Fredoka",
  "Cinzel", "Righteous", "Pacifico", "Dancing Script", "Caveat", "Lobster", "JetBrains Mono",
  "Space Mono", "IBM Plex Mono", "Roboto Mono",
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
    ...(partial?.mask ? { mask: partial.mask } : {}),
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
