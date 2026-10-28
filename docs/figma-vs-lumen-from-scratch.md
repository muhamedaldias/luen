# Figma versus Lumen — and what designing from scratch would take

> **Method:** direct inspection of the project source (`src/` + `backend/`) plus current web research on Figma's capabilities through Config 2026.
> **Date:** September 2026 | **Status:** strategic analysis — not yet an implementation plan.

---

## Executive summary (read this first)

**Figma and Lumen are not the same category at all** — and that is the most important sentence in this document:

| | Figma | Lumen (this project) |
|---|---|---|
| **Category** | Collaborative **vector** UI design tool | **Raster** image editor in the Photopea tradition |
| **Raw material** | Shapes and text that scale without limit | Pixels from photographs |
| **The question it answers** | "How do we build a responsive interface a team can work on?" | "How do we improve or composite this image?" |

**The practical consequence:** roughly 70% of what Figma does should **not** be imitated (real-time collaboration, branching, developer handoff) because it serves a different category. About 30% **should** be borrowed — and that 30% is exactly what "designing from scratch" requires. Part 2 of this document pins down that 30% precisely, with a roadmap.

---

## Part 1 — What Figma does that Lumen does not

### 1-a. Document and drawing model

| Capability | Figma | Lumen today | Gap | Worth it? |
|---|---|---|---|---|
| Bezier pen and Vector Networks | Yes — full node editing | No, none at all (code scan: zero references to bezier/path) | Large | Yes — the foundation of designing from scratch |
| Boolean operations (union/subtract/intersect) | Yes | No | Large | Yes — pairs with the pen |
| Editable primitive shapes | Yes | Partial — rectangle/ellipse/line/arrow as overlay layers drawn interactively (added recently), but with no node editing | Medium | Incremental improvement |
| Artboards / multiple pages | Yes (Frames + Pages) | No — a single canvas | Large | Yes — a prerequisite for any real design |
| Rulers, grids, guides, and snapping | Yes | No (code scan: zero references) | Medium | Yes — cheap to build, high value |
| Pixel preview | Yes | Implicitly yes (everything is pixels) | — | — |

### 1-b. Text and styles

| Capability | Figma | Lumen today | Gap | Worth it? |
|---|---|---|---|---|
| Text engine (families/weights/tracking/leading) | Yes, plus variable fonts | Good — families/weights/italics/gradients/shadows/box | Small | Refinements only |
| Shared styles (colors/text/effects) | Yes — one click updates everything | No — every layer carries its own copy | Medium | Yes — second phase |
| Layout grids | Yes | No | Small to medium | Later |

### 1-c. Design systems and components

| Capability | Figma | Lumen today | Gap | Worth it? |
|---|---|---|---|---|
| Components + Instances (copies that stay in sync) | Yes, plus Variants + Slots (2026) | No (duplication means rigid copies) | Very large | Partially — simplified "symbols" are enough for a graduation project |
| Auto Layout (responsive layout) | Yes, since 2019 | No — absolute positioning only (fractional coordinates 0..1) | Large | A simplified version (row/column + gap) is enough |
| Variables (tokens) | Yes | No | Medium | Later, alongside styles |

### 1-d. Collaboration, prototyping, and handoff

| Capability | Figma | Lumen today | Gap | Worth it? |
|---|---|---|---|---|
| Real-time multi-user editing + comments | Yes — the core of the product | No — single local user | Huge | No — outside the category and the budget entirely |
| Interactive prototyping + motion timeline (2026) | Yes | No | Huge | No — that is a different product |
| Dev Mode + MCP + Code layers (2026) | Yes | No | Huge | No |
| Version history + branches | Yes | Local substitute only: undo with 25 snapshots | Medium | Project file saving (the `.lumen` format) is sufficient |
| Plugins + AI Agent + Weave (2026) | Yes | No (the Agent panel is only reserved space) | Huge | Long-term, later |

