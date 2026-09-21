# RightPanel P0/P1/P2 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed RightPanel defects (dead Reset button, partial adjust params, mock ComparisonStrip, hardcoded colors, unicode icon language, tab accessibility) in one single-writer pass without regressions.

**Architecture:** Minimal in-place fixes inside `src/components/RightPanel.tsx` only. No new components, no API changes, no new dependencies. All colors map to existing CSS vars from `src/index.css` / `src/themes.ts`.

**Tech Stack:** React 19 + TypeScript strict + Tailwind v4 + lucide-react + `applyLocalOp` in `src/lib/localOps.ts`.

**Spec:** Root-cause evidence (this session): `applyLocalOp` `case "adjust"` (`src/lib/localOps.ts:991-1021`) already consumes `brightness, contrast, saturation, blur, temperature, highlights, shadows, sharpness` — but `AdjustmentsTab.apply()` (`RightPanel.tsx:1399-1412`) only sends 4 keys. `Reset all` button (`:1712-1722`) has no `onClick`. `ComparisonStrip` (`:1778-1832`) renders hardcoded mock rows with a dead `Use` button. Hardcodes: `#2A2927` (:584), `#7FB8FF` (:463,619,1850), `rgba(201,123,74,*)` (:526,571,793,795), `color:#fff` (:519), `#4A4845` (:632,688). Unicode glyphs: align `⇤⇔⇥⤒⇕⤓` (:513-518,822-827), arrange `⤢↑↓⤡` (:1874-1877), shape `⬢` (:465,977), blend `◐` (:619), mask `◑` (:629), drag `⋮⋮` (:583,665).

## Global Constraints

- Single writer: only `src/components/RightPanel.tsx` may be modified; `src/lib/localOps.ts` is READ-ONLY reference.
- No `as any`, no `@ts-ignore`, no `@ts-expect-error`.
- No new npm dependencies.
- Every color must be a `var(--*)` token; zero hex/rgba literals remain in RightPanel.tsx (except `transparent`/`inherit` keywords).
- No `git commit` by the worker; orchestrator commits.
- Verify with `npx tsc --noEmit` and `npm run build` after every task.

---

### Task 1: Wire full adjust params + Reset all (P0)

**Files:**
- Modify: `src/components/RightPanel.tsx:1399-1412` (apply params)
- Modify: `src/components/RightPanel.tsx:1696-1723` (Reset all button)
- Reference (read-only): `src/lib/localOps.ts:991-1021`

**Interfaces:**
- Consumes: `onApplyOperation(op: string, params: Record<string, number | string>) => Promise<string | null>` with `op === "adjust"`.
- Produces: full 8-key params object `{ brightness, contrast, saturation, sharpness, blur, highlights, shadows, temperature }` used by Task 5 verification.

- [ ] **Step 1: Write the failing reproduction script**

Create `C:\Users\Eng-m\AppData\Local\Temp\opencode\rightpanel-check.cjs` (temp dir, never committed):

```js
const fs = require("fs");
const src = fs.readFileSync("src/components/RightPanel.tsx", "utf8");
const applyBlock = src.slice(src.indexOf("async function apply()"), src.indexOf("async function apply()") + 600);
const needKeys = ["brightness", "contrast", "saturation", "sharpness", "blur", "highlights", "shadows", "temperature"];
const missing = needKeys.filter((k) => !applyBlock.includes(k));
const resetBlock = src.slice(src.indexOf("Reset all") - 800, src.indexOf("Reset all"));
const resetWired = /onClick/.test(resetBlock);
console.log("missing-from-apply:", JSON.stringify(missing));
console.log("reset-wired:", resetWired);
if (missing.length !== 0 || resetWired !== true) { console.log("RED: defects reproduced"); process.exit(1); }
console.log("GREEN");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\rightpanel-check.cjs`
Expected: exit 1, `missing-from-apply: ["blur","highlights","shadows","temperature"]`, `reset-wired: false`.

- [ ] **Step 3: Minimal implementation — full params**

Replace the params object in `apply()` with:

```tsx
const params = {
  brightness: values.brightness,
  contrast: values.contrast,
  saturation: values.saturation,
  sharpness: values.sharpness,
  blur: values.blur,
  highlights: values.highlights,
  shadows: values.shadows,
  temperature: values.temperature,
};
```

- [ ] **Step 4: Minimal implementation — wire Reset all**

Give the `Reset all` button a real handler that restores every slider to its `adjustments` default:

```tsx
<button
  onClick={() => setValues(Object.fromEntries(adjustments.map((a) => [a.key, a.default])))}
  className="h-9 px-3 rounded text-xs transition-colors duration-100 shrink-0"
  style={{
    background: "var(--secondary)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    cursor: "pointer",
  }}
>
  Reset all
</button>
```

- [ ] **Step 5: Re-run reproduction + typecheck**

