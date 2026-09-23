// درج مكتبة الأصول: يزلق من اليسار فوق الكانفس — بحث + خلفيات/منتجات + فئات
// + شبكة 3 أعمدة. كل بطاقة: سحب وإفلات على الكانفس، أو زر + (أو نقرة) للإدراج المركزي.
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X, Mountain, Package } from "lucide-react";
import { ASSET_LIST, assetDataUrl, type AssetDef, type AssetKind } from "../lib/assetLibrary";

export default function AssetsDrawer({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (asset: AssetDef) => void;
}) {
  const [kind, setKind] = useState<AssetKind>("background");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const assets = useMemo(
    () =>
      ASSET_LIST.filter(
        (a) =>
          a.kind === kind &&
          (category === "All" || a.category === category) &&
          (query.trim() === "" || a.name.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [kind, category, query]
  );
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(ASSET_LIST.filter((a) => a.kind === kind).map((a) => a.category)))],
    [kind]
  );
  const items = useMemo(() => assets.map((a) => ({ asset: a, url: assetDataUrl(a) })), [assets]);

  function switchKind(k: AssetKind) {
    setKind(k);
    setCategory("All");
  }

  if (!open) return null;

  return (
    <aside
      data-assets-drawer
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed flex flex-col drawer-in"
      style={{
        left: 72,
        top: 60,
        bottom: 32,
        width: 380,
        zIndex: 70,
        background: "color-mix(in srgb, var(--card) 92%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--border)",
        borderLeft: "none",
        borderRadius: "0 var(--radius) var(--radius) 0",
        boxShadow: "24px 0 64px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}
      aria-label="Asset library"
    >
      {/* الرأس */}
      <div className="shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Asset Library</h3>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              {ASSET_LIST.filter((a) => a.kind === "background").length} backgrounds · {ASSET_LIST.filter((a) => a.kind === "product").length} products
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close library"
            className="flex items-center justify-center w-7 h-7 rounded transition-colors duration-100"
            style={{ color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.background = "var(--secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.background = "transparent"; }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div
          className="flex items-center gap-2 h-8 px-2.5 rounded"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          <Search size={13} strokeWidth={2} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: "var(--foreground)", minWidth: 0 }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="flex gap-1 mt-2">
          <button
            onClick={() => switchKind("background")}
            className="flex-1 h-7 rounded text-[11px] flex items-center justify-center gap-1.5"
            style={{
              background: kind === "background" ? "var(--accent)" : "var(--secondary)",
              color: kind === "background" ? "var(--accent-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontWeight: kind === "background" ? 600 : 400,
              minWidth: 0,
            }}
          >
            <Mountain size={12} strokeWidth={2} /> Backgrounds
          </button>
          <button
            onClick={() => switchKind("product")}
            className="flex-1 h-7 rounded text-[11px] flex items-center justify-center gap-1.5"
            style={{
              background: kind === "product" ? "var(--accent)" : "var(--secondary)",
              color: kind === "product" ? "var(--accent-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontWeight: kind === "product" ? 600 : 400,
              minWidth: 0,
            }}
          >
            <Package size={12} strokeWidth={2} /> Products
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto mt-2" style={{ minWidth: 0, scrollbarWidth: "none" }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="h-6 px-2.5 rounded-full text-[10px] font-medium whitespace-nowrap"
              style={{
                background: category === c ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--secondary)",
                color: category === c ? "var(--accent)" : "var(--muted-foreground)",
                border: "1px solid " + (category === c ? "var(--accent)" : "var(--border)"),
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* الشبكة */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5" style={{ minWidth: 0 }}>
        {items.length === 0 ? (
          <p className="text-[11px] text-center pt-8" style={{ color: "var(--muted-foreground)" }}>
            No assets match “{query}”.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2" style={{ minWidth: 0 }}>
            {items.map(({ asset, url }) => (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-lumen-asset", asset.id);
                  try { e.dataTransfer.effectAllowed = "copy"; } catch { /* noop */ }
                }}
                onClick={() => onAdd(asset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAdd(asset);
                  }
                }}
                className="group relative rounded-md overflow-hidden text-left outline-none focus-visible:ring-2"
                style={{ border: "1px solid var(--border)", background: "var(--secondary)", cursor: "grab", minWidth: 0 }}
                title={`${asset.name} — drag to canvas or click to insert`}
              >
                <div className={"relative h-[64px] " + (asset.kind === "product" ? "checker-bg" : "")}>
                  <img
                    src={url}
                    alt={asset.name}
                    draggable={false}
                    className="block w-full h-full transition-transform duration-150 group-hover:scale-[1.05]"
                    style={{ objectFit: asset.kind === "product" ? "contain" : "cover" }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(asset);
                    }}
                    title="Insert"
                    aria-label={`Insert ${asset.name}`}
                    className="absolute flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      background: "var(--accent)",
                      color: "var(--accent-foreground)",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] font-medium truncate" style={{ color: "var(--foreground)" }}>{asset.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-2 text-[9.5px]" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
        Drag onto the canvas to place precisely · click + to insert centered · Esc closes
      </div>
    </aside>
  );
}
