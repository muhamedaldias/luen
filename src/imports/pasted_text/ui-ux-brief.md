You are designing the UI/UX for a professional web-based photo editor (React + Vite + Fabric.js canvas + FastAPI backend). The product rivals Photopea and Pixlr in capability but must feel like a distinct, premium, hand-crafted creative tool — not a generic dashboard template and not something that reads as "AI-generated." Study the restrained, confident visual language of products like Linear, Arc Browser, Raycast, and Framer as your quality bar: purposeful whitespace, subtle depth, one disciplined accent color, no decorative gradients for their own sake, no glassmorphism overload, no default out-of-the-box component library look.

═══════════════════════════════════════
PRODUCT CONTEXT
═══════════════════════════════════════
- A browser-based image editor: format conversion, background removal, freehand drawing, crop/resize/rotate/flip/transform, pixel adjustments (brightness/contrast/saturation/sharpness), blur/sharpen filters, two-image merging, and a background library.
- Advanced features layered on top: a "multi-engine comparison" flow (e.g. object removal run simultaneously via classical OpenCV inpainting AND an AI engine like IOPaint/LaMa, with results shown side-by-side for the user to pick visually), an AI upscaler, smart object selection (Segment Anything-style), and — planned for a later phase — a collapsible AI agent panel where the user connects their own API key and issues natural-language edit requests.
- Canvas engine: Fabric.js. Backend: FastAPI, exposed as one clean endpoint per operation.
- Target feel: calm, confident, focused — a tool a professional would trust with real work, not a flashy toy.

═══════════════════════════════════════
LAYOUT ARCHITECTURE
═══════════════════════════════════════
Standard professional editor structure (validated against Photopea/Photoshop conventions), built with resizable, collapsible panels (react-resizable-panels), not fixed divs:

1. Top bar (slim, ~48px): app logo/name, File/Edit/Image/Layer/Filter menu, and a right-aligned cluster of primary actions (Save, Export, Undo/Redo) — visually distinct from the menu items so primary actions never get lost among dropdowns.
2. Left toolbar (icon-only, vertical, ~56px wide): selection, crop, brush, text, shapes, smart-select tools. Active tool gets a subtle filled background in the accent color, not just a color change on the icon — the active state must be unmistakable at a glance.
3. Center canvas: the dominant space. Zoom controls bottom-left or bottom-right, floating, semi-transparent until hovered. Canvas rendered at 2x device pixel ratio internally (borrowed from OpenDesign's Fabric.js approach) so exports and on-screen rendering stay crisp on retina displays.
4. Right panel (tabbed: Layers / Adjustments / History): this is where the multi-engine comparison results will render as a horizontal set of result thumbnails with a clear "Use this" affordance on hover, and where the numeric property inspector lives (X, Y, Width, Height, Rotation as live-editable number fields synced bidirectionally with canvas drag handles — borrowed from open-design's Figma-like precision panel). This panel must feel like the "cockpit" of the tool: dense but never cluttered, using consistent 8px spacing rhythm.
5. Bottom status bar (optional, slim): zoom percentage, image dimensions, save state indicator.
6. A collapsible right-edge dock (built on the same resizable-panel system, hidden by default) reserved for the future AI agent chat panel — design its collapsed/expanded states now even if the feature ships later, so the layout never needs restructuring.

═══════════════════════════════════════
COLOR SYSTEM — calm, creative, harmonious, NOT generic-SaaS-blue
═══════════════════════════════════════
Avoid the overused "dark slate + electric blue" SaaS default and the overused "purple gradient hero" AI-tool cliché. Instead:

- Base canvas background: a very slightly warm near-black, #121212 to #141312 — never pure #000000 (harsh) and never a cold blue-gray (reads as generic dashboard).
- Elevated surfaces (panels, toolbars): #1C1B1A, one visible step lighter than base, with a 1px hairline border at #2A2927 — depth through layering, not shadows or gradients.
- Primary text: #EDEBE7 (warm off-white, not stark white). Secondary/muted text: #9C9891.
- Single accent color: a muted, dusty terracotta-amber (#C97B4A) or a desaturated sage-teal (#5FA88E) — pick ONE and apply it with restraint: active tool state, primary CTA, selection outline, focus rings. Never more than one accent color competing for attention on screen at once.
- Semantic colors (used sparingly, only for real states): success #6FA87A, warning #D6A24A, danger #C6604F — all desaturated to match the warm-neutral base rather than saturated stock red/green/amber.
- Reasoning to bake into every screen: warm neutrals read as "creative studio," not "AI dashboard"; a single restrained accent (instead of gradients or multi-color palettes) is what makes Linear/Arc/Raycast feel premium and deliberate rather than templated.

═══════════════════════════════════════
TYPOGRAPHY & ICONOGRAPHY
═══════════════════════════════════════
- One sans-serif family throughout (e.g. Inter or a comparable geometric sans), two weights only: regular and medium — never more than two weights, this is what keeps dense toolbars feeling calm instead of noisy.
- Icons: outline-style only (Lucide or Tabler icon sets), consistent stroke width, no mixed filled/outline icons anywhere in the same view.

═══════════════════════════════════════
COMPONENT LIBRARY & IMPLEMENTATION STACK
═══════════════════════════════════════
- Tailwind CSS for styling tokens (map the color system above to CSS variables, not hard-coded hex scattered through components).
- shadcn/ui (Radix UI primitives underneath) for buttons, dropdowns, dialogs, tabs, tooltips, sliders — but re-skin every default shadcn component with the color system above; the brief explicitly forbids shipping shadcn's out-of-the-box zinc/slate default theme, since that is the single most common way a UI reads as "generic AI-generated template."
- react-resizable-panels for the entire panel layout (left toolbar / center canvas / right panel / bottom-right agent dock) — draggable dividers, persisted panel sizes, collapsible panels with smooth width transitions (200ms ease, not abrupt).
- Fabric.js for the canvas itself, rendered at 2x pixel density as noted above.

═══════════════════════════════════════
INTERACTION & MICRO-UX DETAILS THAT MUST NOT BE SKIPPED
═══════════════════════════════════════
- Every slider (brightness, contrast, saturation, sharpness) updates the canvas live and client-side only — no server round-trip while dragging, only on explicit "Apply."
- Hover states on toolbar icons: a soft 100ms fade-in tooltip below the icon naming the tool, plus a barely-visible background tint — restraint over decoration.
- The multi-engine comparison results must appear progressively as each engine finishes (fast classical result first, slower AI result fades in after), never as a single blocking spinner that hides everything until all engines complete.
- Loading states for AI operations (background removal, object removal, upscaling) use a calm, minimal progress indicator with a short human-readable status ("Removing background…") — never a generic spinner with no context, and never playful/cartoonish loading animations that undercut the "professional tool" feel.
- Empty canvas state (before any image is uploaded): a large, calm drag-and-drop zone with a single clear instruction and no decorative illustration — clarity over cuteness.

═══════════════════════════════════════
WHAT TO EXPLICITLY AVOID
═══════════════════════════════════════
- No purple-to-blue decorative gradients, no glowing blur orbs behind content, no glassmorphism panels — these are the most recognizable "AI-generated landing page" tells and must not appear anywhere in this tool.
- No default unmodified shadcn/ui theme colors.
- No emoji anywhere in the interface.
- No more than one accent color visible in any single screen.
- No filled-icon and outline-icon mixing.

Deliver: a layout description (or working component structure) plus a complete color/typography token set matching the system above, ready to be implemented directly in Tailwind config and shadcn theme variables.