Run: `node C:\Users\Eng-m\AppData\Local\Temp\opencode\rightpanel-check.cjs`
Expected: exit 0, `missing-from-apply: []`, `reset-wired: true`.
Run: `npx tsc --noEmit`
Expected: exit 0, no output.

---

### Task 2: De-mock ComparisonStrip (P1)

**Files:**
- Modify: `src/components/RightPanel.tsx:1778-1832` (`ComparisonStrip` only)

**Interfaces:**
- Consumes: nothing (currently self-contained mock).
- Produces: honest empty-state strip; `RightPanel` default export signature unchanged.

- [ ] **Step 1: Write the failing check**

Append to the temp script (or run inline node):

```js
const src2 = fs.readFileSync("src/components/RightPanel.tsx", "utf8");
const strip = src2.slice(src2.indexOf("function ComparisonStrip"));
const hasMock = strip.includes("OpenCV Inpaint") || strip.includes("LaMa AI");
const hasDeadUse = />Use</.test(strip) && !/onClick/.test(strip.slice(strip.indexOf(">Use<") - 400, strip.indexOf(">Use<")));
console.log("mock-present:", hasMock, "dead-use:", hasDeadUse);
if (hasMock || hasDeadUse) { console.log("RED: mock present"); process.exit(1); }
console.log("GREEN");
```

Run it. Expected: exit 1 (`mock-present: true`).

- [ ] **Step 2: Minimal implementation**

Replace the hardcoded `results` array and result cards with an honest empty state. Keep the collapsible shell, header, chevron rotation, and `expanded` state exactly as-is:

```tsx
function ComparisonStrip() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0 w-full" style={{ borderTop: "1px solid var(--border)", minWidth: 0 }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 transition-colors duration-75"
        style={{ color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)", minWidth: 0 }}>
          Compare results
        </span>
        <ChevronRight
          size={13}
          strokeWidth={2}
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 200ms ease", flexShrink: 0 }}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 w-full" style={{ minWidth: 0 }}>
          <p className="text-xs" style={{ color: "var(--muted-foreground)", fontSize: 11, lineHeight: 1.6, margin: 0 }}>
            No comparison results yet — run an operation that produces variants and they will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
```

Do NOT add fetching logic, props, or backend integration — that is out of scope.

- [ ] **Step 3: Re-run check + typecheck**

Re-run the Step 1 script. Expected: exit 0.
Run: `npx tsc --noEmit`. Expected: exit 0.

---

### Task 3: Theme-token discipline (P1)

**Files:**
- Modify: `src/components/RightPanel.tsx` (only style literals listed below)

**Interfaces:**
- Consumes: CSS vars `--card`, `--secondary`, `--border`, `--accent`, `--muted-foreground` (already defined in `src/index.css:29-67`).
- Produces: zero hex/rgba literals in the file.

- [ ] **Step 1: Write the failing check**

```js
const src3 = fs.readFileSync("src/components/RightPanel.tsx", "utf8");
const literals = src3.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) || [];
console.log("literal-count:", literals.length, JSON.stringify([...new Set(literals)]));
if (literals.length !== 0) { console.log("RED: hardcoded colors remain"); process.exit(1); }
console.log("GREEN");
```

Run it. Expected: exit 1 with the known literal set.

- [ ] **Step 2: Minimal implementation — exact token map (apply all)**

| Location | Old | New |
|---|---|---|
| thumbnail box `:584` | `background: "#2A2927"` | `background: "var(--secondary)"` |
| blend blue `:463` image icon | `color: "#7FB8FF"` | `color: "var(--accent)"` |
| blend pill `:619` + label `:1850` | `rgba(127,184,255,0.15)` border `rgba(127,184,255,0.4)`, `color: "#7FB8FF"` | `background: "color-mix(in srgb, var(--accent) 15%, transparent)"`, border `"1px solid var(--accent)"`, `color: "var(--accent)"`; label color `value !== "source-over" ? "var(--accent)" : "var(--foreground)"` |
| group chip `:526` | `background: "rgba(201,123,74,0.12)"`, border `"1px solid rgba(201,123,74,0.35)"` | `background: "color-mix(in srgb, var(--accent) 12%, transparent)"`, border `"1px solid var(--accent)"` |
| group left-border `:571` | `"rgba(201,123,74,0.5)"` | `"var(--accent)"` (keep full accent: active state already uses it; grouped-but-inactive keeps 2px accent at 50%? No — use plain `var(--accent)` only when active, else `"transparent"`. Simplest correct: `borderLeft: active ? 2px accent : transparent`, drop the third branch) |
| drag ghost `:570` | `"rgba(201,123,74,0.08)"` | `"color-mix(in srgb, var(--accent) 8%, transparent)"` |
| aspect lock `:793,795` | `"rgba(201,123,74,0.12)"` / `"1px solid rgba(201,123,74,0.4)"` | `"color-mix(in srgb, var(--accent) 12%, transparent)"` / `"1px solid var(--accent)"` |
| Group buttons `:519` + Mask Apply `:1964` | `color: "#fff"` / `color: "#fff"` | `color: "var(--accent-foreground)"` |
| eye-off `:632,688` | `color: "#4A4845"` ternary false-branch | `color: "var(--muted-foreground)"` with `opacity: 0.4` on the button when hidden |
| blend dropdown bg `:638` | `background: "rgba(0,0,0,0.25)"` | `background: "var(--secondary)"` |

