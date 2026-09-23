import { useState, useRef, useEffect, useCallback } from "react";
import { Undo2, Redo2, Save, Download, ChevronDown, Settings, PanelRightClose, PanelRightOpen, CircleQuestionMark } from "lucide-react";
import { FilterInfoCard } from "./FilterInfoCard";
import { FILTER_INFO, prewarmFilterPreviews } from "../lib/filterPreviews";

/** دليل الاستخدام العربي (PDF) — يُخدم من public/ فيُنسخ إلى dist تلقائياً عند البناء. */
const GUIDE_URL = `${import.meta.env.BASE_URL}Lumen-User-Guide-AR.pdf`;
const GUIDE_FILENAME = "Lumen-User-Guide-AR.pdf";

/**
 * تحميل الدليل كـ blob لإجبار التنزيل بدل معاينة المتصفح المدمجة للـ PDF،
 * مع fallback لفتح الدليل في تبويب جديد (مفيد في WebView سطح المكتب حيث
 * قد يُتجاهل download attribute).
 */
async function downloadUserGuide(): Promise<void> {
  try {
    const res = await fetch(GUIDE_URL);
    if (!res.ok) throw new Error(`guide fetch failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = GUIDE_FILENAME;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    window.open(GUIDE_URL, "_blank", "noopener");
  }
}

type MenuKey = "file" | "edit" | "image" | "select" | "layer" | "filter" | null;

interface MenuSection {
  title: string;
  items: string[];
}

const menus: { key: MenuKey; label: string; items?: string[]; sections?: MenuSection[] }[] = [
  {
    key: "file",
    label: "File",
    items: ["New…", "Open…", "Open Project…", "Open Recent", "—", "Save", "Save As…", "Export As…", "Save Project…", "—", "Close"],
  },
  {
    key: "edit",
    label: "Edit",
    items: ["Undo", "Redo", "—", "Cut", "Copy", "Paste", "—", "Preferences…"],
  },
  {
    key: "image",
    label: "Image",
    items: ["Resize Canvas…", "Crop to Selection", "Rotate 90° CW", "Rotate 90° CCW", "Flip Horizontal", "Flip Vertical", "—", "Image Size…"],
  },
  {
    key: "select",
    label: "Select",
    items: ["Select All", "Invert Selection", "Clear Selection", "—", "Feather Selection…", "Mask from Selection"],
  },
  {
    key: "layer",
    label: "Layer",
    items: [
      "New Layer…",
      "New Image Layer…",
      "New Shape…",
      "New Solid Fill…",
      "—",
      "Duplicate Layer",
      "Delete Layer",
      "—",
      "Bring Forward",
      "Send Backward",
      "Bring to Front",
      "Send to Back",
      "—",
      "Group Selected",
      "—",
      "Align Left",
      "Align Center",
      "Align Right",
      "Align Top",
      "Align Middle",
      "Align Bottom",
      "—",
      "Merge Down",
      "Flatten Image",
      "—",
      "Add Mask (White)",
      "Add Mask (Black)",
      "Disable/Enable Mask",
      "Remove Mask",
      "Apply Mask",
    ],
  },
  {
    key: "filter",
    label: "Filter",
    sections: [
      { title: "Adjust", items: ["Brightness / Contrast…", "Hue / Saturation…", "Color Balance…", "Vibrance…", "Levels…", "Curves…"] },
      { title: "Effects", items: ["Blur…", "Sharpen…", "Vignette…"] },
      { title: "One-click", items: ["Grayscale", "Sepia", "Auto Enhance", "Pro Enhance"] },
      { title: "AI tools", items: ["Blend Two Images…", "Remove Object…", "AI Upscale…"] },
      { title: "Presets", items: ["Save Preset", "Load Presets…", "Export Presets…"] },
    ],
  },
];

interface TopBarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  saveState?: "saved" | "saving" | "unsaved";
  onSettingsOpen?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onRemoveBackground?: () => void;
  onMenuAction?: (item: string) => void;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
}

export default function TopBar({ canUndo = false, canRedo = false, onUndo, onRedo, saveState = "saved", onSettingsOpen, onSave, onExport, onOpen, onNew, onSaveProject, onOpenProject, onRemoveBackground, onMenuAction, panelOpen = true, onTogglePanel }: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [infoCard, setInfoCard] = useState<{ label: string; itemRect: DOMRect; panelRect: DOMRect } | null>(null);
  const infoVisibleRef = useRef(false);
  const cardEnterTimer = useRef(0);
  const cardHideTimer = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (openMenu === "filter") {
      prewarmFilterPreviews();
      return;
    }
    window.clearTimeout(cardEnterTimer.current);
    window.clearTimeout(cardHideTimer.current);
    infoVisibleRef.current = false;
    setInfoCard(null);
  }, [openMenu]);

  useEffect(
    () => () => {
      window.clearTimeout(cardEnterTimer.current);
      window.clearTimeout(cardHideTimer.current);
    },
    []
  );

  function scheduleInfoCard(item: string, el: HTMLElement) {
    window.clearTimeout(cardEnterTimer.current);
    window.clearTimeout(cardHideTimer.current);
    const capture = () => {
      const panel = el.closest("[data-menu-panel]");
      if (!panel) return;
      setInfoCard({ label: item, itemRect: el.getBoundingClientRect(), panelRect: panel.getBoundingClientRect() });
    };
    if (infoVisibleRef.current) {
      capture();
    } else {
      cardEnterTimer.current = window.setTimeout(() => {
        infoVisibleRef.current = true;
        capture();
      }, 220);
    }
  }

  function hideInfoCardSoon() {
    window.clearTimeout(cardEnterTimer.current);
    window.clearTimeout(cardHideTimer.current);
    cardHideTimer.current = window.setTimeout(() => {
      infoVisibleRef.current = false;
      setInfoCard(null);
    }, 140);
  }

  function handlePanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>, key: MenuKey) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-menu-item]"));
    if (!items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const activeIdx = items.indexOf(document.activeElement as HTMLButtonElement);
      const nextIdx =
        activeIdx === -1
          ? e.key === "ArrowDown"
            ? 0
            : items.length - 1
          : e.key === "ArrowDown"
            ? (activeIdx + 1) % items.length
            : (activeIdx - 1 + items.length) % items.length;
      items[nextIdx]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpenMenu(null);
      menuRef.current?.querySelector<HTMLButtonElement>(`button[data-menu-trigger="${key}"]`)?.focus();
    }
  }

  function renderMenuItem(item: string, key: string) {
    const hasInfo = item in FILTER_INFO;
    return (
      <button
        key={key}
        data-menu-item
        role="menuitem"
        className="w-full text-left px-3 py-1.5 text-sm transition-colors duration-75"
        style={{ color: "var(--foreground)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--secondary)";
          if (hasInfo) scheduleInfoCard(item, e.currentTarget);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          if (hasInfo) hideInfoCardSoon();
        }}
        onFocus={(e) => {
          e.currentTarget.scrollIntoView({ block: "nearest" });
          if (hasInfo) scheduleInfoCard(item, e.currentTarget);
        }}
        onBlur={() => {
          if (hasInfo) hideInfoCardSoon();
        }}
        onClick={() => {
          setOpenMenu(null);
          handleMenuAction(item);
        }}
      >
        {item}
      </button>
    );
  }

  function handleMenuAction(item: string) {
    console.log(`[topbar] action ${item}`);
    switch (item) {
      case "New…":
        onNew?.();
        break;
      case "Open…":
      case "Open Recent":
        onOpen?.();
        break;
      case "Open Project…":
        onOpenProject?.();
        break;
      case "Save Project…":
        onSaveProject?.();
        break;
      case "Save":
      case "Save As…":
        onSave?.();
        break;
      case "Export As…":
        onExport?.();
        break;
      case "Close":
        onNew?.();
        break;
      case "Undo":
        onUndo?.();
        break;
      case "Redo":
        onRedo?.();
        break;
      case "Preferences…":
        onSettingsOpen?.();
        break;
      case "Remove Background":
        onRemoveBackground?.();
        break;
      default:
        onMenuAction?.(item);
        break;
    }
  }

return (
     <div
       data-testid="top-bar"
       className="flex items-center h-[60px] px-4 gap-2 shrink-0"
       style={{
         background: "var(--card)",
         borderBottom: "1px solid var(--border)",
         zIndex: 50,
       }}
     >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3 select-none" style={{ color: "var(--accent)" }}>
        <LogoMark />
<span
  className="font-medium tracking-tight"
  style={{ color: "var(--foreground)", letterSpacing: "-0.01em", fontSize: 18 }}
>
  Lumen
</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

      {/* Menu bar */}
      <nav ref={menuRef} className="flex items-center gap-0.5 relative">
{menus.map((m) => (
           <div key={m.key} className="relative">
             <button
               data-menu-trigger={m.key}
               aria-haspopup="menu"
               aria-expanded={openMenu === m.key}
               className="relative flex items-center gap-0.5 px-4 h-10 rounded transition-colors duration-100"
               style={{
                 color: openMenu === m.key ? "var(--foreground)" : "var(--muted-foreground)",
                 background: openMenu === m.key ? "var(--secondary)" : "transparent",
                 fontWeight: openMenu === m.key ? 500 : 400,
                 fontSize: 14,
               }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown") return;
                e.preventDefault();
                if (openMenu === m.key) {
                  menuRef.current?.querySelector<HTMLButtonElement>("[data-menu-panel] button[data-menu-item]")?.focus();
                } else {
                  setOpenMenu(m.key);
                  requestAnimationFrame(() => {
                    menuRef.current?.querySelector<HTMLButtonElement>("[data-menu-panel] button[data-menu-item]")?.focus();
                  });
                }
              }}
              onClick={() => {
                console.log(`[topbar] menu ${m.key}`);
                setOpenMenu(openMenu === m.key ? null : m.key);
              }}
              onMouseEnter={() => openMenu && openMenu !== m.key && setOpenMenu(m.key)}
            >
              {m.label}
            </button>

{openMenu === m.key && (
               <div
                 data-menu-panel={m.key}
                 role="menu"
                 aria-label={m.label}
                 onKeyDown={(e) => handlePanelKeyDown(e, m.key)}
                 className="absolute top-full left-0 mt-0.5 min-w-44 z-50"
                 style={{
                    background: "var(--elevated)",
                   border: "1px solid var(--border)",
                   borderRadius: "var(--radius)",
                   boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                 }}
               >
                 <MenuScrollBox onScrollUser={hideInfoCardSoon}>
                   {m.sections
                     ? m.sections.map((s) => (
                         <div key={s.title} role="group" aria-label={s.title}>
                           <div
                             className="sticky top-0 z-10 px-3 pt-2 pb-1 text-[11px] font-medium"
                             style={{ color: "var(--muted-foreground)", background: "var(--elevated)" }}
                           >
                             {s.title}
                           </div>
                           {s.items.map((item) => renderMenuItem(item, `${s.title}-${item}`))}
                         </div>
                       ))
                     : m.items?.map((item, i) =>
                         item === "—" ? (
                           <div key={`sep-${i}`} role="separator" className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />
                         ) : (
                           renderMenuItem(item, `item-${i}`)
                         )
                       )}
                 </MenuScrollBox>
               </div>
             )}
          </div>
        ))}
        {infoCard && <FilterInfoCard label={infoCard.label} itemRect={infoCard.itemRect} panelRect={infoCard.panelRect} />}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save state indicator */}
      <div className="flex items-center gap-1.5 mr-3">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : "All changes saved"}
        </span>
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background:
              saveState === "saving"
                ? "var(--warning)"
                : saveState === "unsaved"
                  ? "var(--danger)"
                  : "var(--success)",
          }}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

      {/* Primary actions */}
      <div className="flex items-center gap-1 ml-1">
        <ActionBtn
          icon={<Undo2 size={15} />}
          label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          shortcut="⌘Z"
        />
        <ActionBtn
          icon={<Redo2 size={15} />}
          label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          shortcut="⌘⇧Z"
        />

        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

        <ActionBtn icon={<Save size={15} />} label="Save" shortcut="⌘S" onClick={onSave} />

        {/* Export — primary CTA */}
        <button
          className="flex items-center gap-1.5 px-4 h-10 rounded font-medium transition-colors duration-100"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            fontSize: 14,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          onClick={onExport}
        >
          <Download size={15} />
          Export
          <ChevronDown size={13} strokeWidth={2.5} />
        </button>

        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

        <div data-testid="help-guide-btn" title="تحميل دليل الاستخدام (PDF) — Download user guide">
          <ActionBtn
            icon={<CircleQuestionMark size={15} />}
            label="Help"
            onClick={() => void downloadUserGuide()}
          />
        </div>

        <ActionBtn
          icon={<Settings size={15} />}
          label="Settings"
          onClick={onSettingsOpen}
          shortcut="⌘,"
        />

        <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

        <ActionBtn
          icon={panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          label={panelOpen ? "Hide side panel" : "Show side panel"}
          onClick={onTogglePanel}
        />
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  disabled = false,
  onClick,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  shortcut?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={onClick}
        title={label}
        className="flex items-center justify-center w-10 h-10 rounded transition-colors duration-100"
        style={{
          color: disabled ? "var(--muted-foreground)" : hovered ? "var(--foreground)" : "var(--muted-foreground)",
          background: hovered && !disabled ? "var(--secondary)" : "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {icon}
      </button>

      {hovered && !disabled && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-sm whitespace-nowrap z-50 pointer-events-none"
          style={{
            background: "var(--elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--foreground)",
          }}
        >
          {label}
          {shortcut && <span className="ml-2" style={{ color: "var(--muted-foreground)" }}>{shortcut}</span>}
        </div>
      )}
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="14" rx="1.5" fill="currentColor" />
      <rect x="10" y="2" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="10" y="12" width="6" height="4" rx="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/**
 * Scrollable menu body: caps height to the viewport so long menus (Filter,
 * Layer) never overflow the screen, with fade edges shown only while
 * scrollable in that direction.
 */
function MenuScrollBox({ children, onScrollUser }: { children: React.ReactNode; onScrollUser?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setFade((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={onScrollUser}
        className="overflow-y-auto overscroll-contain py-1"
        style={{ maxHeight: "calc(100vh - 96px)" }}
      >
        {children}
      </div>
      {fade.top && (
        <div
          className="pointer-events-none absolute top-0 right-0 left-0 h-3"
          style={{ background: "linear-gradient(to bottom, var(--elevated), transparent)" }}
        />
      )}
      {fade.bottom && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 left-0 h-3"
          style={{ background: "linear-gradient(to top, var(--elevated), transparent)" }}
        />
      )}
    </div>
  );
}
