import { useState } from "react";

export type DialogKind =
  | "resize-canvas"
  | "image-size"
  | "blur"
  | "sharpen"
  | "brightness-contrast"
  | "hue-saturation"
  | "vignette"
  | "upscale"
  | "feather"
  | "levels"
  | "curves"
  | "color-balance"
  | "vibrance";

export interface CurvePoint {
  x: number;
  y: number;
}

export const CURVE_PRESETS: Record<string, CurvePoint[]> = {
  linear: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  "s-curve": [{ x: 0, y: 0 }, { x: 64, y: 48 }, { x: 192, y: 208 }, { x: 255, y: 255 }],
  contrast: [{ x: 0, y: 0 }, { x: 80, y: 60 }, { x: 176, y: 196 }, { x: 255, y: 255 }],
  fade: [{ x: 0, y: 32 }, { x: 128, y: 140 }, { x: 255, y: 235 }],
};

const TITLES: Record<DialogKind, string> = {
  "resize-canvas": "Resize Canvas",
  "image-size": "Image Size",
  blur: "Gaussian Blur",
  sharpen: "Sharpen (Unsharp Mask)",
  "brightness-contrast": "Brightness / Contrast",
  "hue-saturation": "Hue / Saturation",
  vignette: "Vignette",
  upscale: "AI Upscale",
  feather: "Feather Selection",
  levels: "Levels",
  curves: "Curves",
  "color-balance": "Color Balance",
  vibrance: "Vibrance",
};

const ANCHORS = [
  "topleft", "top", "topright",
  "left", "center", "right",
  "bottomleft", "bottom", "bottomright",
];

interface MenuDialogProps {
  kind: DialogKind;
  imageWidth: number;
  imageHeight: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (params: Record<string, number | string>) => void;
}

