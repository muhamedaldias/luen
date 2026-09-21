# Eraser True-Transparency Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eraser erase to real transparency visibly (checkerboard), with size control and cursor preview, and keep alpha intact through flatten/export — Photoshop-standard behavior.

**Architecture:** Four in-place changes, single writer: (1) checkerboard artboard backdrop in `Canvas.tsx` stage JSX; (2) eraser size state in `App.tsx` plumbed to `Canvas.tsx` (replacing the `ERASER_DIA = 36` const) with `[` `]` shortcuts + floating panel mirroring the quick-select panel; (3) cursor ring preview for the eraser; (4) skip the opaque base fill in `exportFlattenedDataUrl` when a base image exists so PNG keeps alpha. No new dependencies, no API changes.

**Tech Stack:** React 19 + TypeScript strict + Fabric.js display + Canvas 2D `destination-out` + Playwright (bundled `.qa-libs`, Chrome via `channel="chrome"`) for E2E.

**Spec:** Root-cause evidence (this session): erase math is correct (`destination-out` punches real alpha, `Canvas.tsx:981`); the black line is display + export damage — (a) transparent pixels render over the near-black artboard (`var(--card)` behind transparent fabric canvas, `Canvas.tsx:2034-2050`), (b) `exportFlattenedDataUrl` pre-fills `#0F0E0D` (`exportComposite.ts:51-52`), baking transparency to black on every PNG export. Reference: Photoshop eraser = transparency on normal layers + checkerboard indicator + `[`/`]` size keys + PNG preserves alpha.

## Global Constraints

