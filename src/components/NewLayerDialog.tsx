import { useRef, useState } from "react";
import { Type, Image as ImageIcon, Square, Circle, Minus, ArrowRight, Droplet } from "lucide-react";

export type NewLayerChoice =
  | { kind: "text" }
  | { kind: "image"; url: string; name: string }
  | { kind: "shape"; shape: "rect" | "ellipse" | "line" | "arrow" }
  | { kind: "solid"; color: string };

interface Props {
  onClose: () => void;
  onPick: (c: NewLayerChoice) => void;
}

export default function NewLayerDialog({ onClose, onPick }: Props) {
  const [solidColor, setSolidColor] = useState("#C97B4A");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onPick({ kind: "image", url: reader.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  const card: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    background: "var(--secondary)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: "100%", borderRadius: 12, padding: 18, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>New Layer</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          Pick a layer type. All types support show/hide, opacity, move, and delete — everything flattens on save.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={card} onClick={() => onPick({ kind: "text" })}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              <Type size={15} /> Text layer
            </span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Headline/paragraph with fonts, colors, gradients, and shadows — edited in the Design tab.</span>
          </button>
          <button style={card} onClick={() => fileRef.current?.click()}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              <ImageIcon size={15} /> Image layer
            </span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Composite a second image on top (logo/element/blend) with scaling and transparency.</span>
          </button>
          <div style={{ ...card, cursor: "default" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              <Square size={15} /> Shape layer
            </span>
            <div style={{ display: "flex", gap: 6, width: "100%" }}>
              {(
                [
                  { k: "rect", icon: <Square size={13} />, label: "Rectangle" },
                  { k: "ellipse", icon: <Circle size={13} />, label: "Ellipse" },
                  { k: "line", icon: <Minus size={13} />, label: "Line" },
                  { k: "arrow", icon: <ArrowRight size={13} />, label: "Arrow" },
                ] as const
              ).map((s) => (
                <button
                  key={s.k}
                  onClick={() => onPick({ kind: "shape", shape: s.k })}
                  style={{ flex: 1, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, cursor: "pointer", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ ...card, cursor: "default" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
              <Droplet size={15} /> Solid fill
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
              <input type="color" value={solidColor} onChange={(e) => setSolidColor(e.target.value)} style={{ width: 40, height: 28, padding: 0, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }} />
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--foreground)" }}>{solidColor}</span>
              <button
                onClick={() => onPick({ kind: "solid", color: solidColor })}
                style={{ flex: 1, height: 30, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--primary)", color: "var(--primary-foreground)", border: "none" }}
              >
                Add fill
              </button>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 12, width: "100%", height: 32, borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
          Cancel
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
