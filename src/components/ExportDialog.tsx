// حوار التصدير: اختيار الصيغة (PNG/JPG/WEBP) + الجودة + لون تسطيح الخلفية لـ JPG.
import { useState } from "react";

export interface ExportOptions {
  format: "png" | "jpeg" | "webp";
  quality: number;
  bg: string;
}

const FORMATS: { value: ExportOptions["format"]; name: string; desc: string; tag: string }[] = [
  { value: "png", name: "PNG", desc: "Lossless — keeps transparency", tag: "alpha" },
  { value: "jpeg", name: "JPG", desc: "Smallest files — flattens to a background color", tag: "small" },
  { value: "webp", name: "WEBP", desc: "Modern — small files with transparency", tag: "alpha" },
];

export default function ExportDialog({
  open,
  busy,
  defaults,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy?: string | null;
  defaults: ExportOptions;
  onClose: () => void;
  onConfirm: (opts: ExportOptions) => void;
}) {
  const [format, setFormat] = useState<ExportOptions["format"]>(defaults.format);
  const [quality, setQuality] = useState(defaults.quality);
  const [bg, setBg] = useState(defaults.bg);

  if (!open) return null;
  const lossy = format !== "png";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      className="flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Export image"
        className="w-full"
        style={{
          maxWidth: 400,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        }}
      >
        <div className="px-4 pt-3.5 pb-1">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Export image</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Flattened from all layers at full resolution — no quality loss beyond the chosen format.
          </p>
        </div>

        <div className="px-4 py-2 flex flex-col gap-1.5">
          {FORMATS.map((f) => {
            const active = format === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className="w-full text-left px-3 py-2 rounded-md transition-colors"
                style={{
                  background: active ? "color-mix(in srgb, var(--accent) 14%, var(--secondary))" : "var(--secondary)",
                  border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{
                    border: "2px solid " + (active ? "var(--accent)" : "var(--muted-foreground)"),
                    background: active ? "var(--accent)" : "transparent",
                  }}
                />
                <span className="min-w-0">
                  <span className="text-xs font-semibold block" style={{ color: "var(--foreground)" }}>
                    {f.name}
                    <span className="ml-2 font-medium" style={{ color: "var(--accent)", fontSize: 10 }}>{f.tag}</span>
                  </span>
                  <span className="text-[10.5px] block" style={{ color: "var(--muted-foreground)" }}>{f.desc}</span>
                </span>
              </button>
            );
          })}

          {lossy && (
            <label className="block mt-1 text-xs" style={{ color: "var(--foreground)" }}>
              Quality: {quality}%
              <input
                type="range"
                min={60}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Math.round(Number(e.target.value)))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </label>
          )}

          {format === "jpeg" && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Background for transparent areas</span>
              <input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="w-9 h-7 rounded cursor-pointer"
                style={{ border: "1px solid var(--border)", background: "var(--secondary)", padding: 2 }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded text-xs font-medium"
            style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ format, quality, bg })}
            disabled={!!busy}
            className="flex-1 h-9 rounded text-xs font-semibold"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", border: "none", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? busy : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