- Modify ONLY: `src/components/Canvas.tsx`, `src/App.tsx`, `src/lib/exportComposite.ts`.
- `src/lib/localOps.ts`, `src/lib/selection.ts`, `src/index.css`, `src/themes.ts` are READ-ONLY.
- No `as any`, no `@ts-ignore`, no `@ts-expect-error`, no empty catch blocks.
- No new npm dependencies. Temp scripts live in `C:\Users\Eng-m\AppData\Local\Temp\opencode\` and are never committed.
- Opacity/Flow/Airbrush and selection-constrained erase are OUT OF SCOPE — do not build them.
- Do NOT commit; orchestrator commits.
- Verify with `npx tsc --noEmit` after every task and `npm run build` after Task 4.

---

### Task 1: Checkerboard transparency backdrop (P0 — the visible bug)

**Files:**
- Modify: `src/components/Canvas.tsx:2034-2050` (artboard-frame div)

**Interfaces:**
- Consumes: existing `boardBox` (`{x,y,w,h}`, already used by the frame, grid, rulers).
- Produces: checkerboard visible through erased (transparent) pixels; opaque images cover it fully so they look unchanged.

- [ ] **Step 1: Write the failing check**

Create `C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check1.cjs`:

```js
const fs = require("fs");
const src = fs.readFileSync("src/components/Canvas.tsx", "utf8");
const hasChecker = /repeating-conic-gradient|conic-gradient\(.*checker|data-testid="transparency-checker"/.test(src);
console.log("checker-present:", hasChecker);
if (!hasChecker) { console.log("RED: no transparency indicator"); process.exit(1); }
console.log("GREEN");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check1.cjs`
Expected: exit 1, `checker-present: false`.

- [ ] **Step 3: Minimal implementation**

Change ONLY the `background` of the `data-testid="artboard-frame"` div (`Canvas.tsx:2034-2050`) from `"var(--card)"` to a theme-safe checker, keeping every other style prop (position, border, radius, shadow, pointerEvents) byte-identical:

```tsx
backgroundColor: "var(--card)",
backgroundImage: "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%)",
backgroundSize: "16px 16px",
```

Rationale: opaque image pixels cover the frame completely (unchanged look); erased transparent pixels reveal the checker (Photoshop convention); `var(--border)`/`var(--card)` keep it correct in all five themes including Pearl.

- [ ] **Step 4: Re-run check + typecheck**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check1.cjs`
Expected: exit 0, GREEN.
Run: `npx tsc --noEmit`
Expected: exit 0, no output.

---

### Task 2: Eraser size control — state + `[` `]` + floating panel (P1)

**Files:**
- Modify: `src/App.tsx` (state near `quickBrush` ~line 139; key handler ~455-472; floating panel near quick-select panel ~2207-2249; `Canvas` props ~2267+)
- Modify: `src/components/Canvas.tsx` (accept size prop, use in `eraseDab`/`eraseStrokeTo`, cursor map ~line 70)

**Interfaces:**
- Consumes: existing `quickBrush`/`setQuickBrush` pattern (state + ref mirror + prop drilling).
- Produces: `eraserSize` (px, 2–200, default 36) available in Canvas erase path; App key handler grows/shrinks it.

- [ ] **Step 1: Write the failing check**

Create `C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check2.cjs`:

```js
const fs = require("fs");
const app = fs.readFileSync("src/App.tsx", "utf8");
const cv = fs.readFileSync("src/components/Canvas.tsx", "utf8");
const checks = {
  "state": /eraserSize/.test(app),
  "no-const-dia": !/const ERASER_DIA = 36/.test(cv),
  "bracket-keys": /BracketLeft/.test(app) && /BracketRight/.test(app),
  "panel": /Eraser size/.test(app),
};
console.log(JSON.stringify(checks));
if (Object.values(checks).some((v) => !v)) { console.log("RED"); process.exit(1); }
console.log("GREEN");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check2.cjs`
Expected: exit 1 (all false except none).

- [ ] **Step 3: Minimal implementation**

1. `App.tsx`: add `const [eraserSize, setEraserSize] = useState(36);` next to `quickBrush`, plus `const eraserSizeRef = useRef(36);` with the same mirror `useEffect` pattern, clamped `Math.max(2, Math.min(200, Math.round(v)))`.
2. `App.tsx` key handler: add before the `if (mod) return;` line:
```tsx
if (k === "[" || (e.code === "BracketLeft" && !mod)) { setEraserSize((v) => Math.max(2, v - 4)); return; }
if (k === "]" || (e.code === "BracketRight" && !mod)) { setEraserSize((v) => Math.min(200, v + 4)); return; }
```
First verify no existing `[`/`]` binding conflicts in that handler; the existing text-entry guard above already protects inputs.
3. `App.tsx`: floating panel when `activeTool === "eraser"`, cloned from the quick-select panel (`:2207-2249`) with one slider labeled `Eraser size: {eraserSize}px` (`min={2} max={200}`) and hint text `"Drag to erase to transparency · [ ] = size (E)"`, plus busy-state text when an erase is in flight if trivially available (else static hint only).
4. `Canvas.tsx`: add optional prop `eraserSize?: number` (default 36), delete `const ERASER_DIA = 36;`, replace both uses (`eraseDab` radius, `eraseStrokeTo` step) with the prop value. Pass `eraserSize={eraserSize}` at the `Canvas` element in `App.tsx`.

- [ ] **Step 4: Re-run check + typecheck**

Re-run Step 1 script. Expected: exit 0, all true.
Run: `npx tsc --noEmit`. Expected: exit 0.

---

### Task 3: Eraser cursor ring preview (P1)

**Files:**
- Modify: `src/components/Canvas.tsx` (cursor map ~line 70-74; stage container ~2024-2053)

**Interfaces:**
- Consumes: `eraserSize` prop from Task 2; existing `viewRef.current.box`/`natW` for px scaling; existing `TOOL_CURSORS` map.
- Produces: accurate-diameter ring following the pointer only while eraser is active.

- [ ] **Step 1: Write the failing check**

Create `C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check3.cjs`:

```js
const fs = require("fs");
const src = fs.readFileSync("src/components/Canvas.tsx", "utf8");
const checks = {
  "cursor-none": /eraser:\s*"none"/.test(src),
  "ring": /eraser-cursor-ring|cursorRing/.test(src),
};
console.log(JSON.stringify(checks));
if (Object.values(checks).some((v) => !v)) { console.log("RED"); process.exit(1); }
console.log("GREEN");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check3.cjs`
Expected: exit 1.

- [ ] **Step 3: Minimal implementation**

1. `TOOL_CURSORS`: change `eraser: "cell"` to `eraser: "none"` (the ring replaces the native cursor; every other tool entry untouched).
2. Inside the stage root div (`Canvas.tsx:2024`), track pointer with local state `{x, y, inside}` via `onMouseMove`/`onMouseLeave` on the container div (offsets relative to container via `getBoundingClientRect`). Render ONLY when `activeTool === "eraser" && inside`:
```tsx
<div
  data-testid="eraser-cursor-ring"
  style={{
    position: "absolute",
    left: x - dia / 2,
    top: y - dia / 2,
    width: dia,
    height: dia,
    borderRadius: "50%",
    border: "1.5px solid var(--foreground)",
    boxShadow: "0 0 0 1.5px var(--background)",
    pointerEvents: "none",
    zIndex: 6,
  }}
/>
```
where `dia = eraserSize * (viewRef.current.box.w / Math.max(1, viewRef.current.natW))` (display px per image px; recompute each render — no new subscriptions). The double border (light + dark shadow) keeps the ring visible over any image tone.

- [ ] **Step 4: Re-run check + typecheck**

Re-run Step 1 script. Expected: exit 0.
Run: `npx tsc --noEmit`. Expected: exit 0.

---

### Task 4: Preserve alpha through flatten/export (P0 — the permanent damage)

**Files:**
- Modify: `src/lib/exportComposite.ts:46-57` (canvas base fill)

**Interfaces:**
- Consumes: `FlattenOpts.imageUrl` (dataURL PNG with alpha after an erase commit).
- Produces: exported PNG keeps `alpha < 255` in erased regions; blank-document export (no base image) byte-identical to before.

- [ ] **Step 1: Write the failing check (pixel-level, real code)**

Create `C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-check4.cjs` — runs in Node with a minimal DOM shim? No: this check runs IN THE BROWSER via the Task-5 Playwright script instead (Canvas2D needed). As a static gate here, assert the source no longer unconditionally fills:

```js
const fs = require("fs");
const src = fs.readFileSync("src/lib/exportComposite.ts", "utf8");
const block = src.slice(0, src.indexOf("if (baseImg)"));
const unconditionalFill = /fillStyle = "#0F0E0D"/.test(block);
console.log("unconditional-dark-fill:", unconditionalFill);
if (unconditionalFill) { console.log("RED"); process.exit(1); }
console.log("GREEN");
```

Run it. Expected: exit 1.

- [ ] **Step 2: Minimal implementation**

Replace lines 46-57 region with alpha-safe logic — draw the base image onto a TRANSPARENT canvas; keep the old fills only for the no-image (blank doc) case:

```ts
const canvas = document.createElement("canvas");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d")!;
if (!ctx) throw new Error("no ctx");
if (baseImg) {
  ctx.drawImage(baseImg, 0, 0, W, H);
} else {
  ctx.fillStyle = "#1C1B1A";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ...keep existing grid loop unchanged...
}
```

Delete the `ctx.fillStyle = "#0F0E0D"; ctx.fillRect(...)` lines entirely. Opaque sources (JPEG) are unaffected (they cover every pixel); PNG sources with erased alpha now survive; blank-doc export unchanged.

- [ ] **Step 3: Re-run check + typecheck + build**

Re-run Step 1 script. Expected: exit 0.
Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run build`. Expected: exit 0, `dist/` emitted.

---

### Task 5: E2E erase verification in the real app (orchestrator-owned, worker prepares + runs)

Worker writes and runs `C:\Users\Eng-m\AppData\Local\Temp\opencode\eraser-e2e.py` with bundled libs (`$env:PYTHONPATH` = `<repo>/.qa-libs`, `channel="chrome"`, `http://localhost:8443`):

1. Generate `test-red.png` (240×150 solid red) with this exact Node generator, run as `node gen-red.cjs <outpath>`:
```js
const zlib = require("zlib"), fs = require("fs");
const T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const ck = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const u = Buffer.concat([t, d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(u)); return Buffer.concat([l, u, c]); };
const W = 240, H = 150, raw = Buffer.alloc((1 + W * 3) * H);
for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0; for (let x = 0; x < W; x++) { raw[y * (1 + W * 3) + 1 + x * 3] = 200; raw[y * (1 + W * 3) + 1 + x * 3 + 1] = 40; raw[y * (1 + W * 3) + 1 + x * 3 + 2] = 40; } }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ck(Buffer.from("IHDR"), ih), ck(Buffer.from("IDAT"), zlib.deflateSync(raw)), ck(Buffer.from("IEND"), Buffer.alloc(0))]));
```
2. Load app, `wait_for_load_state("networkidle")`, drop the file onto the stage (construct `File` + `DataTransfer` in `page.evaluate` from the PNG bytes, `dispatchEvent(new DragEvent("drop"))` on the stage root).
3. Press `E`, drag a horizontal stroke across the image middle, wait 1s, screenshot stage to `eraser-after.png`.
4. PASS criteria (assert in-script): sampled pixels along the stroke band are NOT solid red AND NOT solid near-black — they match one of the two checker tones (read `getComputedStyle` of the artboard frame for exact rgb values at runtime; tolerance ±8). FAIL otherwise with the sampled values printed.
5. Report: console/page errors (favicon-404 + fonts-blocked are known pre-existing; any NEW error fails the run).

## Self-Review

- [x] Spec coverage: display lie (Task 1 checkerboard), no size control (Task 2), no cursor (Task 3), export damage (Task 4), pixel-proof E2E (Task 5).
- [x] Placeholder scan: every step has exact file:line, real code blocks, exact commands; no TBD/TODO.
- [x] Type consistency: `eraserSize?: number` optional prop default 36; `setEraserSize` mirrors `setQuickBrush`; export change keeps `FlattenOpts` signature identical.
