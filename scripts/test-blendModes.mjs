// Test: are the five blend modes actually distinct?
// Original bug: `blendLocal` ignored `params.mode` entirely, so all five produced the same result.
import { blendPlan, BLEND_MODES } from "../src/lib/blendModes.ts";

let failed = 0;
function truthy(name, cond, detail = "") {
  if (!cond) { failed++; console.log(`✗ ${name} ${detail}`); } else console.log(`✓ ${name}`);
}

console.log("── the five blend modes ──");
truthy("five modes exist", BLEND_MODES.length === 5, `=${BLEND_MODES.length}`);
truthy("no duplicate modes", new Set(BLEND_MODES).size === BLEND_MODES.length);

// 1) Every mode has a plan, and an unknown mode falls back to feather (safe behavior).
for (const m of BLEND_MODES) {
  const p = blendPlan(m);
  truthy(`mode "${m}" has a valid plan`, Number.isFinite(p.matchStrength) && p.matchStrength >= 0);
}
truthy("unknown mode falls back to the feather plan",
  JSON.stringify(blendPlan("not_a_real_mode")) === JSON.stringify(blendPlan("feather")));

// 2) Actual differentiation: each mode's signature must be unique — this is what was missing.
const sig = (m) => {
  const p = blendPlan(m);
  return `${p.mono}|${p.matchStrength}|${p.highFrequency}|${p.multiScale}`;
};
const sigs = BLEND_MODES.map(sig);
truthy("the five mode signatures are unique (real differentiation)", new Set(sigs).size === 5,
  `\n   ${BLEND_MODES.map((m, i) => `${m}=${sigs[i]}`).join("\n   ")}`);

// 3) Per-mode properties as documented in the UI.
truthy("mono: lighting transfer only", blendPlan("seamless_mono").mono === true);
truthy("mixed: injects high-frequency detail", blendPlan("seamless_mixed").highFrequency > 0);
truthy("normal: stronger matching than feather",
  blendPlan("seamless_normal").matchStrength > blendPlan("feather").matchStrength);
truthy("pyramid: multi-scale mask", blendPlan("pyramid").multiScale === true);
truthy("feather: the simplest (no mono/detail/pyramid)",
  !blendPlan("feather").mono && blendPlan("feather").highFrequency === 0 && !blendPlan("feather").multiScale);

// 4) Every mode yields a non-negative match strength (numeric sanity).
for (const m of BLEND_MODES) {
  const p = blendPlan(m);
  truthy(`"${m}": non-negative values`, p.matchStrength >= 0 && p.highFrequency >= 0);
}

console.log(failed === 0 ? "\nALL BLEND TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
