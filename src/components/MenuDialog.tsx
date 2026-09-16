import { useState } from "react";

export type DialogKind =
  | "resize-canvas"
  | "image-size"
  | "blur"
  | "sharpen"
  | "brightness-contrast"
  | "hue-saturation"
  | "vignette"
  | "upscale";

const TITLES: Record<DialogKind, string> = {
  "resize-canvas": "Resize Canvas",
  "image-size": "Image Size",
  blur: "Gaussian Blur",
  sharpen: "Sharpen (Unsharp Mask)",
  "brightness-contrast": "Brightness / Contrast",
  "hue-saturation": "Hue / Saturation",
  vignette: "Vignette",
  upscale: "AI Upscale",
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
