import { useEffect, useRef, useState } from "react";

interface MaskEditorProps {
  imageUrl: string;
  busy?: boolean;
  onClose: () => void;
  onApply: (maskDataUrl: string) => void;
}

/** رسم قناع أبيض فوق الصورة لإزالة العنصر (inpaint)। */
export default function MaskEditor({ imageUrl, busy = false, onClose, onApply }: MaskEditorProps) {
  const [brush, setBrush] = useState(28);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const img = imgRef.current;
      const c = maskRef.current;
      if (!img || !c) return;
      const r = img.getBoundingClientRect();
      if (r.width < 10) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, r.width, r.height);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    const id = window.setTimeout(sync, 60);
    window.addEventListener("resize", sync);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", sync);
    };
  }, [imageUrl]);

  function pos(e: React.PointerEvent) {
    const c = maskRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent) {
    drawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const ctx = maskRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = brush;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function move(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = maskRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function up() {
    drawingRef.current = false;
  }

  function clear() {
    const c = maskRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, r.width, r.height);
  }

  function apply() {
    const c = maskRef.current;
    if (!c) return;
    onApply(c.toDataURL("image/png"));
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: "92vw", maxHeight: "92vh", borderRadius: 12, padding: 16,
          background: "var(--card)", border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column", gap: 10, overflow: "auto",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Remove Object</h3>
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
          Paint white over the object to remove — AI inpaint fills it from surrounding pixels.
        </p>
        <div style={{ position: "relative", display: "inline-block", alignSelf: "center", cursor: "crosshair", touchAction: "none" }}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt="mask target"
            draggable={false}
            style={{ display: "block", maxWidth: "70vw", maxHeight: "56vh", borderRadius: 6, userSelect: "none" }}
          />
          <canvas
            ref={maskRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            style={{ position: "absolute", left: 0, top: 0, opacity: 0.55, borderRadius: 6 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Brush</span>
          <input type="range" min={6} max={80} value={brush} onChange={(e) => setBrush(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--accent)" }} />
          <span style={{ fontSize: 12, color: "var(--foreground)", minWidth: 36 }}>{brush}px</span>
          <button onClick={clear} style={{ height: 30, padding: "0 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            Clear
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={apply}
            style={{ flex: 1, height: 34, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer", background: "var(--primary)", color: "var(--primary-foreground)", border: "none", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Removing…" : "Remove object"}
          </button>
        </div>
      </div>
    </div>
  );
}