Keep `transparent` and `none` keywords untouched. Do not touch `gradientCss` previews in AdjustmentsTab STYLES (they are content previews, not chrome).

- [ ] **Step 3: Re-run check + typecheck**

Re-run Step 1 script. Expected: exit 0, `literal-count: 0`.
Run: `npx tsc --noEmit`. Expected: exit 0.

---

### Task 4: Lucide icon language + tab accessibility (P1/P2)

**Files:**
- Modify: `src/components/RightPanel.tsx` (imports + LayersTab multi bar + MultiSelectPanel + ArrangeRow + iconFor + row glyphs + tab header)

**Interfaces:**
- Consumes: `lucide-react` icons (already a dependency). Verify each named export exists in the installed version before using; if any is missing, fall back to the closest existing one — never invent exports.
- Produces: no unicode-symbol UI controls; tabs expose `role="tablist"` / `role="tab"` / `aria-selected`.

- [ ] **Step 1: Write the failing check**

```js
const src4 = fs.readFileSync("src/components/RightPanel.tsx", "utf8");
const glyphs = ["⇤", "⇔", "⇥", "⤒", "⇕", "⤓", "⤢", "⤡", "⬢", "◐", "◑", "⋮⋮", "◆"];
const found = glyphs.filter((g) => src4.includes(g));
const tabsAccessible = src4.includes('role="tablist"') && src4.includes('role="tab"') && src4.includes("aria-selected");
console.log("glyphs-remaining:", JSON.stringify(found), "tabs-accessible:", tabsAccessible);
if (found.length !== 0 || !tabsAccessible) { console.log("RED"); process.exit(1); }
console.log("GREEN");
```

Run it. Expected: exit 1.

- [ ] **Step 2: Minimal implementation**

1. Extend the lucide import with only verified exports (suggested: `AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, ArrowUpToLine, ArrowDownToLine, MoveUp, MoveDown, ChevronsUp, ChevronsDown, GripVertical, Diamond, Blend, Layers` — drop any that does not exist in `lucide-react@1.45` and reuse the nearest verified one).
2. LayersTab multi bar (`:513-518`): 6 align buttons → the six Align* icons, keeping titles, onClick handlers, and the Group button untouched.
3. `MultiSelectPanel` (`:822-827`): same 6-icon swap.
4. `ArrangeRow` (`:1874-1877`): `⤢ Front` → `ChevronsUp Front`, `↑ Fwd` → `MoveUp Fwd`, `↓ Back` → `MoveDown Back`, `⤡ Back` → `ChevronsDown Back`. Keep labels, titles, handlers.
5. `iconFor` (`:459-467`): background → `ImageIcon`; text → `Type` (keep accent color, now tokenized); shape → `Diamond size={12}`; solid → keep swatch span; remove `⬢`/`◆` spans.
6. Blend pill `◐` (`:619-622`) → `Blend size={10}` inside the same button; mask dot `◑` (`:627-631`) → `Layers size={10}` with the same title/color logic.
7. Drag handle `⋮⋮` (`:583`) + hint text `:665` → `GripVertical size={12}`; update hint copy to "Top = front · drag grip to reorder · Ctrl+click = multi-select · double-click = rename".
8. Tab header (`:147-172`): wrapper gets `role="tablist"` + `aria-label="Right panel tabs"`; each tab button gets `role="tab"` + `aria-selected={activeTab === tab.id}`. Keep all styling, tooltip `title`, and the collapse button unchanged.

- [ ] **Step 3: Re-run check + typecheck + build**

Re-run Step 1 script. Expected: exit 0.
Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run build`. Expected: exit 0, `dist/` emitted.

---

### Task 5: Full verification (orchestrator-owned, worker prepares)

Worker runs, in order, and reports raw output:

1. `npx tsc --noEmit` → exit 0.
2. `npm run build` → exit 0.
3. All four temp check scripts → GREEN.
4. `git diff --stat -- src/components/RightPanel.tsx` → only that file touched.

## Self-Review

- [x] Spec coverage: P0 apply-params + Reset (Task 1), mock strip (Task 2), hardcodes incl. `#fff`/`#4A4845`/dropdown bg (Task 3), unicode + tabs a11y (Task 4), verification (Task 5).
- [x] Placeholder scan: every step has exact code/commands; no TBD/TODO; no "similar to Task N".
- [x] Type consistency: `onApplyOperation` signature reused verbatim; `setValues(Object.fromEntries(...))` matches existing `Record<string, number>` state; no new props or exports; default export untouched.
