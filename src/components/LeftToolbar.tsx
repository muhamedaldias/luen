import { useState } from "react";
import {
  MousePointer2,
  Crop,
  Brush,
  Type,
  Square,
  Wand2,
  Lasso,
  Eraser,
  Pipette,
  Hand,
  ZoomIn,
  Images,
} from "lucide-react";

type ToolId =
  | "select"
  | "crop"
  | "brush"
  | "text"
  | "shape"
  | "smart-select"
  | "magic-wand"
  | "quick-select"
  | "eraser"
  | "eyedropper"
  | "pan"
  | "zoom";

interface Tool {
  id: ToolId;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

const tools: Tool[] = [
  { id: "select", icon: <MousePointer2 size={18} strokeWidth={1.75} />, label: "Select", shortcut: "V" },
  { id: "crop", icon: <Crop size={18} strokeWidth={1.75} />, label: "Crop", shortcut: "C" },
  { id: "brush", icon: <Brush size={18} strokeWidth={1.75} />, label: "Brush", shortcut: "B" },
  { id: "eraser", icon: <Eraser size={18} strokeWidth={1.75} />, label: "Eraser", shortcut: "E" },
  { id: "text", icon: <Type size={18} strokeWidth={1.75} />, label: "Text", shortcut: "T" },
  { id: "shape", icon: <Square size={18} strokeWidth={1.75} />, label: "Shape", shortcut: "U" },
  { id: "smart-select", icon: <Wand2 size={18} strokeWidth={1.75} />, label: "Smart Select", shortcut: "W" },
  { id: "quick-select", icon: <Lasso size={18} strokeWidth={1.75} />, label: "Quick Select", shortcut: "Q" },
  { id: "eyedropper", icon: <Pipette size={18} strokeWidth={1.75} />, label: "Eyedropper", shortcut: "I" },
];

const navTools: Tool[] = [
  { id: "pan", icon: <Hand size={18} strokeWidth={1.75} />, label: "Pan", shortcut: "H" },
  { id: "zoom", icon: <ZoomIn size={18} strokeWidth={1.75} />, label: "Zoom", shortcut: "Z" },
];

interface LeftToolbarProps {
  activeTool?: ToolId;
  onToolChange?: (tool: ToolId) => void;
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
}

export default function LeftToolbar({ activeTool = "select", onToolChange, libraryOpen = false, onToggleLibrary }: LeftToolbarProps) {
  return (
    <div
      className="flex flex-col items-center py-3 gap-2 h-full overflow-y-auto overflow-x-hidden"
      style={{
        width: 72,
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
        scrollbarWidth: "thin",
      }}
    >
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeTool === tool.id}
          onClick={() => onToolChange?.(tool.id)}
        />
      ))}

      {/* Library — قسم إدراج المحتوى (ليس أداة) */}
      <div className="w-7 my-1" style={{ borderTop: "1px solid var(--border)" }} />
      <LibraryButton open={libraryOpen} onClick={onToggleLibrary} />

      {/* Divider */}
      <div className="w-7 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {navTools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={activeTool === tool.id}
          onClick={() => onToolChange?.(tool.id)}
        />
      ))}
    </div>
  );
}

function LibraryButton({ open, onClick }: { open: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative flex items-center">
      <button
        onClick={onClick}
        aria-pressed={open}
        className="flex items-center justify-center rounded transition-all duration-100"
        style={{
          width: 48,
          height: 48,
          color: open || hovered ? "var(--accent)" : "var(--muted-foreground)",
          background: open
            ? "color-mix(in srgb, var(--accent) 18%, transparent)"
            : hovered
              ? "var(--secondary)"
              : "color-mix(in srgb, var(--accent) 7%, transparent)",
          border: open ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)" : "1px solid transparent",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Asset Library"
        aria-label="Asset Library"
      >
        <Images size={18} strokeWidth={1.75} />
      </button>

      {hovered && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1 text-sm whitespace-nowrap z-50 pointer-events-none flex items-center gap-2"
          style={{
            background: "var(--elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--foreground)",
          }}
        >
          Library
          <span
            className="text-sm px-1.5 rounded"
            style={{ color: "var(--muted-foreground)", background: "var(--secondary)", fontFamily: "monospace" }}
          >
            L
          </span>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  tool,
  active,
  onClick,
}: {
  tool: Tool;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    console.log(`[toolbar] click tool=${tool.id}`);
    onClick();
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleClick}
        className="flex items-center justify-center rounded transition-all duration-100"
        style={{
          width: 48,
          height: 48,
          color: active ? "var(--accent-foreground)" : hovered ? "var(--foreground)" : "var(--muted-foreground)",
          background: active
            ? "var(--accent)"
            : hovered
              ? "var(--secondary)"
              : "transparent",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={tool.label}
      >
        {tool.icon}
      </button>

      {hovered && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1 text-sm whitespace-nowrap z-50 pointer-events-none flex items-center gap-2"
          style={{
            background: "var(--elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--foreground)",
            transition: "opacity 100ms ease",
          }}
        >
          {tool.label}
          {tool.shortcut && (
            <span
              className="text-sm px-1.5 rounded"
              style={{
                color: "var(--muted-foreground)",
                background: "var(--secondary)",
                fontFamily: "monospace",
              }}
            >
              {tool.shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