### 1-e. Image processing (where **we** are ahead)

| Capability | Figma | Lumen today |
|---|---|---|
| Real pixel retouching (filters/adjustments/sharpness) | Very weak — image layers are for display only | 36 operations (Pillow + OpenCV) plus an offline mode |
| Background or object removal | No | rembg + inpainting |
| Poisson / seamless blending | No | `seamlessClone` |
| Working without internet | No — cloud only | The frontend runs locally, plus a Tauri app |

**Conclusion:** Figma cannot do what Lumen does in the first place — so the right comparison is not "which is better" but "which category are we building?".

---

## Part 2 — Designing from scratch: what it looks like, and what it needs

### 2-1. What does "designing from scratch" mean?

It means a user opens a **blank canvas** and leaves with a design (a poster, a cover, a UI) without any ready-made image — using vector shapes, text, colors, layer ordering, and export. It does **not** mean competing with Figma on collaboration and design systems.

### 2-2. The honest current state: we are about 40% of the way there, not at zero

What genuinely works today (verified against the code and by using the app):

- Blank canvas (`New canvas`), interactive rectangle/ellipse drawing, rich text, solid fills, and image layers
- A complete layer system: reordering, groups, align, distribute, 16 blend modes, opacity, and locking
- A contextual inspector, adaptive undo, and high-quality PNG export

**A mental walkthrough:** design a "50% off" poster right now — filled background, colored rectangle, three text layers, export. **That works today.** What does not work is anything needing free curves, multiple pages, or vector export.

### 2-3. The seven gaps — each with what/why/how/difference/best choice

#### 1) Bezier pen + node editing (the most important — Effort: large, roughly 3-4 weeks)

