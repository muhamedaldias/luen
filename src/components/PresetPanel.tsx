import { useState, useCallback } from "react";
import {
  listPresets,
  createPreset,
  deletePreset,
  applyPreset,
  exportPresets,
  importPresets,
  type Preset,
} from "../lib/presets";

interface PresetPanelProps {
  hasImage: boolean;
  onApplyOperation?: (op: string, params: Record<string, number | string>) => Promise<string | null>;
}

export default function PresetPanel({ hasImage, onApplyOperation }: PresetPanelProps) {
  const [presets, setPresets] = useState<Preset[]>(() => listPresets());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => setPresets(listPresets()), []);

  async function handleSave(name: string, operation: string, params: Record<string, number | string>) {
    if (!hasImage) return;
    createPreset(name, operation === "adjust" ? "adjust" : "filter", operation, params);
    refresh();
  }

  async function handleApply(preset: Preset) {
    if (!hasImage || !onApplyOperation) return;
    setLoading(true);
    await onApplyOperation(preset.operation, preset.params);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    deletePreset(id);
    refresh();
  }

  function handleExport() {
    const json = exportPresets();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lumen-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importPresets(text);
    if (result.count > 0) refresh();
    event.target.value = "";
  }

  return (
    <div className="py-2 px-3 flex flex-col gap-1.5 w-full" style={{ minWidth: 0 }}>
      <p className="text-xs font-semibold mb-0.5 tracking-wide" style={{ color: "var(--muted-foreground)", fontSize: 10, letterSpacing: "0.08em" }}>
        PRESETS
      </p>
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={handleExport}
          className="h-7 rounded text-xs font-medium"
          style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", padding: "0 6px" }}
        >
          Export
        </button>
        <label className="h-7 rounded text-xs font-medium inline-flex items-center cursor-pointer" style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "0 6px" }}>
          Import
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto" style={{ minWidth: 0 }}>
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <button
              onClick={() => void handleApply(p)}
              disabled={loading || !hasImage}
              className="flex-1 h-7 rounded text-xs text-left px-2 truncate"
              style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", opacity: loading || !hasImage ? 0.5 : 1 }}
              title={`${p.operation} ${JSON.stringify(p.params)}`}
            >
              {p.name}
            </button>
            <button
              onClick={() => void handleDelete(p.id)}
              className="h-7 w-7 rounded text-xs flex items-center justify-center"
              style={{ background: "var(--secondary)", color: "var(--warning)", border: "1px solid var(--border)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No saved presets yet.</p>
        )}
      </div>
    </div>
  );
}