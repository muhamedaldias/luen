// Live previews for the Filter menu: a programmatically-drawn demo scene is run
// through the app's real processing pipeline (applyLocalOp), cached per filter.
import { applyLocalOp } from "./localOps";

export interface FilterInfo {
  desc: string;
  tag: "Adjust" | "Effect" | "One-click" | "AI tool" | "Preset";
  hint?: string;
  spec?: { op: string; params: Record<string, number | string> };
}

export const FILTER_INFO: Record<string, FilterInfo> = {
  "Blur…": {
    desc: "Softens fine detail and smooths edges — useful for depth-of-field looks or taking the edge off noise.",
    tag: "Effect",
    hint: "Opens a dialog · radius up to 20px",
    spec: { op: "blur", params: { radius: 5 } },
  },
  "Sharpen…": {
    desc: "Boosts edge contrast so details read crisper. Push it too far and halos start to appear.",
    tag: "Effect",
    hint: "Opens a dialog · amount 0–5",
    spec: { op: "sharpen", params: { amount: 2 } },
  },
  "Brightness / Contrast…": {
    desc: "Raises or lowers overall light, and separates darks from lights.",
    tag: "Adjust",
    hint: "Opens a dialog · −100 to +100",
    spec: { op: "brightness_contrast", params: { brightness: 10, contrast: 34 } },
  },
  "Hue / Saturation…": {
    desc: "Rotates colors around the wheel and controls how vivid they appear.",
    tag: "Adjust",
    hint: "Opens a dialog · hue ±180°",
    spec: { op: "hue_saturation", params: { hue: 135, saturation: 30 } },
  },
  "Color Balance…": {
    desc: "Tints shadows, midtones and highlights separately — teal shadows under a warm sun.",
    tag: "Adjust",
    hint: "Opens a dialog · 3 tonal ranges",
    spec: {
      op: "color_balance",
      params: { midtones_cyan_red: 22, midtones_yellow_blue: 28, shadows_yellow_blue: -20 },
    },
  },
  "Vibrance…": {
    desc: "Boosts muted colors while protecting skin tones. Gentler than raw saturation.",
    tag: "Adjust",
    hint: "Opens a dialog · −100 to +100",
    spec: { op: "vibrance", params: { amount: 75 } },
  },
  "Levels…": {
    desc: "Reshapes shadows, midtones and highlights with precise input and output control.",
    tag: "Adjust",
    hint: "Opens a dialog · histogram",
    spec: { op: "levels", params: { shadows: 36, highlights: 230 } },
  },
  "Curves…": {
    desc: "Bend the tonal curve to reshape contrast and each color channel by hand.",
    tag: "Adjust",
    hint: "Opens a dialog · spline curve",
    spec: {
      op: "curves",
      params: { points: JSON.stringify([{ x: 0, y: 0 }, { x: 64, y: 48 }, { x: 190, y: 206 }, { x: 255, y: 255 }]) },
    },
  },
  Grayscale: {
    desc: "Strips all color, keeping luminance only.",
    tag: "One-click",
    hint: "Applies instantly",
    spec: { op: "grayscale", params: {} },
  },
  Sepia: {
    desc: "Warm brown monochrome — the classic vintage print look.",
    tag: "One-click",
    hint: "Applies instantly",
    spec: { op: "sepia", params: {} },
  },
  "Vignette…": {
    desc: "Darkens the edges to pull the eye toward the center of the frame.",
    tag: "Effect",
    hint: "Opens a dialog · strength 0–100",
    spec: { op: "vignette", params: { strength: 62 } },
  },
  "Auto Enhance": {
    desc: "One-click fix: auto contrast, levels and a touch of sharpening.",
    tag: "One-click",
    hint: "Applies instantly",
    spec: { op: "auto_enhance", params: {} },
  },
  "Pro Enhance": {
    desc: "A stronger single-pass enhancement — punchier color, clarity and depth.",
    tag: "One-click",
    hint: "Applies instantly",
    spec: { op: "pro_enhance", params: { strength: 70 } },
  },
  "Blend Two Images…": {
    desc: "Mixes a second image into this one with blend modes and opacity control.",
    tag: "AI tool",
    hint: "Opens the blend dialog",
  },
  "Remove Object…": {
    desc: "Brush over anything you want gone; inpainting fills the area in.",
    tag: "AI tool",
    hint: "Opens the mask editor",
  },
  "AI Upscale…": {
    desc: "Enlarges the image 2× or 4× while preserving detail.",
    tag: "AI tool",
    hint: "Opens a dialog",
  },
  "Save Preset": {
    desc: "Store the current adjustments as a reusable preset.",
    tag: "Preset",
    hint: "Saves current settings",
  },
  "Load Presets…": {
    desc: "Import presets from pasted JSON.",
    tag: "Preset",
    hint: "Import from JSON",
  },
  "Export Presets…": {
    desc: "Download all saved presets as a JSON file.",
    tag: "Preset",
    hint: "Downloads a JSON file",
  },
};

