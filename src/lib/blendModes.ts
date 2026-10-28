/** The five canonical image blend modes — the single source of truth for the UI and the local engine.
 * The values match exactly what the backend (app/operations/blend.py) and the UI (BlendDialog) understand. */
export const BLEND_MODES = [
  "seamless_normal",
  "seamless_mixed",
  "seamless_mono",
  "pyramid",
  "feather",
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

/** Execution plan for a mode: which stage runs and how strongly. */
export interface BlendPlan {
  /** Luminance transfer (Mono): the foreground is reduced to pure luminance, then tinted with the background color. */
  mono: boolean;
  /** Strength of the per-channel color match to the background (0 = no matching). */
  matchStrength: number;
  /** Amount of high-frequency detail injected (texture preservation). */
  highFrequency: number;
  /** Multi-scale mask: a wider falloff with no seam. */
  multiScale: boolean;
}

/**
 * Translates a mode name into an execution plan. The core purpose: guarantee that the five modes
 * are actually distinct — the old code ignored `mode` entirely, so all five produced the same result.
 */
export function blendPlan(mode: string): BlendPlan {
  switch (mode) {
    case "seamless_normal":
      // Strong color match plus a plain feather (the local path; the backend uses real Poisson).
      return { mono: false, matchStrength: 48, highFrequency: 0, multiScale: false };
    case "seamless_mixed":
      // Color match plus background texture preserved by injecting high frequencies.
      return { mono: false, matchStrength: 48, highFrequency: 0.5, multiScale: false };
    case "seamless_mono":
      // Pure luminance transfer — best when the two images are lit differently.
      return { mono: true, matchStrength: 0, highFrequency: 0, multiScale: false };
    case "pyramid":
      // Multi-scale mask (two levels) — not a full Laplacian pyramid; the backend runs the real pyramid (5 levels).
      return { mono: false, matchStrength: 28, highFrequency: 0, multiScale: true };
    case "feather":
    default:
      // Fastest: a soft feather plus a light color match.
      return { mono: false, matchStrength: 28, highFrequency: 0, multiScale: false };
  }
}