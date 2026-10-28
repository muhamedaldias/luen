# Comprehensive Updated Document — Web Photo Editor Project
### (Merges the original document, all fixes, and the implementation plan agreed on afterwards)

This version supersedes the previous document. Any team member needs to consult only this one, and does not need to review the older conversations.

---

## 1. Project Overview

A web photo editor modeled on well-known editors (Photopea, Pixlr), with particular focus on image processing and enhancement, background removal, and image compositing. The team has 3 members. **Important new addition**: the project is built to run **from a single codebase as both a web application and a desktop application** (not as two separate versions).

**Minimum requirements as originally specified:**
- Conversion between image formats
- Background removal
- Drawing on images
- Image operations: crop, upscale, downscale, rotate, transform, flip
- Pixel-level image adjustments (brightness/contrast/saturation/sharpness)
- Filters (smoothing and sharpening)
- Compositing two images
- Selecting a background from a product background library (or generating one)
- Plus additional creative features after the minimum requirements are met

---

## 2. Final Technical Decisions (Stack)

| Component | Final choice | Reason |
|---|---|---|
| Frontend | **React + Vite** (no Next.js) | Avoids SSR/hydration complexity with Fabric.js |
| Routing | **No routing (single page: the editor)** | React Router is deferred together with the sign-in/gallery pages — adding it now bloats the bundle for no benefit |
| Canvas library | **Fabric.js v6.4** (the version actually installed — v7 is not adopted yet) | Mature object model, filters, free drawing, SVG/ClipPath |
| Backend | **FastAPI** | async for I/O, Pydantic, built-in Swagger |
| Heavy processing execution | **`run_in_executor` with `ProcessPoolExecutor`** (updated — used to default to threads) | See section 15-a for full detail |
| Database | **SQLite** via **SQLAlchemy + Alembic** | Switching to PostgreSQL later requires changing only `DATABASE_URL` |
| Storage | local directory `/storage/{user_id}/{image_id}` | sufficient at this scale |
| Background removal | **`rembg`** (model `isnet-general-use`, fallback `u2net`) | the only AI tool adopted for now — see section 12 |
| Image processing | Pillow + OpenCV (division of responsibilities below) | Pillow for the simple cases, OpenCV for fine-grained control |
| Desktop | **Tauri + PyInstaller** | see updated section 11 |

---

## 3. Division of Responsibilities: Pillow versus OpenCV

**Pillow** (`ImageEnhance`, `ImageFilter`, `ImageOps`): format conversion (inspecting the signature rather than the extension), Brightness/Contrast/Saturation/Sharpness, preset filters (BLUR, SHARPEN, EDGE_ENHANCE, EMBOSS, CONTOUR, SMOOTH), autocontrast, equalize, invert, posterize, solarize, mirror/flip.

**OpenCV** (`imgproc` + `photo`): color conversions (RGB↔HSV↔LAB↔Grayscale), affine/perspective transform, Gaussian/Median/Bilateral blur and sharpening with custom kernels, morphological operations to clean background-removal masks, edge detection (Canny/Sobel/Laplacian), thresholding (Otsu/Adaptive), histogram equalization/CLAHE, classical inpainting, denoising, **`cv2.seamlessClone`** for compositing two images.

---

## 4. Implementation Detail for Each Minimum Requirement

| Feature | Technology |
|---|---|
| Format conversion | Pillow (server) + `canvas.toDataURL()` (client) |
| Background removal | `rembg` + mask cleanup with morphological operations |
| Drawing | Fabric.js `PencilBrush` + `freeDrawingMode` |
| Crop/upscale/downscale/rotate/transform/flip | Fabric.js (live preview) + Pillow/OpenCV (final execution), `INTER_AREA` for downscaling and `INTER_LANCZOS4` for upscaling |
| Pixel-level adjustments | Pillow `ImageEnhance` or LAB (adjusting the L channel only) |
| Smoothing/sharpen filters | OpenCV, executed on the server |
| Compositing two images | Fabric.js layers + `cv2.seamlessClone` |
| Background library | colors/gradients/patterns generated programmatically + a classical drop shadow |

