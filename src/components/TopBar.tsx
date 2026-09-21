import { useState, useRef, useEffect } from "react";
import { Undo2, Redo2, Save, Download, ChevronDown, Settings, PanelRightClose, PanelRightOpen } from "lucide-react";

type MenuKey = "file" | "edit" | "image" | "select" | "layer" | "filter" | null;

const menus: { key: MenuKey; label: string; items: string[] }[] = [
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
    items: [
      "Blur…",
      "Sharpen…",
      "Brightness / Contrast…",
      "Hue / Saturation…",
      "Color Balance…",
      "Vibrance…",
      "Levels…",
      "Curves…",
      "Grayscale",
      "Sepia",
      "Vignette…",
      "Auto Enhance",
      "Pro Enhance",
      "—",
      "Blend Two Images…",
      "Remove Object…",
      "AI Upscale…",
      "—",
      "Save Preset",
      "Load Presets…",
      "Export Presets…",
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
               className="relative flex items-center gap-0.5 px-4 h-10 rounded transition-colors duration-100"
               style={{
                 color: openMenu === m.key ? "var(--foreground)" : "var(--muted-foreground)",
                 background: openMenu === m.key ? "var(--secondary)" : "transparent",
                 fontWeight: openMenu === m.key ? 500 : 400,
                 fontSize: 14,
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
                 className="absolute top-full left-0 mt-0.5 py-1 min-w-44 z-50"
                 style={{
                    background: "var(--elevated)",
                   border: "1px solid var(--border)",
                   borderRadius: "var(--radius)",
                   boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                 }}
               >
                 {m.items.map((item, i) =>
                   item === "—" ? (
                     <div key={i} className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />
                   ) : (
                     <button
                       key={i}
                       className="w-full text-left px-3 py-1.5 text-sm transition-colors duration-75"
                       style={{ color: "var(--foreground)" }}
                       onMouseEnter={(e) => (e.currentTarget.style.background = "var(--secondary)")}
                       onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                       onClick={() => {
                         setOpenMenu(null);
                         handleMenuAction(item);
                       }}
                     >
                       {item}
                     </button>
                   )
                 )}
               </div>
             )}
          </div>
        ))}
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
