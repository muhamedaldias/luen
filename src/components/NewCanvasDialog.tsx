import { useState } from "react";

export interface NewCanvasOpts {
  width: number;
  height: number;
  background: string | null;
}

interface Props {
  onClose: () => void;
  onConfirm: (opts: NewCanvasOpts) => void;
}

const PRESETS = [
  { label: "HD 16:9", w: 1920, h: 1080 },
  { label: "Square", w: 1080, h: 1080 },
  { label: "Story 9:16", w: 1080, h: 1920 },
  { label: "Poster 4:5", w: 1600, h: 2000 },
] as const;

const BACKGROUNDS: { label: string; value: string | null }[] = [
  { label: "None", value: null },
  { label: "Dark", value: "#1C1B1A" },
  { label: "White", value: "#FFFFFF" },
  { label: "Ember", value: "#C97B4A" },
  { label: "Ink", value: "#141312" },
];

export default function NewCanvasDialog({ onClose, onConfirm }: Props) {
  const [w, setW] = useState(1920);
  const [h, setH] = useState(1080);
  const [bg, setBg] = useState<string | null>("#1C1B1A");
  const [customBg, setCustomBg] = useState("#5B90D4");

  function confirm() {
    const width = Math.max(64, Math.min(12000, Math.round(w) || 1920));
    const height = Math.max(64, Math.min(12000, Math.round(h) || 1080));
    onConfirm({ width, height, background: bg });
  }

  const field: React.CSSProperties = {
    height: 34,
    borderRadius: 6,
    background: "var(--secondary)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    padding: "0 10px",
    fontSize: 13,
    width: "100%",
    minWidth: 0,
    outline: "none",
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: "100%", borderRadius: 12, padding: 18, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>New canvas</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          ابدأ تصميمًا من الصفر: اختر المقاس ولون الخلفية — ثم أضف نصوصًا وأشكالًا وصورًا وصّدر بأي مقاس.
        </p>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>Size preset</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setW(p.w); setH(p.h); }}
              style={{
                height: 34, borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: w === p.w && h === p.h ? "var(--accent)" : "var(--secondary)",
                color: w === p.w && h === p.h ? "var(--accent-foreground)" : "var(--foreground)",
                border: "1px solid var(--border)", fontWeight: w === p.w && h === p.h ? 600 : 400,
              }}
            >
              {p.label} · {p.w}×{p.h}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Width px</span>
            <input type="number" value={w} min={64} max={12000} onChange={(e) => setW(Number(e.target.value))} style={field} />
          </label>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Height px</span>
            <input type="number" value={h} min={64} max={12000} onChange={(e) => setH(Number(e.target.value))} style={field} />
          </label>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>Background fill</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {BACKGROUNDS.map((b) => (
            <button
              key={b.label}
              onClick={() => setBg(b.value)}
              title={b.label}
              style={{
                flex: 1, height: 34, borderRadius: 6, fontSize: 11, cursor: "pointer",
                background: b.value ?? "transparent",
                color: b.value === "#FFFFFF" ? "#141312" : "var(--foreground)",
                border: bg === b.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                minWidth: 0,
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <input type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} style={{ width: 40, height: 30, padding: 0, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }} />
          <button
            onClick={() => setBg(customBg)}
            style={{ flex: 1, height: 30, borderRadius: 6, fontSize: 12, cursor: "pointer", background: bg === customBg ? "var(--accent)" : "var(--secondary)", color: bg === customBg ? "var(--accent-foreground)" : "var(--foreground)", border: "1px solid var(--border)" }}
          >
            Custom {customBg}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 36, borderRadius: 6, fontSize: 13, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button onClick={confirm} style={{ flex: 2, height: 36, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}>
            Create {w}×{h}
          </button>
        </div>
      </div>
    </div>
  );
}