---

## 5. High-Quality Standards

- Internal processing at **float32** precision, converted to uint8 only at the final save
- Preserving the **alpha channel** throughout the pipeline
- Never using JPEG as an intermediate format (PNG only; JPEG at final export)
- Choosing a resize algorithm that matches the direction of the operation
- Adjusting contrast/brightness through LAB rather than RGB directly

---

## 6. Backend Architecture: the Operation Registry

Every operation is a separate endpoint, bound in a dictionary instead of a long if/else chain:

```python
OPERATIONS = {
    "crop": classical_crop,
    "sharpen": classical_sharpen,
    "auto_enhance": classical_clahe,
    "remove_background": call_rembg,
}

@app.post("/api/operations/{operation_name}")
async def run_operation(operation_name: str, image_id: str, params: dict):
    handler = OPERATIONS.get(operation_name)
    if not handler:
        raise HTTPException(404, "unknown operation")
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(process_pool, handler, image_id, params)
    return {"status": "done", "result_url": result}
```

**Why this pattern**: it allows swapping the engine later with a one-line change, and it is exactly what the future AI agent feature needs (every key is a ready-made tool).

---

## 7. The "Run Multiple Engines in Parallel" Architecture (Fan-out/Fan-in)

It is used for at most one or two features (the candidate: object removal), where the result differs visually between the classical and the AI approach:

```python
COMPARISON_OPERATIONS = {
    "remove_object": [
        {"engine": "opencv_classical", "handler": classical_inpaint},
        {"engine": "iopaint_lama", "handler": call_iopaint},  # deferred, see section 12
    ]
}

@app.post("/api/compare/remove_object")
async def remove_object_compare(image_id: str, mask: dict):
    tasks = [run_engine_safely(e["handler"], image_id, mask) for e in COMPARISON_OPERATIONS["remove_object"]]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [{"engine": e["engine"], "result_url": r}
            for e, r in zip(COMPARISON_OPERATIONS["remove_object"], results)
            if not isinstance(r, Exception)]
```

It is not applied to operations that have a single mathematically correct answer (crop, rotation).

---

## 8. Database — Local and Scalable

SQLAlchemy ORM, `DATABASE_URL` as an environment variable, avoiding SQLite-specific features, Alembic from the start.

**New addition (see section 15-e)**: when a project/image is deleted, the actual files must be deleted from `/storage/`, not just the database record (cascade delete), to avoid accumulating orphaned files on disk.

---

## 9. Multiple Pages

Multiple pages are **deferred**: the application is currently a single page (the editor only). When needed: React Router without Next.js, for the sign-in pages and the projects dashboard/gallery.

---

## 10. Why Not Next.js for Now

`next/image` is of no use inside an interactive canvas, and Fabric.js requires additional precautions with SSR. Migrating later is feasible with 3 days of effort, provided you maintain a clean separation of the Fabric.js components.

---

## 11. Desktop Application — From the Same Code (updated and detailed)

**The core idea**: not building two applications, but **the exact same repository**, built twice with two different outputs:

- **Frontend**: the same React with no changes. The only difference is the `VITE_API_URL` environment variable:
  - web build → `https://your-domain.com/api`
  - desktop build → `http://localhost:8000/api`
- **Backend**: the same FastAPI code. In the desktop version it is converted via **PyInstaller** into a standalone executable that does not require Python to be installed on the user's machine; it is launched automatically as a child process (a "sidecar" in Tauri terminology) when the application opens on `localhost:8000`, and stopped on exit.
- **Display window**: Tauri does not bundle a full browser (unlike Electron) but uses the rendering engine built into the system (WebView2/WebKit) — which is why it is only 10-20 MB versus 150-300 MB for Electron.

**Note on the rembg model (~44-176 MB depending on the chosen model)**: it is either bundled into the installer (works offline from the first run, at the cost of a larger size) or downloaded on first run.

