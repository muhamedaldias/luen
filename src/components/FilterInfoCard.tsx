// Hover info card for Filter menu items: name, tag, live before/after preview
// rendered through the real filter pipeline, description and a behavior hint.
// Rendered in a portal so the scrollable menu never clips it.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FILTER_INFO, getFilterPreview, getSampleUrl } from "../lib/filterPreviews";

const CARD_W = 268;
const EDGE = 8;

export function FilterInfoCard({
  label,
  itemRect,
  panelRect,
}: {
  label: string;
  itemRect: DOMRect;
  panelRect: DOMRect;
}) {
  const info = FILTER_INFO[label];
  // undefined = still generating, null = not previewable
  const [preview, setPreview] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setPreview(undefined);
    void getFilterPreview(label).then((url) => {
      if (alive) setPreview(url);
    });
    return () => {
      alive = false;
    };
  }, [label]);

  if (!info) return null;

  let left = panelRect.right + 10;
  if (left + CARD_W > window.innerWidth - EDGE) {
    left = Math.max(EDGE, itemRect.left - CARD_W - 10);
  }
  const top = Math.max(EDGE, Math.min(itemRect.top - 10, window.innerHeight - 224 - EDGE));

  return createPortal(
    <div
      data-menu-card
      role="tooltip"
      className="fixed z-[60] pointer-events-none select-none"
      style={{
        left,
        top,
        width: CARD_W,
        animation: "menu-card-in 170ms cubic-bezier(0.16, 1, 0.3, 1) both",
        background: "color-mix(in srgb, var(--elevated) 92%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <span className="text-[13px] font-medium tracking-tight truncate" style={{ color: "var(--foreground)" }}>
          {label.replace(/…$/, "")}
        </span>
        <span
          className="px-2 py-px rounded-full text-[10px] font-medium shrink-0"
          style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 15%, transparent)" }}
        >
          {info.tag}
        </span>
      </div>

      {info.spec && (
        <div className="flex gap-1.5 px-3 pt-1">
          <Thumb src={getSampleUrl()} text="Before" />
          <Thumb src={preview ?? undefined} text="After" accent loading={preview === undefined} />
        </div>
      )}

      <p className="px-3 pt-2 pb-1 text-[11.5px] leading-snug" style={{ color: "var(--muted-foreground)" }}>
        {info.desc}
      </p>

      {info.hint && (
        <div className="px-3 pb-2.5 text-[10px] font-medium" style={{ color: "var(--muted-foreground)", opacity: 0.8 }}>
          {info.hint}
        </div>
      )}
    </div>,
    document.body
  );
}

function Thumb({
  src,
  text,
  accent = false,
  loading = false,
}: {
  src?: string;
  text: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className="relative flex-1 h-[80px] rounded-[5px] overflow-hidden"
      style={{
        border: accent ? "1px solid color-mix(in srgb, var(--accent) 40%, var(--border))" : "1px solid var(--border)",
        background: "var(--secondary)",
      }}
    >
      {loading && <div className="menu-card-shimmer absolute inset-0" />}
      {!loading && src && <img src={src} alt="" draggable={false} className="block w-full h-full object-cover" />}
      <span
        className="absolute bottom-1 left-1.5 text-[9px] font-medium tracking-wide"
        style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {text}
      </span>
    </div>
  );
}