export default function MenuDialog({ kind, imageWidth, imageHeight, busy = false, onClose, onConfirm }: MenuDialogProps) {
  const W = imageWidth > 0 ? imageWidth : 800;
  const H = imageHeight > 0 ? imageHeight : 600;
  const [width, setWidth] = useState(W);
  const [height, setHeight] = useState(H);
  const [keepAspect, setKeepAspect] = useState(true);
  const [anchor, setAnchor] = useState("center");
  const [bg, setBg] = useState("#1C1B1A");
  const [radius, setRadius] = useState(3);
  const [amount, setAmount] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [strength, setStrength] = useState(45);
  const [scale, setScale] = useState(2);
  const [feather, setFeather] = useState(2);
  const [shadows, setShadows] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [highlights, setHighlights] = useState(255);
  const [outputMin, setOutputMin] = useState(0);
  const [outputMax, setOutputMax] = useState(255);
  const [channel, setChannel] = useState("rgb");
  const [curvePoints, setCurvePoints] = useState<CurvePoint[]>(CURVE_PRESETS["s-curve"]);
  const [curvePreset, setCurvePreset] = useState("s-curve");
  const [shCyanRed, setShCyanRed] = useState(0);
  const [shMagGreen, setShMagGreen] = useState(0);
  const [shYelBlue, setShYelBlue] = useState(0);
  const [midCyanRed, setMidCyanRed] = useState(0);
  const [midMagGreen, setMidMagGreen] = useState(0);
  const [midYelBlue, setMidYelBlue] = useState(0);
  const [hiCyanRed, setHiCyanRed] = useState(0);
  const [hiMagGreen, setHiMagGreen] = useState(0);
  const [hiYelBlue, setHiYelBlue] = useState(0);
  const [preserveLum, setPreserveLum] = useState(true);
  const [vibrance, setVibrance] = useState(30);
  const [livePreview, setLivePreview] = useState(true);

  function setW(v: number) {
    const nv = Math.max(1, Math.min(20000, Math.round(v) || 1));
    setWidth(nv);
    if (kind === "image-size" && keepAspect && W > 0) setHeight(Math.max(1, Math.round((nv / W) * H)));
  }
  function setH(v: number) {
    const nv = Math.max(1, Math.min(20000, Math.round(v) || 1));
    setHeight(nv);
    if (kind === "image-size" && keepAspect && H > 0) setWidth(Math.max(1, Math.round((nv / H) * W)));
  }

  function confirm() {
    switch (kind) {
      case "resize-canvas":
        onConfirm({ width, height, anchor, bg });
        break;
      case "image-size":
        onConfirm({ width, height });
        break;
      case "blur":
        onConfirm({ radius });
        break;
      case "sharpen":
        onConfirm({ amount });
        break;
      case "brightness-contrast":
        onConfirm({ brightness, contrast });
        break;
      case "hue-saturation":
        onConfirm({ hue, saturation });
        break;
      case "vignette":
        onConfirm({ strength });
        break;
      case "upscale":
        onConfirm({ scale });
        break;
      case "feather":
        onConfirm({ radius: feather });
        break;
      case "levels":
        onConfirm({
          shadows: Math.max(0, Math.min(255, Math.round(shadows))),
          gamma: Math.max(0.1, Math.min(10, gamma)),
          highlights: Math.max(0, Math.min(255, Math.round(highlights))),
          output_min: Math.max(0, Math.min(255, Math.round(outputMin))),
          output_max: Math.max(0, Math.min(255, Math.round(outputMax))),
          channel,
        });
        break;
      case "curves":
        onConfirm({ points: JSON.stringify(curvePoints), channel });
        break;
      case "color-balance":
        onConfirm({
          shadows_cyan_red: shCyanRed,
          shadows_magenta_green: shMagGreen,
          shadows_yellow_blue: shYelBlue,
          midtones_cyan_red: midCyanRed,
          midtones_magenta_green: midMagGreen,
          midtones_yellow_blue: midYelBlue,
          highlights_cyan_red: hiCyanRed,
          highlights_magenta_green: hiMagGreen,
          highlights_yellow_blue: hiYelBlue,
          preserve_luminosity: preserveLum ? 1 : 0,
        });
        break;
      case "vibrance":
        onConfirm({ amount: vibrance, preview: livePreview ? 1 : 0 });
        break;
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340, maxWidth: "100%", borderRadius: 12, padding: 18,
          background: "var(--card)", border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{TITLES[kind]}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--muted-foreground)" }}>Current: {W} × {H}px</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(kind === "resize-canvas" || kind === "image-size") && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <NumField label="Width" value={width} onChange={setW} />
                <NumField label="Height" value={height} onChange={setH} />
              </div>
              {kind === "image-size" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--foreground)", cursor: "pointer" }}>
                  <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
                  Constrain proportions
                </label>
              )}
              {kind === "resize-canvas" && (
                <>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--muted-foreground)" }}>Anchor</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, width: 120 }}>
                      {ANCHORS.map((a) => (
                        <button
                          key={a}
                          onClick={() => setAnchor(a)}
                          title={a}
                          style={{
                            height: 26, borderRadius: 4, cursor: "pointer",
                            background: anchor === a ? "var(--accent)" : "var(--secondary)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Fill</span>
                    <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 34, height: 26, padding: 0, background: "transparent", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }} />
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--foreground)" }}>{bg}</span>
                  </div>
                </>
              )}
            </>
          )}
          {kind === "blur" && <SliderField label="Radius" value={radius} min={0} max={20} step={0.5} suffix="px" onChange={setRadius} />}
          {kind === "sharpen" && <SliderField label="Amount" value={amount} min={0} max={5} step={0.1} suffix="×" onChange={setAmount} />}
          {kind === "brightness-contrast" && (
            <>
              <SliderField label="Brightness" value={brightness} min={-100} max={100} onChange={setBrightness} />
              <SliderField label="Contrast" value={contrast} min={-100} max={100} onChange={setContrast} />
            </>
          )}
          {kind === "hue-saturation" && (
            <>
              <SliderField label="Hue" value={hue} min={-180} max={180} suffix="°" onChange={setHue} />
              <SliderField label="Saturation" value={saturation} min={-100} max={100} onChange={setSaturation} />
            </>
          )}
          {kind === "vignette" && <SliderField label="Strength" value={strength} min={0} max={100} suffix="%" onChange={setStrength} />}
          {kind === "feather" && <SliderField label="Feather radius" value={feather} min={0} max={30} suffix="px" onChange={setFeather} />}
          {kind === "levels" && (
            <>
              <ChannelField value={channel} onChange={setChannel} />
              <SliderField label="Shadows (input black)" value={shadows} min={0} max={255} onChange={(v) => setShadows(Math.min(v, highlights - 1))} />
              <SliderField label="Midtones (gamma)" value={gamma} min={0.1} max={3} step={0.05} suffix="γ" onChange={setGamma} />
              <SliderField label="Highlights (input white)" value={highlights} min={0} max={255} onChange={(v) => setHighlights(Math.max(v, shadows + 1))} />
              <SliderField label="Output black" value={outputMin} min={0} max={255} onChange={setOutputMin} />
              <SliderField label="Output white" value={outputMax} min={0} max={255} onChange={setOutputMax} />
            </>
          )}
          {kind === "curves" && (
            <>
              <ChannelField value={channel} onChange={setChannel} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(CURVE_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setCurvePreset(name);
                      setCurvePoints(CURVE_PRESETS[name].map((p) => ({ ...p })));
                    }}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      background: curvePreset === name ? "var(--accent)" : "var(--secondary)",
                      color: curvePreset === name ? "var(--accent-foreground)" : "var(--foreground)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <CurveEditor points={curvePoints} onChange={(pts) => { setCurvePoints(pts); setCurvePreset("custom"); }} />
              <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
                Click to add a point • drag to move • double-click a point to remove
              </p>
            </>
          )}
          {kind === "color-balance" && (
            <>
              <BalanceGroup
                title="Shadows"
                cyanRed={shCyanRed} magGreen={shMagGreen} yelBlue={shYelBlue}
                onCyanRed={setShCyanRed} onMagGreen={setShMagGreen} onYelBlue={setShYelBlue}
              />
              <BalanceGroup
                title="Midtones"
                cyanRed={midCyanRed} magGreen={midMagGreen} yelBlue={midYelBlue}
                onCyanRed={setMidCyanRed} onMagGreen={setMidMagGreen} onYelBlue={setMidYelBlue}
              />
              <BalanceGroup
                title="Highlights"
                cyanRed={hiCyanRed} magGreen={hiMagGreen} yelBlue={hiYelBlue}
                onCyanRed={setHiCyanRed} onMagGreen={setHiMagGreen} onYelBlue={setHiYelBlue}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={preserveLum} onChange={(e) => setPreserveLum(e.target.checked)} />
                Preserve luminosity
              </label>
            </>
          )}
          {kind === "vibrance" && (
            <>
              <SliderField label="Vibrance" value={vibrance} min={-100} max={100} onChange={setVibrance} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={livePreview} onChange={(e) => setLivePreview(e.target.checked)} />
                Live preview
              </label>
            </>
          )}
          {kind === "upscale" && (
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  style={{
                    flex: 1, height: 36, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: scale === s ? "var(--accent)" : "var(--secondary)",
                    color: scale === s ? "var(--accent-foreground)" : "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {s}× → {W * s}×{H * s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={confirm}
            style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer", background: "var(--primary)", color: "var(--primary-foreground)", border: "none", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{label} (px)</span>
      <input
        type="number" value={value} min={1} max={20000}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", height: 32, borderRadius: 6, padding: "0 8px", fontSize: 13, background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none", boxSizing: "border-box" }}
      />
    </label>
  );
}