**Implementation-timing recommendation (new)**: do not postpone the full packaging experiment (Tauri+PyInstaller) to the end. Try it early as a "smoke test" after the first real feature works (see stage 7 in section 16), because PyInstaller may not detect libraries such as OpenCV/rembg automatically (they need explicit `--add-data`/`--hidden-import`), and it is far better to discover that early than on the last day before delivery.

---

## 12. Artificial Intelligence — Updated Final Decision

### Adopted for now: rembg only

**What it is**: a Python library (`pip install rembg`) that runs on top of **ONNX Runtime** (it does not require a full PyTorch installation or a GPU). It can be used as a library, a CLI, or an HTTP server. On first use it downloads the model automatically and stores it locally (`~/.u2net/`).

**Models available inside it**:

| Model | Approximate size | Best-suited use |
|---|---|---|
| `u2net` | ~176 MB | general purpose, highest accuracy, the default |
| `u2netp` | ~4.7 MB | a smaller and faster version |
| `u2net_human_seg` | moderate | images of people |
| `u2net_cloth_seg` | ~168 MB | clothing segmentation |
| `silueta` | ~43 MB | compressed for size |
| **`isnet-general-use`** (selected) | ~44-170 MB | the newest, with more precise edges (hair, for example) — **the primary recommendation** |
| `isnet-anime` | ~168 MB | anime characters |
| `sam` | large | very general but heavier — **not used from within rembg at present** |

**Speed on CPU**: perfectly acceptable — roughly **1-2 seconds per image** on an ordinary processor via ONNX Runtime (by comparison, alternatives built on a full PyTorch installation took 10-44 seconds in similar tests). **A completely sound decision — this is the only item from the old AI section that runs at a reasonable speed without a GPU.**

**Decisive implementation advice**: load the session (`new_session("isnet-general-use")`) **once at server startup**, not on every request — recreating it on each call adds artificial slowness that does not reflect reality.

### Deliberately deferred (to be added later when needed / when a GPU is available)
LaMa via IOPaint (object removal), Real-ESRGAN (upscaling), SAM/SAM2 (smart selection), GFPGAN/CodeFormer (face restoration), DeOldify/DDColor (colorization), Stable Diffusion (generating a background from text).

**Reason**: all of these models implicitly assume a GPU in order to run at an acceptable interactive speed (SAM and Stable Diffusion on CPU can take seconds to minutes per image) — impractical without a GPU actually available to the team.

---

## 13. The AI Agent Feature — Later Stage, Unchanged

A panel where the user connects their own API key, writes a request in natural language, and the model executes it through function calling via the same operation registry (section 6). **Deferred security note** (see section 15-f): how the API key is stored and passed requires an architectural decision at actual implementation time, not now.

---

## 14. Interface Design (UI/UX)

**The source of truth is now Figma** (the design is ready). The layout: a top menu bar, a left vertical toolbar, a central canvas, a right panel with tabs (Layers/Adjustments/History), an optional bottom status bar, and an additional collapsible panel reserved for the AI agent panel later.

**Color system**: a warm background close to black (`#121212`-`#141312`), raised surfaces `#1C1B1A` with a `#2A2927` border, primary text `#EDEBE7` and secondary text `#9C9891`, a single accent color (terracotta `#C97B4A` or turquoise green `#5FA88E`), and muted semantic colors.

**Build tools**: Tailwind CSS, custom interface components in the project's own style (shadcn/ui was never actually adopted — it was proposed in the initial design), react-resizable-panels, Lucide Icons (outline only).

**Explicitly avoid**: decorative purple-blue gradients, excessive glassmorphism, more than one accent color on the same screen, icons in mixed styles, emoji inside the interface.

---

## 15. Agreed Fixes and Improvements (a complete new section)

### a) Replacing the default `run_in_executor` with `ProcessPoolExecutor`

**Problem**: `run_in_executor(None, ...)` uses a **ThreadPoolExecutor** by default — threads that share the same process and are constrained by the **Python GIL** (only one thread executes Python bytecode at any given moment). Image processing (rembg/OpenCV/Pillow) is purely **CPU-bound** work, so this does not provide real parallelism across multiple cores when several requests arrive concurrently.

