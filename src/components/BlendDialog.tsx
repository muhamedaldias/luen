import { useRef, useState } from "react";
import { uploadImage } from "../lib/api";

export interface BlendParams {
  foregroundUrl: string;
  foregroundId: string | null;
  mode: string;
  scale: number;
  x: number;
  y: number;
  feather: number;
  colorMatch: boolean;
}

const MODES = [
  { v: "seamless_normal", label: "Seamless — Normal (Poisson)", hint: "Most accurate insert for matching light — best for products" },
  { v: "seamless_mixed", label: "Seamless — Mixed texture", hint: "Keeps background texture — best for surfaces (wood/fabric)" },
  { v: "seamless_mono", label: "Seamless — Mono + light transfer", hint: "Best when lighting differs between images" },
  { v: "pyramid", label: "Multi-band Laplacian pyramid", hint: "Best for panoramas and wide overlaps with no seam" },
  { v: "feather", label: "Soft feather + color match", hint: "Fastest — logo/element composite with soft edges" },
];

export default function BlendDialog({ busy = false, hasBackend = false, onClose, onConfirm }: { busy?: boolean; hasBackend?: boolean; onClose: () => void; onConfirm: (p: BlendParams) => void }) {
  const [fgUrl, setFgUrl] = useState<string | null>(null);
  const [fgId, setFgId] = useState<string | null>(null);
  const [fgName, setFgName] = useState("");
  const [mode, setMode] = useState("seamless_normal");
  const [scale, setScale] = useState(40);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [feather, setFeather] = useState(12);
  const [colorMatch, setColorMatch] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setFgName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFgUrl(reader.result as string);
    reader.readAsDataURL(file);
    if (hasBackend) {
      setUploading(true);
      try {
        const up = await uploadImage(file);
        setFgId(up.image_id);
      } catch {
        setFgId(null);
      } finally {
        setUploading(false);
      }
    }
  }

  const canGo = !!fgUrl && !uploading && !busy;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", borderRadius: 12, padding: 18, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>Blend Two Images — High-Quality OpenCV</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          The current image is the background. Pick the foreground image, then the best algorithm — all run in float32 and preserve transparency.
        </p>
        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", minHeight: 74, borderRadius: 8, cursor: "pointer", background: "var(--secondary)", color: "var(--foreground)", border: "1px dashed var(--border)", fontSize: 12, padding: 10 }}>
          {fgUrl ? (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={fgUrl} alt="fg" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
              <span style={{ textAlign: "left" }}>{fgName || "foreground"} {uploading ? "— uploading…" : fgId ? "— ready (backend)" : "— ready (local)"}<br /><span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Click to change image</span></span>
            </span>
          ) : ("Choose the foreground image (PNG/JPG)")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Algorithm</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MODES.map((m) => (
            <label key={m.v} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: mode === m.v ? "rgba(201,123,74,0.12)" : "var(--secondary)", border: mode === m.v ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
              <input type="radio" checked={mode === m.v} onChange={() => setMode(m.v)} style={{ marginTop: 2, accentColor: "var(--accent)" }} />
              <span><span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{m.label}</span><span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{m.hint}</span></span>
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <Slider label={`Foreground size ${scale}%`} value={scale} min={5} max={100} onChange={setScale} />
          <Slider label={`Edge feather ${feather}px`} value={feather} min={0} max={60} onChange={setFeather} />
          <Slider label={`Position X ${x}%`} value={x} min={0} max={100} onChange={setX} />
          <Slider label={`Position Y ${y}%`} value={y} min={0} max={100} onChange={setY} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--foreground)", cursor: "pointer" }}>
          <input type="checkbox" checked={colorMatch} onChange={(e) => setColorMatch(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          Automatic color match (Reinhard LAB) before blending — always recommended
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>Cancel</button>
          <button disabled={!canGo} onClick={() => fgUrl && onConfirm({ foregroundUrl: fgUrl, foregroundId: fgId, mode, scale, x, y, feather, colorMatch })} style={{ flex: 2, height: 34, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: canGo ? "pointer" : "not-allowed", background: "var(--primary)", color: "var(--primary-foreground)", border: "none", opacity: canGo ? 1 : 0.5 }}>
            {busy || uploading ? "Blending…" : "Blend images"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </label>
  );
}
