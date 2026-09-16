import { Gradient, Shadow } from "fabric";
import { hexToRgba, type TextLayer } from "./textLayers";

/** صندوق العرض داخل مشهد fabric (بالبكسل). */
export interface StageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ACCENT = "#C97B4A";

/** موضع/عرض الطبقة بالبكسل داخل المشهد. */
export function layerToStage(layer: TextLayer, box: StageBox): { left: number; top: number; width: number } {
  return {
    left: box.x + layer.x * box.w,
    top: box.y + layer.y * box.h,
    width: Math.max(24, layer.w * box.w),
  };
}

/** تعبئة النص: لون أو تدرج fabric (مع تراجع آمن للون الصلب). */
export function buildTextFill(layer: TextLayer): string | Gradient<"linear"> {
  if (layer.fillType !== "gradient") return layer.color;
  try {
    // CSS angle: 0deg=للأعلى، 90deg=لليمين — نحوّل لمتجه داخل مربع النسبة.
    const rad = (layer.gradientAngle * Math.PI) / 180;
    const dx = Math.sin(rad) / 2;
    const dy = -Math.cos(rad) / 2;
    return new Gradient<"linear">({
      type: "linear",
      gradientUnits: "percentage",
      coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
      colorStops: [
        { offset: 0, color: layer.gradientFrom },
        { offset: 1, color: layer.gradientTo },
      ],
    });
  } catch {
    return layer.color;
  }
}

export function buildShadow(layer: TextLayer): Shadow | undefined {
  if (!layer.shadowEnabled) return undefined;
  try {
    return new Shadow({
      color: hexToRgba(layer.shadowColor, 55),
      blur: Math.max(0, layer.shadowBlur),
      offsetX: layer.shadowX,
      offsetY: layer.shadowY,
    });
  } catch {
    return undefined;
  }
}

const VALID_ALIGN = new Set(["left", "center", "right", "justify", "justify-left", "justify-center", "justify-right"]);

/** خصائص fabric.Textbox من طبقة نص — آمنة (لا ترمي). */
export function textboxProps(layer: TextLayer, stage: { left: number; top: number; width: number }): Record<string, unknown> {
  return {
    left: stage.left,
    top: stage.top,
    width: stage.width,
    originX: "left",
    originY: "top",
    angle: layer.rotation || 0,
    text: layer.text,
    fontFamily: layer.fontFamily,
    fontSize: Math.max(4, layer.fontSize),
    fontWeight: layer.fontWeight,
    fontStyle: layer.italic ? "italic" : "normal",
    underline: !!layer.underline,
    textAlign: VALID_ALIGN.has(layer.align) ? layer.align : "left",
    lineHeight: layer.lineHeight > 0 ? layer.lineHeight : 1.16,
    charSpacing: Number.isFinite(layer.letterSpacing) ? layer.letterSpacing : 0,
    fill: buildTextFill(layer),
    opacity: Math.max(0, Math.min(1, layer.opacity / 100)),
    shadow: buildShadow(layer) ?? null,
    visible: layer.visible !== false,
    editable: !layer.locked,
    lockMovementX: !!layer.locked,
    lockMovementY: !!layer.locked,
    lockRotation: !!layer.locked,
    lockScalingX: !!layer.locked,
    lockScalingY: !!layer.locked,
    hasControls: !layer.locked,
    splitByGrapheme: false,
  };
}

/** خصائص مستطيل الصندوق الخلفي (خلف النص). */
export function boxRectProps(layer: TextLayer, geom: { cx: number; cy: number; w: number; h: number }): Record<string, unknown> | null {
  if (!layer.boxEnabled && !layer.borderEnabled) return null;
  const pad = Math.max(0, layer.padding);
  return {
    originX: "center",
    originY: "center",
    left: geom.cx,
    top: geom.cy,
    width: Math.max(8, geom.w + pad * 2),
    height: Math.max(8, geom.h + pad * 2),
    rx: Math.max(0, layer.borderRadius),
    ry: Math.max(0, layer.borderRadius),
    fill: layer.boxEnabled ? hexToRgba(layer.boxColor, layer.boxOpacity) : "transparent",
    stroke: layer.borderEnabled ? layer.borderColor : "transparent",
    strokeWidth: layer.borderEnabled ? Math.max(0, layer.borderWidth) : 0,
    opacity: Math.max(0, Math.min(1, layer.opacity / 100)),
    shadow: buildShadow(layer) ?? null,
    visible: layer.visible !== false,
    selectable: false,
    evented: false,
  };
}

/** تطبيع زاوية لقراءة الحالة. */
export function normAngle(a: number): number {
  let n = a % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return Math.round(n * 10) / 10;
}
