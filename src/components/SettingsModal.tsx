import { useState } from "react";
import {
  X,
  Palette,
  Monitor,
  Grid3x3,
  Keyboard,
  FileOutput,
  Info,
  ChevronRight,
  Check,
  Moon,
  Sun,
} from "lucide-react";
import { themes, type Theme } from "../themes";

type Section = "appearance" | "canvas" | "export" | "shortcuts" | "about";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (id: string) => void;
}

const sections: { id: Section; icon: React.ReactNode; label: string }[] = [
  { id: "appearance", icon: <Palette size={15} strokeWidth={1.75} />, label: "Appearance" },
  { id: "canvas", icon: <Monitor size={15} strokeWidth={1.75} />, label: "Canvas" },
  { id: "export", icon: <FileOutput size={15} strokeWidth={1.75} />, label: "Export" },
  { id: "shortcuts", icon: <Keyboard size={15} strokeWidth={1.75} />, label: "Shortcuts" },
  { id: "about", icon: <Info size={15} strokeWidth={1.75} />, label: "About" },
];

export default function SettingsModal({ open, onClose, currentTheme, onThemeChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<Section>("appearance");

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal */}
      <div
        className="flex overflow-hidden"
        style={{
          width: 760,
          height: 560,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Sidebar */}
        <div
          className="flex flex-col py-4 shrink-0"
          style={{
            width: 200,
            background: "var(--background)",
            borderRight: "1px solid var(--border)",
          }}
        >
          <p
            className="px-4 pb-3 text-xs font-medium tracking-wider"
            style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em" }}
          >
            SETTINGS
          </p>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className="flex items-center gap-2.5 px-4 py-2 mx-2 rounded text-sm transition-colors duration-100"
              style={{
                color: activeSection === s.id ? "var(--foreground)" : "var(--muted-foreground)",
                background: activeSection === s.id ? "var(--card)" : "transparent",
                fontWeight: activeSection === s.id ? 500 : 400,
                border: activeSection === s.id ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <span style={{ color: activeSection === s.id ? "var(--accent)" : "inherit" }}>{s.icon}</span>
              {s.label}
              {activeSection === s.id && (
                <ChevronRight size={12} strokeWidth={2} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {sections.find((s) => s.id === activeSection)?.label}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors duration-100"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--foreground)";
                e.currentTarget.style.background = "var(--secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--muted-foreground)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Section body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "appearance" && (
              <AppearanceSection currentTheme={currentTheme} onThemeChange={onThemeChange} />
            )}
            {activeSection === "canvas" && <CanvasSection />}
            {activeSection === "export" && <ExportSection />}
            {activeSection === "shortcuts" && <ShortcutsSection />}
            {activeSection === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Appearance ─────────────────────────────────────────── */

function AppearanceSection({ currentTheme, onThemeChange }: { currentTheme: string; onThemeChange: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-7">
      {/* Theme picker */}
      <SettingBlock title="Interface Theme" description="Choose a color scheme for the editor.">
        <div className="grid grid-cols-5 gap-3 pt-1">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={currentTheme === theme.id}
              onClick={() => onThemeChange(theme.id)}
            />
          ))}
        </div>
      </SettingBlock>

      {/* UI density */}
      <SettingBlock title="UI Density" description="Control spacing throughout the interface.">
        <ToggleGroup
          options={["Compact", "Default", "Relaxed"]}
          value="Default"
          onChange={() => {}}
        />
      </SettingBlock>

      {/* Font size */}
      <SettingBlock title="Interface Font Size" description="Base size for labels and menus.">
        <ToggleGroup
          options={["11px", "12px", "13px", "14px"]}
          value="13px"
          onChange={() => {}}
        />
      </SettingBlock>

      {/* Panel animations */}
      <SettingBlock title="Animations" description="Panel transitions and micro-interactions.">
        <ToggleRow label="Enable panel transitions" defaultValue={true} />
        <ToggleRow label="Show hover tooltips" defaultValue={true} />
      </SettingBlock>
    </div>
  );
}

function ThemeCard({ theme, active, onClick }: { theme: Theme; active: boolean; onClick: () => void }) {
  const [bg, accent, text] = theme.swatch;
  const isLight = bg > "#888";

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      {/* Swatch */}
      <div
        className="w-full rounded-lg overflow-hidden transition-all duration-150"
        style={{
          aspectRatio: "1",
          background: bg,
          border: active ? `2px solid ${accent}` : "2px solid var(--border)",
          boxShadow: active ? `0 0 0 2px ${accent}33` : "none",
          position: "relative",
        }}
      >
        {/* Mini editor chrome preview */}
        <div className="absolute inset-0 p-1.5 flex flex-col gap-1">
          {/* Top bar stripe */}
          <div
            className="w-full rounded-sm"
            style={{ height: 4, background: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)" }}
          />
          <div className="flex gap-1 flex-1">
            {/* Left bar */}
            <div
              className="rounded-sm shrink-0"
              style={{ width: 5, background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)" }}
            />
            {/* Canvas */}
            <div
              className="flex-1 rounded-sm"
              style={{ background: isLight ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.3)" }}
            />
            {/* Right panel */}
            <div className="flex flex-col gap-0.5 shrink-0" style={{ width: 10 }}>
              <div className="rounded-sm w-full" style={{ height: 3, background: accent, opacity: 0.9 }} />
              <div className="rounded-sm w-full" style={{ height: 2, background: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.07)" }} />
              <div className="rounded-sm w-full" style={{ height: 2, background: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.07)" }} />
            </div>
          </div>
        </div>

        {/* Active checkmark */}
        {active && (
          <div
            className="absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full"
            style={{ width: 14, height: 14, background: accent }}
          >
            <Check size={8} strokeWidth={3} style={{ color: isLight ? "#fff" : bg }} />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs font-medium" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
          {theme.name}
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
          {theme.description}
        </p>
      </div>
    </button>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

function CanvasSection() {
  return (
    <div className="flex flex-col gap-7">
      <SettingBlock title="Canvas Background" description="Color shown outside the image area.">
        <ToggleGroup
          options={["Dark", "Medium", "Light", "Transparent"]}
          value="Dark"
          onChange={() => {}}
        />
      </SettingBlock>
      <SettingBlock title="Grid & Guides" description="Overlay helpers on the canvas.">
        <ToggleRow label="Show pixel grid at high zoom" defaultValue={true} />
        <ToggleRow label="Show ruler guides" defaultValue={false} />
        <ToggleRow label="Snap to grid" defaultValue={true} />
      </SettingBlock>
      <SettingBlock title="Canvas Resolution" description="Device pixel ratio for rendering.">
        <ToggleGroup options={["1x", "2x (Retina)", "Auto"]} value="2x (Retina)" onChange={() => {}} />
      </SettingBlock>
      <SettingBlock title="Selection" description="Behavior of selection handles.">
        <ToggleRow label="Show transform handles" defaultValue={true} />
        <ToggleRow label="Show anchor points" defaultValue={true} />
        <ToggleRow label="Constrain proportions by default" defaultValue={false} />
      </SettingBlock>
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────────── */

function ExportSection() {
  return (
    <div className="flex flex-col gap-7">
      <SettingBlock title="Default Format" description="Format used when clicking Export.">
        <ToggleGroup options={["PNG", "JPG", "WEBP", "AVIF"]} value="PNG" onChange={() => {}} />
      </SettingBlock>
      <SettingBlock title="JPEG / WEBP Quality" description="Compression quality for lossy formats.">
        <div className="flex items-center gap-3 pt-1">
          <input
            type="range"
            min={60}
            max={100}
            defaultValue={92}
            className="flex-1"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-xs tabular-nums w-8 text-right" style={{ color: "var(--foreground)" }}>
            92%
          </span>
        </div>
      </SettingBlock>
      <SettingBlock title="Export Behavior" description="Options applied on every export.">
        <ToggleRow label="Strip metadata (EXIF, XMP)" defaultValue={true} />
        <ToggleRow label="Embed color profile" defaultValue={true} />
        <ToggleRow label="Open file after export" defaultValue={false} />
      </SettingBlock>
    </div>
  );
}

/* ─── Shortcuts ──────────────────────────────────────────── */

const shortcutRows = [
  { action: "Select tool", keys: ["V"] },
  { action: "Crop tool", keys: ["C"] },
  { action: "Brush tool", keys: ["B"] },
  { action: "Eraser tool", keys: ["E"] },
  { action: "Text tool", keys: ["T"] },
  { action: "Undo", keys: ["⌘", "Z"] },
  { action: "Redo", keys: ["⌘", "⇧", "Z"] },
  { action: "Save", keys: ["⌘", "S"] },
  { action: "Export", keys: ["⌘", "⇧", "E"] },
  { action: "Zoom in", keys: ["⌘", "+"] },
  { action: "Zoom out", keys: ["⌘", "−"] },
  { action: "Fit to screen", keys: ["⌘", "0"] },
];

function ShortcutsSection() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
        Keyboard shortcuts are fixed in this version.
      </p>
      {shortcutRows.map((row) => (
        <div
          key={row.action}
          className="flex items-center justify-between py-1.5 px-3 rounded"
          style={{ border: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--foreground)" }}>{row.action}</span>
          <div className="flex gap-1">
            {row.keys.map((k, i) => (
              <kbd
                key={i}
                className="px-1.5 py-0.5 rounded text-xs"
                style={{
                  background: "var(--secondary)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                {k}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── About ──────────────────────────────────────────────── */

function AboutSection() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 56, height: 56, background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="14" rx="1.5" fill="var(--accent)" />
            <rect x="10" y="2" width="6" height="8" rx="1.5" fill="var(--accent)" opacity="0.55" />
            <rect x="10" y="12" width="6" height="4" rx="1.5" fill="var(--accent)" opacity="0.3" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Lumen</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Version 0.1.0 — Beta</p>
        </div>
      </div>

      <div
        className="rounded-lg p-4 flex flex-col gap-1.5"
        style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
      >
        <InfoRow label="Engine" value="Fabric.js 6 + FastAPI" />
        <InfoRow label="Build" value="React 19 + Vite 8" />
        <InfoRow label="Styling" value="Tailwind CSS v4" />
        <InfoRow label="Platform" value="Browser (Chrome, Firefox, Safari)" />
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        Lumen is a professional browser-based photo editor built for focused creative work.
        AI features require an API key and are processed securely in your browser session.
      </p>
    </div>
  );
}

/* ─── Shared primitives ──────────────────────────────────── */

function SettingBlock({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{title}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [selected, setSelected] = useState(value);
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--background)", width: "fit-content" }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => { setSelected(opt); onChange(opt); }}
          className="px-3 py-1.5 text-xs transition-colors duration-100"
          style={{
            background: selected === opt ? "var(--secondary)" : "transparent",
            color: selected === opt ? "var(--foreground)" : "var(--muted-foreground)",
            fontWeight: selected === opt ? 500 : 400,
            borderRight: "1px solid var(--border)",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, defaultValue }: { label: string; defaultValue: boolean }) {
  const [on, setOn] = useState(defaultValue);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs" style={{ color: "var(--foreground)" }}>{label}</span>
      <button
        onClick={() => setOn((v) => !v)}
        className="relative rounded-full transition-colors duration-200 shrink-0"
        style={{
          width: 32,
          height: 18,
          background: on ? "var(--accent)" : "var(--secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="absolute top-0.5 rounded-full transition-transform duration-200"
          style={{
            width: 14,
            height: 14,
            background: on ? "var(--primary-foreground)" : "var(--muted-foreground)",
            transform: on ? "translateX(15px)" : "translateX(1px)",
          }}
        />
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs" style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}