let sample: string | null = null;

/** Cached dataURL of the demo scene used as the "Before" thumbnail. */
export function getSampleUrl(): string {
  if (!sample) sample = drawSampleScene();
  return sample;
}

const cache = new Map<string, Promise<string | null>>();

/** Filtered "After" thumbnail for a menu label, or null when not previewable. */
export function getFilterPreview(label: string): Promise<string | null> {
  const info = FILTER_INFO[label];
  if (!info?.spec) return Promise.resolve(null);
  let p = cache.get(label);
  if (!p) {
    p = applyLocalOp(getSampleUrl(), info.spec.op, info.spec.params)
      .then((r) => r.url)
      .catch(() => null);
    cache.set(label, p);
  }
  return p;
}

let warmed = false;

/** Generate all previews once, gently, in idle time (called when the menu opens). */
export function prewarmFilterPreviews(): void {
  if (warmed) return;
  warmed = true;
  const run = () => {
    const labels = Object.keys(FILTER_INFO);
    let i = 0;
    const step = () => {
      if (i >= labels.length) return;
      void getFilterPreview(labels[i++]).finally(() => window.setTimeout(step, 0));
    };
    step();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    window.setTimeout(run, 900);
  }
}

/**
 * The demo scene: a sunset landscape with smooth gradients (blur/sharpen),
 * saturated hues (hue/vibrance), deep shadows and bright highlights
 * (levels/curves) and a centered focal point (vignette).
 */
function drawSampleScene(): string {
  const W = 260;
  const H = 195;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const horizon = H * 0.62;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#1C2B4E");
  sky.addColorStop(0.45, "#7A4A6E");
  sky.addColorStop(0.78, "#DE8A50");
  sky.addColorStop(1, "#F6CA6E");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // Sun glow + disc
  const sunX = W * 0.66;
  const sunY = horizon - 18;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 64);
  glow.addColorStop(0, "rgba(255,236,190,0.95)");
  glow.addColorStop(0.35, "rgba(255,190,110,0.45)");
  glow.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
  ctx.fillStyle = "#FFEFC9";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 13, 0, Math.PI * 2);
  ctx.fill();

  // Clouds
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  for (const [cx, cy, rx, ry] of [
    [W * 0.22, 34, 34, 7],
    [W * 0.34, 52, 24, 5],
    [W * 0.8, 26, 30, 6],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far ridge
  ctx.fillStyle = "#4A3E5C";
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(0, horizon - 22);
  ctx.lineTo(W * 0.18, horizon - 38);
  ctx.lineTo(W * 0.36, horizon - 16);
  ctx.lineTo(W * 0.52, horizon - 30);
  ctx.lineTo(W * 0.74, horizon - 10);
  ctx.lineTo(W, horizon - 24);
  ctx.lineTo(W, horizon);
  ctx.closePath();
  ctx.fill();

  // Near ridge
  ctx.fillStyle = "#2A2438";
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(0, horizon - 12);
  ctx.lineTo(W * 0.28, horizon - 26);
  ctx.lineTo(W * 0.5, horizon - 6);
  ctx.lineTo(W * 0.78, horizon - 20);
  ctx.lineTo(W, horizon - 8);
  ctx.lineTo(W, horizon);
  ctx.closePath();
  ctx.fill();

  // Water
  const water = ctx.createLinearGradient(0, horizon, 0, H);
  water.addColorStop(0, "#B97F52");
  water.addColorStop(0.25, "#3E4460");
  water.addColorStop(1, "#161B2C");
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, W, H - horizon);

  // Sun reflection
  for (let y = horizon + 4; y < H - 6; y += 5) {
    const t = 1 - (y - horizon) / (H - horizon);
    const w = 30 * t + 6;
    ctx.fillStyle = `rgba(246,202,110,${(0.5 * t + 0.08).toFixed(3)})`;
    ctx.fillRect(sunX - w / 2 + Math.sin(y * 1.7) * 4, y, w, 1.6);
  }

  // Foreground rocks
  ctx.fillStyle = "#100E18";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 22);
  ctx.quadraticCurveTo(W * 0.16, H - 38, W * 0.34, H - 20);
  ctx.quadraticCurveTo(W * 0.52, H - 6, W * 0.7, H - 16);
  ctx.quadraticCurveTo(W * 0.88, H - 26, W, H - 14);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Birds
  ctx.strokeStyle = "rgba(20,16,26,0.85)";
  ctx.lineWidth = 1.5;
  for (const [bx, by, s] of [
    [W * 0.3, 78, 5],
    [W * 0.38, 70, 3.5],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s / 2, by - s * 0.8, bx, by);
    ctx.quadraticCurveTo(bx + s / 2, by - s * 0.8, bx + s, by);
    ctx.stroke();
  }

  return c.toDataURL("image/png");
}