**Solution**:
```python
from concurrent.futures import ProcessPoolExecutor
process_pool = ProcessPoolExecutor(max_workers=4)  # based on the server's core count

loop = asyncio.get_running_loop()
result = await loop.run_in_executor(process_pool, handler, image_id, params)
```

**The difference**: ProcessPoolExecutor runs each task in a **completely separate process** with its own Python interpreter, so it bypasses the GIL entirely and makes genuine use of multiple cores. **Why this is "the best" option rather than Celery/Redis for now**: it solves the problem in two lines, with no new infrastructure (a separate broker/worker), in keeping with the avoidance of over-engineering followed in the other decisions. Moving to Celery later happens only under a real load requirement (priority queues, automatic retries, distribution across separate servers).

### b) Image size/dimension handling — applied now (not deferred)

A deeper problem than the file size limit: a **decompression bomb** — a small file on disk that decodes to enormous dimensions in memory when opened.

```python
from PIL import Image
import io

Image.MAX_IMAGE_PIXELS = 64_000_000   # set globally at application startup
MAX_FILE_SIZE_MB = 15
MAX_DIMENSION = 8000                   # pixels per side

def validate_uploaded_image(file_bytes: bytes):
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, "file size exceeds the allowed limit")
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception:
        raise HTTPException(400, "the file is not a valid image")
    img = Image.open(io.BytesIO(file_bytes))  # reopened after verify()
    if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
        raise HTTPException(400, f"dimensions exceed {MAX_DIMENSION}×{MAX_DIMENSION}")
    return img
```

This check is the **first thing** in the upload endpoint, before any processing, and is entirely independent of the user system — so it is implemented now even though the remaining security gaps are deferred.

### c) Mechanism for notifying the interface when asynchronous processing finishes: simple polling

The general rule: WebSocket is for high-frequency bidirectional connections (chat, real-time collaboration) — **not our case**. To track the status of a single background job, the standard pattern is **polling**:

```
POST /api/operations/{name}            → {"job_id": "...", "status": "processing"}
GET  /api/operations/{job_id}/status   → polled every 1-1.5 seconds from the interface
                                          → {"status": "done", "result_url": "..."} or {"status": "processing"}
```

It is applied only to operations slower than half a second (rembg and similar) — instantaneous operations (crop, rotation) remain synchronous, with no `job_id`. **A future upgrade if you need it**: SSE (Server-Sent Events) instead of repeated polling — far simpler than WebSocket.

### d) Undo/Redo — a bounded-depth Memento

**How Photoshop/Figma actually do it**: the **Command** pattern (storing each operation and its inverse only, not the entire state) — because their documents are far too large for saving a full snapshot on every change to be memory-viable. Figma specifically uses an operation log because of its real-time collaborative nature.

**The realistic recommendation for your project's scale** (rather than imitating Photoshop literally — an unjustified investment at your size):
- Use a **simplified Memento** via Fabric.js's built-in `canvas.toJSON()` / `canvas.loadFromJSON()` — a snapshot after each modifying operation (not after every mouse movement).
- **Bound the stack depth** (only the last 20-30 states, with older ones discarded automatically) to avoid memory exhaustion.
- This is a deliberate and entirely acceptable engineering trade-off for a graduation project, not a shortcoming.

### e) Data retention policy: cascade delete only

When a project/image is deleted from the projects dashboard, delete the actual files from `/storage/{user_id}/{image_id}` and not just the database record (via a SQLAlchemy event listener) — to avoid accumulating orphaned files on disk. There is no need for a more complex automatic deletion system than this for a graduation project.

### f) Fabric.js performance limits: separating display resolution from document resolution

**What Photopea actually does**: it separates the **interactive display resolution** from the **true document resolution**. The solution for you: cap the interactive display in Fabric.js (for example, 4096 pixels on the longest side) regardless of the actual uploaded dimensions (up to 8000, as in item b), while every final operation (crop/filter/background removal) is executed on the server against the original full-resolution file, and the result is returned.