function BalanceGroup({ title, cyanRed, magGreen, yelBlue, onCyanRed, onMagGreen, onYelBlue }: {
  title: string;
  cyanRed: number; magGreen: number; yelBlue: number;
  onCyanRed: (v: number) => void; onMagGreen: (v: number) => void; onYelBlue: (v: number) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{title}</span>
      <SliderField label="Cyan – Red" value={cyanRed} min={-100} max={100} onChange={onCyanRed} />
      <SliderField label="Magenta – Green" value={magGreen} min={-100} max={100} onChange={onMagGreen} />
      <SliderField label="Yellow – Blue" value={yelBlue} min={-100} max={100} onChange={onYelBlue} />
    </div>
  );
}

function SliderField({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </div>
  );
}

function ChannelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>Channel</div>
      <div style={{ display: "flex", gap: 6 }}>
        {["rgb", "r", "g", "b"].map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              flex: 1, height: 30, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: value === c ? "var(--accent)" : "var(--secondary)",
              color: value === c ? "var(--accent-foreground)" : "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {c === "rgb" ? "RGB" : c.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

const CURVE_SIZE = 260;

function toSvg(p: CurvePoint): { cx: number; cy: number } {
  return { cx: (p.x / 255) * CURVE_SIZE, cy: CURVE_SIZE - (p.y / 255) * CURVE_SIZE };
}

function fromSvg(cx: number, cy: number): CurvePoint {
  return {
    x: Math.max(0, Math.min(255, Math.round((cx / CURVE_SIZE) * 255))),
    y: Math.max(0, Math.min(255, Math.round(((CURVE_SIZE - cy) / CURVE_SIZE) * 255))),
  };
}

function curvePath(points: CurvePoint[]): string {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) return "";
  // Catmull-Rom → cubic Bézier for a smooth preview through control points
  let d = "";
  sorted.forEach((p, i) => {
    const { cx, cy } = toSvg(p);
    if (i === 0) {
      d += `M ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    } else {
      const s0 = toSvg(sorted[i - 1]);
      const s3 = toSvg(sorted[i]);
      const prev = toSvg(sorted[Math.max(0, i - 2)]);
      const next = toSvg(sorted[Math.min(sorted.length - 1, i + 1)]);
      const t1x = s0.cx + (s3.cx - prev.cx) / 6;
      const t1y = s0.cy + (s3.cy - prev.cy) / 6;
      const t2x = s3.cx - (next.cx - s0.cx) / 6;
      const t2y = s3.cy - (next.cy - s0.cy) / 6;
      d += ` C ${t1x.toFixed(1)} ${t1y.toFixed(1)}, ${t2x.toFixed(1)} ${t2y.toFixed(1)}, ${s3.cx.toFixed(1)} ${s3.cy.toFixed(1)}`;
    }
  });
  return d;
}

function CurveEditor({ points, onChange }: { points: CurvePoint[]; onChange: (pts: CurvePoint[]) => void }) {
  function svgPos(e: React.MouseEvent<SVGSVGElement>): { cx: number; cy: number } {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * CURVE_SIZE;
    const cy = ((e.clientY - rect.top) / rect.height) * CURVE_SIZE;
    return { cx: Math.max(0, Math.min(CURVE_SIZE, cx)), cy: Math.max(0, Math.min(CURVE_SIZE, cy)) };
  }

  function addPoint(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as SVGElement).getAttribute?.("data-pt") === "1") return;
    const { cx, cy } = svgPos(e);
    const next = [...points, fromSvg(cx, cy)].sort((a, b) => a.x - b.x).slice(0, 8);
    onChange(next);
  }

  function movePoint(i: number, moveEvt: MouseEvent) {
    const svg = (document.querySelector("[data-curve-svg]") as SVGSVGElement | null);
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = Math.max(0, Math.min(CURVE_SIZE, ((moveEvt.clientX - rect.left) / rect.width) * CURVE_SIZE));
    const cy = Math.max(0, Math.min(CURVE_SIZE, ((moveEvt.clientY - rect.top) / rect.height) * CURVE_SIZE));
    const np = fromSvg(cx, cy);
    const next = points.map((p, j) => (j === i ? np : p));
    next.sort((a, b) => a.x - b.x);
    onChange(next);
  }

  function removePoint(i: number) {
    if (points.length <= 2) return;
    onChange(points.filter((_, j) => j !== i));
  }

  const grid = [0.25, 0.5, 0.75].map((f) => f * CURVE_SIZE);

  return (
    <svg
      data-curve-svg
      viewBox={`0 0 ${CURVE_SIZE} ${CURVE_SIZE}`}
      onClick={addPoint}
      style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: "var(--secondary)", border: "1px solid var(--border)", cursor: "crosshair", touchAction: "none", userSelect: "none" }}
    >
      {grid.map((g) => (
        <g key={g} stroke="var(--border)" strokeWidth={1}>
          <line x1={g} y1={0} x2={g} y2={CURVE_SIZE} />
          <line x1={0} y1={g} x2={CURVE_SIZE} y2={g} />
        </g>
      ))}
      <line x1={0} y1={CURVE_SIZE} x2={CURVE_SIZE} y2={0} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
      <path d={curvePath(points)} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p, i) => {
        const { cx, cy } = toSvg(p);
        return (
          <circle
            key={i}
            data-pt="1"
            cx={cx}
            cy={cy}
            r={7}
            fill="var(--accent-foreground)"
            stroke="var(--accent)"
            strokeWidth={2.5}
            style={{ cursor: "grab" }}
            onDoubleClick={(e) => { e.stopPropagation(); removePoint(i); }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const up = (mv: MouseEvent) => {
                movePoint(i, mv);
                if (mv.buttons === 0) {
                  window.removeEventListener("mousemove", up);
                  window.removeEventListener("mouseup", done);
                }
              };
              const done = () => {
                window.removeEventListener("mousemove", up);
                window.removeEventListener("mouseup", done);
              };
              window.addEventListener("mousemove", up);
              window.addEventListener("mouseup", done);
            }}
          />
        );
      })}
    </svg>
  );
}
