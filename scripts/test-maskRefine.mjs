// Unit tests for the alpha mask refinement helpers (TDD — runs through esbuild + node)
import {
  keepMajorMaskComponents,
  keepAnchorMaskComponents,
  sharpenAlpha,
  erodeAlpha,
  featherAlpha,
  maskSoftnessRatio,
} from "../src/lib/maskRefine.ts";

let failed = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failed++; console.log(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`); }
  else console.log(`✓ ${name}`);
}
function truthy(name, cond, detail = "") {
  if (!cond) { failed++; console.log(`✗ ${name} ${detail}`); } else console.log(`✓ ${name}`);
}

// ── 1) smoothstep confidence curve (wide range 15%–85%) ──
eq("sharpen(0)=0", sharpenAlpha(0), 0);
eq("sharpen(255)=255", sharpenAlpha(255), 255);
truthy("sharpen(30)≈0 (below the lower threshold)", sharpenAlpha(30) <= 2, `=${sharpenAlpha(30)}`);
truthy("sharpen(225)≈255 (above the upper threshold)", sharpenAlpha(225) >= 253, `=${sharpenAlpha(225)}`);
truthy("sharpen preserves semi-transparent glass (128 stays mid-range)", sharpenAlpha(128) > 100 && sharpenAlpha(128) < 160,
  `=${sharpenAlpha(128)}`);
truthy("sharpen is monotonically increasing", sharpenAlpha(100) < sharpenAlpha(128) && sharpenAlpha(128) < sharpenAlpha(160));

// ── 1b) mask softness measurement ──
{
  const m = new Uint8ClampedArray(100);
  m.fill(255); // fully opaque = zero softness
  truthy("softness(opaque)=0", maskSoftnessRatio(m, 100) === 0);
  m.fill(128, 0, 50); // half the pixels are mid-range
  truthy("softness(half mid-range)=0.5", Math.abs(maskSoftnessRatio(m, 100) - 0.5) < 0.01);
}

// ── 2) keeping large components ──
{
  const w = 100, h = 100;
  const m = new Uint8ClampedArray(w * h);
  const blob = (cx, cy, bw, bh, v) => {
    for (let y = cy; y < cy + bh; y++) for (let x = cx; x < cx + bw; x++) m[y * w + x] = v;
  };
  blob(30, 30, 30, 30, 255);   // subject: 900px
  blob(2, 2, 5, 8, 220);        // stray speck: 40px (< 8% of 900 = 72) → removed
  blob(70, 70, 12, 12, 180);    // second legitimate part: 144px (≥ 72) → kept
  keepMajorMaskComponents(m, w, h);
  eq("main subject is kept", m[45 * w + 45], 255);
  eq("stray speck was removed", m[5 * w + 4], 0);
  eq("secondary legitimate part is kept", m[75 * w + 75], 180);
}
{
  // single component only: no change
  const w = 50, h = 50;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 10; y < 40; y++) for (let x = 10; x < 40; x++) m[y * w + x] = 255;
  keepMajorMaskComponents(m, w, h);
  eq("a single component stays as is", m[20 * w + 20], 255);
}
{
  // Reflection touching the edge: a relatively large left rectangle, but inside the 16% band
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // subject
  for (let y = 20, y1 = 90; y < y1; y++) for (let x = 0; x < 20; x++) m[y * w + x] = 200;  // reflection touching the left frame
  keepMajorMaskComponents(m, w, h);
  truthy("central subject is kept", m[60 * w + 100] === 255);
  truthy("edge-adjacent reflection (touching the frame) was removed", m[50 * w + 10] === 0, `=${m[50 * w + 10]}`);
}
{
  // small legitimate part in the middle of the image: kept (it does not touch the edge)
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255;
  for (let y = 60, y1 = 80; y < y1; y++) for (let x = 90; x < 110; x++) m[y * w + x] = 200;
  keepMajorMaskComponents(m, w, h);
  truthy("small mid-image part is kept", m[70 * w + 100] === 200);
}
{
  // Click anchoring: the subject (what the user clicked) + a huge edge reflection (60% of the largest) is removed
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // subject
  for (let y = 10, y1 = 100; y < y1; y++) for (let x = 0; x < 14; x++) m[y * w + x] = 220; // huge reflection touching the frame
  keepAnchorMaskComponents(m, w, h, 100, 60); // click inside the subject
  truthy("anchor: the clicked subject is kept", m[60 * w + 100] === 255);
  truthy("anchor: the huge adjacent reflection was removed", m[50 * w + 6] === 0, `=${m[50 * w + 6]}`);
}
{
  // Anchoring: a second legitimate component that does not touch the edge and is large enough stays
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // subject
  for (let y = 45, y1 = 90; y < y1; y++) for (let x = 140, x1 = 170; x < x1; x++) m[y * w + x] = 220; // mid-size peer, 1350px (34.6%)
  keepAnchorMaskComponents(m, w, h, 100, 60);
  truthy("anchor: the trusted mid-size peer is kept", m[70 * w + 155] === 220, `=${m[70 * w + 155]}`);
}
{
  // Anchoring on the background (the click is outside every component): the subject must not be wiped —
  // it should fall back to the "largest components" cleanup and keep the main subject.
  const w = 200, h = 120;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 30, y1 = 95; y < y1; y++) for (let x = 70; x < 130; x++) m[y * w + x] = 255; // subject
  for (let y = 5, y1 = 12; y < y1; y++) for (let x = 5, x1 = 12; x < x1; x++) m[y * w + x] = 200; // small stray speck
  keepAnchorMaskComponents(m, w, h, 2, 2); // click on the fully hollow background (label = 0)
  truthy("background anchor: the main subject stays (the mask is not wiped)", m[60 * w + 100] === 255, `=${m[60 * w + 100]}`);
  truthy("background anchor: the stray speck was removed", m[8 * w + 8] === 0, `=${m[8 * w + 8]}`);
}
{
  // background anchor on a single-component mask: no change at all
  const w = 60, h = 60;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 10; y < 50; y++) for (let x = 15; x < 45; x++) m[y * w + x] = 255;
  keepAnchorMaskComponents(m, w, h, 1, 1);
  truthy("background anchor with a single component: the subject stays", m[30 * w + 30] === 255);
}

// ── 3) erosion (separate min filter) ──
{
  const w = 9, h = 9;
  const a = new Uint8ClampedArray(w * h);
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) a[y * w + x] = 255; // 5×5 square
  erodeAlpha(a, w, h, 1);
  eq("erode 1px: the square's center remains", a[4 * w + 4], 255);
  eq("erode 1px: the square's edge dissolves", a[2 * w + 2], 0);
  eq("erode 1px: outer corners are zero", a[0], 0);
  // a 1px-thick line vanishes completely with a 1px erosion
  const b = new Uint8ClampedArray(w * h);
  for (let x = 1; x < 8; x++) b[4 * w + x] = 255;
  erodeAlpha(b, w, h, 1);
  truthy("1px line vanishes under erosion", b[4 * w + 4] === 0);
}

// ── 4) feather (separate blur) ──
{
  const w = 16, h = 4;
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < 8; x++) a[y * w + x] = 255; // left half opaque
  featherAlpha(a, w, h, 1);
  truthy("feather: stays opaque away from the boundary", a[1 * w + 2] === 255);
  truthy("feather: stays transparent away from the boundary", a[1 * w + 13] === 0);
  const at = (x) => a[1 * w + x];
  truthy("feather: gradual transition across the boundary", at(6) > at(7) && at(7) > 0 && at(8) < 255 && at(7) > at(9),
    `(${at(6)},${at(7)},${at(8)},${at(9)})`);
}

// ── 5) integration: stray speck + halo on a realistic mask ──
{
  const w = 60, h = 60;
  const m = new Uint8ClampedArray(w * h);
  for (let y = 10; y < 50; y++) for (let x = 15; x < 45; x++) m[y * w + x] = 255; // subject
  for (let y = 3; y < 9; y++) for (let x = 3; x < 10; x++) m[y * w + x] = 200;   // outlier
  keepMajorMaskComponents(m, w, h);
  erodeAlpha(m, w, h, 1);
  featherAlpha(m, w, h, 1);
  truthy("integration: the outlier disappeared", m[5 * w + 5] === 0);
  truthy("integration: the subject core is opaque", m[30 * w + 30] === 255);
  truthy("integration: the subject edge became soft (less halo)", m[10 * w + 30] < 255 && m[10 * w + 30] > 0,
    `=${m[10 * w + 30]}`);
}

console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
