/* Preset Manager — saves/loads operation presets for Filters & Adjustments.
 * Stores in localStorage with versioning for schema upgrades. */

export interface Preset {
  id: string;
  name: string;
  category: "filter" | "adjust";
  operation: string;
  params: Record<string, number | string>;
  createdAt: number;
}

const PRESET_KEY = "lumen_presets";
const PRESET_VERSION = 1;

export interface PresetStore {
  version: number;
  presets: Preset[];
}

function loadStore(): PresetStore {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return { version: PRESET_VERSION, presets: [] };
    const store: PresetStore = JSON.parse(raw);
    if (!store.version || store.presets === undefined) return { version: PRESET_VERSION, presets: [] };
    return store;
  } catch {
    return { version: PRESET_VERSION, presets: [] };
  }
}

function saveStore(store: PresetStore): void {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable — silent */
  }
}

function uid(): string {
  return `preset-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

export function listPresets(): Preset[] {
  return loadStore().presets;
}

export function createPreset(
  name: string,
  category: "filter" | "adjust",
  operation: string,
  params: Record<string, number | string>
): Preset {
  const store = loadStore();
  const preset: Preset = {
    id: uid(),
    name,
    category,
    operation,
    params,
    createdAt: Date.now(),
  };
  store.presets.push(preset);
  saveStore(store);
  return preset;
}

export function deletePreset(id: string): void {
  const store = loadStore();
  store.presets = store.presets.filter((p) => p.id !== id);
  saveStore(store);
}

export function applyPreset(preset: Preset): Record<string, number | string> {
  return { ...preset.params };
}

export function renamePreset(id: string, name: string): void {
  const store = loadStore();
  const preset = store.presets.find((p) => p.id === id);
  if (preset) {
    preset.name = name;
    saveStore(store);
  }
}

export function duplicatePreset(id: string): Preset | null {
  const store = loadStore();
  const src = store.presets.find((p) => p.id === id);
  if (!src) return null;
  const copy: Preset = { ...src, id: uid(), name: `${src.name} (copy)`, createdAt: Date.now() };
  store.presets.push(copy);
  saveStore(store);
  return copy;
}

export function exportPresets(ids?: string[]): string {
  const store = loadStore();
  const presets = ids ? store.presets.filter((p) => ids.includes(p.id)) : store.presets;
  return JSON.stringify({ version: PRESET_VERSION, presets }, null, 2);
}

export function importPresets(json: string): { count: number; errors: string[] } {
  const result = { count: 0, errors: [] as string[] };
  try {
    const data = JSON.parse(json);
    if (!data.version || !Array.isArray(data.presets)) {
      result.errors.push("Invalid preset file format");
      return result;
    }
    const store = loadStore();
    const existingIds = new Set(store.presets.map((p) => p.id));
    for (const preset of data.presets) {
      if (!preset.id || !preset.name || !preset.operation) continue;
      if (existingIds.has(preset.id)) {
        preset.id = uid(); // avoid collisions
      }
      store.presets.push(preset as Preset);
      existingIds.add(preset.id);
      result.count++;
    }
    saveStore(store);
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : "Failed to import presets");
  }
  return result;
}

/* Built-in default presets for quick access */
export const BUILTIN_PRESETS: Preset[] = [
  { id: "bp-1", name: "Classic Contrast", category: "adjust", operation: "brightness_contrast", params: { brightness: 5, contrast: 20 }, createdAt: Date.now() - 86400000 },
  { id: "bp-2", name: "Warm Portrait", category: "adjust", operation: "color_balance", params: { shadows_cyan_red: -5, shadows_magenta_green: 0, shadows_yellow_blue: 10, midtones_cyan_red: -10, midtones_magenta_green: 0, midtones_yellow_blue: 5, highlights_cyan_red: -5, highlights_magenta_green: 0, highlights_yellow_blue: 0, preserve_luminosity: 1 }, createdAt: Date.now() - 86400000 },
  { id: "bp-3", name: "Cool Noir", category: "adjust", operation: "grayscale", params: {}, createdAt: Date.now() - 86400000 },
  { id: "bp-4", name: "Vignette Subtle", category: "filter", operation: "vignette", params: { strength: 30 }, createdAt: Date.now() - 86400000 },
  { id: "bp-5", name: "Soft Blur", category: "filter", operation: "blur", params: { radius: 2 }, createdAt: Date.now() - 86400000 },
  { id: "bp-6", name: "Vivid Pop", category: "adjust", operation: "vibrance", params: { amount: 40 }, createdAt: Date.now() - 86400000 },
];

export function ensureBuiltinPresets(): void {
  const store = loadStore();
  if (store.presets.length === 0) {
    store.presets = [...BUILTIN_PRESETS];
    saveStore(store);
  }
}