- **What:** a Pen tool: click to place points, drag to pull curve handles, close the path, move nodes afterwards.
- **Why:** without it, every "design from scratch" is just rectangles and text — no logos, no icons, no freeform shapes. This is the fundamental difference between an image editor and a design tool.
- **How:** a new `path` layer holding an array of points and handles (a simple data model; Figma's complex networks are not needed), rendered through Fabric's `Path`, plus an edit mode that shows the nodes as draggable handles. For export, draw the path onto the export canvas — the structure already exists in `exportComposite.ts`.
- **Difference from Figma:** Figma uses Vector Networks, where more than two segments can meet at a node. We settle for classic Bezier paths, as Photopea and PowerPoint do. Ten times simpler and sufficient for 95% of cases.
- **Best choice:** classic Bezier — a deliberate simplification, not a shortfall.

#### 2) Boolean operations (Effort: medium, roughly 1-2 weeks, after the pen)

- **What:** union/subtract/intersect/exclude between two shapes to produce compound shapes (a crescent, for example, is one circle subtracted from another).
- **Why:** without them the user stays trapped in primitive shapes.
- **How:** an existing library such as `paper.js` for paths, or a clipper algorithm, operating on the path model and storing the result as a new path layer. A destructive result is acceptable, the way Flatten works.
- **Best choice:** a flattened result rather than a live one. Figma keeps it live and reversible, which is a luxury we do not need.

#### 3) Artboards/pages + multi-export (Effort: medium, roughly 2 weeks)

- **What:** several canvases at named sizes (A3 poster, 1080×1920 story) in one document, plus batch export of all of them.
- **Why:** a real designer works on several versions and sizes at once — a single canvas is a toy, not a tool.
- **How:** `artboards: [{id, name, w, h}]` in state, a canvas that lays artboards side by side, layers associated with an `artboardId`, and an export loop.
- **Difference from Figma:** no Pages or hierarchy — a flat list of artboards is enough.

#### 4) Rulers, grids, and snapping (Effort: small, roughly days — the best return per unit of effort)

- **What:** an edge ruler, an optional grid, and automatic snapping to edges and centers while dragging.
- **Why:** it is the difference between a design that is "aligned" and one that is "two pixels off" — the cheapest professional feature available.
- **How:** an overlay in the canvas plus snapping math in `object:moving` (the structure already exists) and guides dragged out of the ruler and stored in state.
- **Best choice:** yes, and build it before the pen — it pays off immediately with the shapes we already have.

#### 5) SVG/PDF export (Effort: medium, roughly 1-2 weeks)

- **What:** output shapes and text as real vector SVG, scalable and usable on the web or in print.
- **Why:** export is PNG-only today (code scan: zero references to SVG), so any design from scratch is trapped in pixels and unusable as a logo or print piece.
- **How:** an SVG generator that lowers the layer model (rect/ellipse/text/path) into SVG elements — no library required. PDF can come later through a library or the browser's print path.
- **Difference from Figma:** export only, with no Dev Mode and no tokens.

#### 6) Styles and symbols — simplified Styles + Symbols (Effort: medium, roughly 2 weeks)

- **What:** (a) shared color and text styles that update every user of them; (b) a "symbol": a group of layers duplicated as copies linked to the original.
- **Why:** without them, any change (a brand color, say) means editing every copy by hand — and that is precisely what makes Figma addictive.
- **How:** `styles: {id, type, value}` with layers referencing a `styleId` instead of a raw value, plus an "update all" action. For symbols: a `symbols` table plus instances carrying a `symbolId` with limited `overrides` (text and color only).
- **Difference from Figma:** no Variants, Slots, or Auto Layout — the "beginner" version that solves 80% of the pain with 20% of the complexity.

#### 7) Project saving + simplified Auto Layout (Effort: medium)

- **What:** (a) a `.lumen` project file (JSON: layers plus settings) with save and open — today the only output is a flattened PNG; (b) a "row/column" container with automatic gap and padding.
- **Why:** (a) without editable saving there is no "project" at all, and every close means lost work — **this is top priority**; (b) full Auto Layout is complex, while a row/column version solves card and list ordering.
- **How:** (a) serialize state plus a file picker for save/open; (b) a `layout: {dir, gap, padding}` on groups, recomputing x/y when it changes.

### 2-4. Proposed roadmap (ordered by return on effort)

| Phase | Contents | Why here? |
|---|---|---|
| **0 — Plug the holes** (one week) | `.lumen` save/open, rulers, grid, and snapping | Without the first there is no product at all, and the rest is the cheapest professionalism available |
| **1 — Escape the primitives** (3-4 weeks) | Bezier pen, boolean operations, SVG export | This is where "designing from scratch" becomes real |
| **2 — Multiple canvases** (two weeks) | Artboards plus batch export | Real design means multiple versions and sizes |
| **3 — Consistency** (two weeks) | Styles, symbols, row/column layout | Turns a drawing tool into a design tool |

**Deliberately out of scope:** real-time collaboration, branching, interactive prototyping, developer handoff, and generative AI. All of those belong to Figma's category rather than ours, and their cost exceeds a graduation project by orders of magnitude.

---

## Final recommendation

1. **Position it correctly:** Lumen is "a small offline Photopea with some Figma touches", not "the next Figma". That is a selling point — privacy, offline operation, a desktop app — not a defect.
2. **The decision needed from you:** is "designing from scratch" an official goal? If so, start with phase 0 (project saving first, non-negotiable), then the pen.
3. **A golden rule for future comparisons:** before requesting any Figma feature, ask "does this serve pixels or vector?" The first is ours; the second is not.

### Sources
- Figma Config 2026 (Motion, Code Layers, Agent, Weave) — the Figma blog and help center.
- Figma VectorNetwork API documentation — developers.figma.com.
- Figma/Photopea/Photoshop comparisons, 2026 — Toolradar, Hedrick, Gitnux, ZipDo.
- Project source: `src/lib/layers.ts`, `src/lib/layerSystem.ts`, `src/lib/exportComposite.ts`, `src/components/Canvas.tsx` (direct inspection).
