interface BottomBarProps {
  zoom?: number;
  width?: number;
  height?: number;
  saveState?: "saved" | "saving" | "unsaved";
  activeTool?: string;
}

export default function BottomBar({
  zoom = 100,
  width = 1920,
  height = 1080,
  saveState = "saved",
  activeTool = "Select",
}: BottomBarProps) {
  return (
    <div
      className="flex items-center px-4 gap-5 h-8 shrink-0 select-none"
      style={{
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <StatusItem label="Zoom" value={`${zoom}%`} />
      <Divider />
      <StatusItem label="Canvas" value={`${width} × ${height} px`} />
      <Divider />
      <StatusItem label="Tool" value={activeTool} />
      <div className="flex-1" />
      <StatusItem
        label=""
        value={
          saveState === "saving"
            ? "Saving…"
            : saveState === "unsaved"
              ? "Unsaved changes"
              : "Saved"
        }
        accent={saveState === "saved"}
        dim={saveState === "saving"}
        warn={saveState === "unsaved"}
      />
    </div>
  );
}

function StatusItem({
  label,
  value,
  accent,
  dim,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dim?: boolean;
  warn?: boolean;
}) {
  const color = accent
    ? "var(--success)"
    : warn
      ? "var(--warning)"
      : dim
        ? "var(--muted-foreground)"
        : "var(--muted-foreground)";

  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-xs" style={{ color: "var(--muted-foreground)", opacity: 0.55 }}>
          {label}
        </span>
      )}
      <span className="text-xs tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3" style={{ background: "var(--border)" }} />;
}