### g) A lightweight testing strategy

`pytest` + FastAPI's `TestClient` (built into Starlette, requiring almost no extra installation). Covered: uploading a valid/invalid image, every operation in the registry returning a sensible result, and the boundary cases from item b. The person responsible for integration/testing starts on this immediately, in parallel with feature development.

### h) Deferred security gaps (an explicit decision — to be added after the core program is complete)
- The sign-in page and authentication strategy (JWT or session)
- How to store and pass the AI agent feature's API key securely
- Strict validation of file access permissions (matching `user_id` in every endpoint to prevent IDOR vulnerabilities)

---

## 16. Final Phased Implementation Plan (after the Figma design is ready)

| # | Stage | Why this order specifically |
|---|---|---|
| 0 | Repository bootstrap + a `/health` test between both sides | Surfaces infrastructure problems (CORS, connectivity) early and cheaply, before investing time in features |
| 1 | Extracting the design system from Figma into `tailwind.config.js` and re-theming shadcn/ui immediately | Prevents relying on shadcn's default colors "temporarily" and then forgetting to change them — the switch becomes impossible to get wrong from day one |
| 2 | The empty visual shell, matching Figma with no real logic | Separates the question "is the layout visually correct?" from "does the logic work?", which makes defects easier to trace later |
| 3 | The first complete vertical slice: upload an image (with the section 15-b checks) → display it in Fabric.js (at the capped preview resolution, section 15-f) | This is the backbone that every later feature depends on without exception |
| 4 | Proving the registry pattern with a single simple operation only (crop, for example) end to end, using `ProcessPoolExecutor` | Exercises the entire architecture horizontally once, instead of discovering the same problem 8 times later by 3 people working from different assumptions |
| 5 | Expanding the remaining operations in parallel across members + polling for the slower operations + integrating rembg | Safe for genuine parallelism across members now that the pattern is proven from stage 4 |
| 6 | Undo/Redo (bounded-depth Memento, section 15-d) | Depends on the canvas state shape being stable once the operations are stable — building it before that means rewriting it later |
| 7 | Trying Tauri+PyInstaller packaging early as a "smoke test", then full final packaging near delivery | PyInstaller may not detect libraries such as OpenCV/rembg automatically — discovering that early leaves time to correct it, unlike the last day |

---

## 17. Mistakes to Avoid (updated)

- Running image processing directly inside an async route without an executor, **or using the default ThreadPoolExecutor for purely CPU-bound work** (use ProcessPoolExecutor)
- Losing the alpha channel between processing steps
- Using JPEG as an intermediate format during processing
- **Not setting `Image.MAX_IMAGE_PIXELS`** (and not merely limiting file size in megabytes) — this opens the door to a decompression bomb attack
- Neglecting CORS configuration
- Using SQLite-specific features that block a later migration
- Applying the "run multiple engines" pattern to everything instead of one or two features
- Using the default shadcn theme without re-theming
- **Deleting a record from the database without deleting the actual file from `/storage/`** (orphaned files)
- **Building Undo/Redo before the final shape of the operations is stable**
- **Postponing the Tauri packaging experiment entirely to the end** instead of an early smoke test

---

## 18. Summary of Everything Deliberately Deferred to Later Stages (updated)

- Migration to Next.js (if we actually need API routes/SSR)
- The AI agent feature (AI agent panel) — the architecture is ready for it via the registry pattern
- Heavier AI models: LaMa/IOPaint, Real-ESRGAN, SAM/SAM2, GFPGAN/CodeFormer, DeOldify/DDColor, Stable Diffusion — added once a real GPU is available
- **Security gaps**: sign-in and authentication, API key security for the agent, strict validation of file access permissions (`user_id`)
- MinIO / external PostgreSQL / Redis+Celery — only under an actual need for real load
- Docker Compose + full CI/CD — the last stage
- Heavy creative features (AI background generation, real-time collaboration, colorization, face restoration) — at most one or two features
