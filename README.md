# 🌟 Lumen — Professional Hybrid Photo & Graphics Suite

<div align="center">

![Lumen Banner](https://img.shields.io/badge/LUMEN-PHOTO_EDITOR-C97B4A?style=for-the-badge&logo=adobephotoshop&logoColor=white)

**A high-performance, studio-grade raster photo editor and creative graphics suite built for Web & Desktop.**  
*Combines the fluidity of modern React 19 & Fabric.js with the algorithmic power of FastAPI, OpenCV, Pillow, and AI.*

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer_Vision-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2_Desktop-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[Features](#-key-features) • [Architecture](#-system-architecture) • [Tech Stack](#-technology-stack) • [Getting Started](#-getting-started) • [API Guide](#-api--operations-registry) • [العربية](#-نظرة-عامة-باللغة-العربية)

</div>

---

## 📖 Overview

**Lumen** is engineered to deliver a seamless, Photoshop-grade raster editing experience directly within modern web browsers and as a lightweight native desktop application. 

Instead of choosing between a pure client-side editor (which struggles with heavy mathematical vision algorithms) and a heavy cloud-only service (which introduces network latency for interactive tasks), Lumen introduces a **Dual-Engine Hybrid Architecture**:
1. **Interactive Client Stage (Fabric.js & Canvas 2D):** Instant sub-millisecond feedback for dragging, drawing, text styling, layer reordering, snapping, and vector overlays with a memory-safe preview resolution ceiling.
2. **Industrial Vision Engine (FastAPI & Multi-Core Process Pool):** Full-precision (`float32`), multi-threaded image processing running on multi-core CPU workers with OpenCV, Pillow, and AI ONNX Runtime models.
3. **Full Offline Fallback:** When working without internet or without a running backend, Lumen seamlessly switches to a pure local Canvas 2D engine so you can continue editing without interruption.
4. **Single Codebase, Dual Output:** Runs natively on the Web and compiles to a lightweight **15MB Native Desktop App** via **Tauri v2** and **PyInstaller Sidecar**.

---

## ✨ Key Features

### 🎨 Layer System & Composition
- **Multi-Type Layer Stack:** Full support for Image Layers, Text Layers, Shape Layers (`Rect`, `Ellipse`), and Solid Fill Layers.
- **16 Professional Blend Modes:** Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion, Hue, Saturation, Color, and Luminosity.
- **Layer Masks (Alpha Masks):** Non-destructive white/black masks with live editing, invert, disable/enable, and bake-in options.
- **Smart Alignment & Grouping:** Group multiple layers, multi-select, and automatically align (Left, Center, Right, Top, Middle, Bottom) or distribute along X/Y axes.
- **Snapping & Smart Guides:** Interactive visual magnetic snapping to document bounds (0, 50%, 100%) and sibling layer edges with live orange guide lines.

### 🔬 Advanced Image Processing & Vision Algorithms
- **Seamless Image Blending (Poisson Cloning):** Incorporates `cv2.seamlessClone` (`NORMAL_CLONE`, `MIXED_CLONE`, `MONOCHROME_TRANSFER`) solving Poisson partial differential equations for seamless photo integration.
- **Laplacian Pyramid Blending:** Multi-band 5-level Laplacian pyramid blend (Burt & Adelson) eliminating visible seam lines in wide composites.
- **Reinhard Color Matching:** Automatic LAB color space transfer matching mean and standard deviation between foreground and background.
- **5-Stage Pro Enhancement (`pro_enhance`):**
  1. Edge-preserving denoising via `fastNlMeansDenoisingColored`.
  2. Gray-World white balancing.
  3. Local adaptive contrast (CLAHE) on the LAB Luminance channel.
  4. Selective Vibrance boosting muted colors while preserving skin tones.
  5. Detail-masked Unsharp Masking using a Laplacian filter to avoid haloing smooth regions.
- **Photoshop-Grade Curves & Levels:**
  - **Natural Cubic Splines:** Solved via Thomas' algorithm over tridiagonal systems across 0..255 LUTs.
  - **Input/Output Levels & Gamma:** Per-channel (RGB, R, G, B) mapping.
- **AI Background Removal:** Powered by `rembg` (`isnet-general-use` / `u2net`) with morphological mask cleanup, and an automated graceful fallback to OpenCV `GrabCut`.
- **Intelligent Inpainting (Object Removal):** Navier-Stokes and Telea inpainting with adaptive Laplacian frequency blending and morphological mask dilation.

### 🛡️ Security & Performance Safeguards
- **Decompression Bomb Defense:** Globally enforces `Image.MAX_IMAGE_PIXELS = 64_000_000` with pre-allocation structural validation.
- **Taint-Free Composite Export:** Custom Canvas 2D exporter avoiding SVG `<foreignObject>` to completely eliminate browser `SecurityError: The operation is insecure` bugs.
- **Path Traversal Protection:** Regex-whitelisted storage endpoints ensuring all file operations are isolated within user directories.
- **Memory-Adaptive History (Undo/Redo):** Dynamic Memento depth scaling (10 snapshots for 8K/large images, 15 for medium, 25 for standard) preventing browser Out-Of-Memory crashes.
- **Native `.lumen` Project Format:** Lossless JSON-based project serialization preserving full editable layer hierarchies.

---

## 🏗 System Architecture

```
                                    +------------------------------------------+
                                    |         Lumen Client (React 19)          |
                                    |  +------------------------------------+  |
                                    |  | Fabric.js Stage & Interactive UI   |  |
                                    |  +------------------+-----------------+  |
                                    +---------------------|--------------------+
                                                          |
                                      +-------------------+-------------------+
                                      |                                       |
                       [Backend Connected: High-Res]             [Offline: Client Fallback]
                                      |                                       |
                                      v                                       v
                     +----------------------------------+    +----------------------------------+
                     |        FastAPI REST API          |    |     Client localOps.ts Engine    |
                     |  +----------------------------+  |    |  - Canvas 2D Pixel Loops         |
                     |  | Security & Upload Guards   |  |    |  - Convolution Matrix Kernels    |
                     |  +--------------+-------------+  |    |  - In-Browser Blur & Adjustments |
                     |                 |                |    +----------------------------------+
                     |  +--------------v-------------+  |
                     |  | ProcessPoolExecutor (4-core|  |
                     |  +--------------+-------------+  |
                     |                 |                |
                     |  +--------------v-------------+  |
                     |  |     Operation Registry     |  |
                     |  | - OpenCV (Poisson/Inpaint) |  |
                     |  | - Pillow (Lanczos/Enhance) |  |
                     |  | - rembg / ONNX Runtime     |  |
                     |  +----------------------------+  |
                     +----------------------------------+
```

---

## 💻 Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend Framework** | **React 19**, **Vite 8**, **TypeScript 5.7** | Core UI reactivity, fast HMR, strict type safety |
| **Canvas Engine** | **Fabric.js v6.4** | High-performance 2D interactive canvas, vector text & shapes |
| **Styling & Theme** | **Tailwind CSS v4**, Lucide Icons | Responsive panels, modern aesthetic, 5 studio themes |
| **Layout Management** | `react-resizable-panels` | Photoshop-style dockable & resizable panels |
| **Backend API** | **FastAPI**, **Uvicorn**, Pydantic v2 | Asynchronous I/O, REST endpoints, OpenAPI docs |
| **Execution Pool** | `concurrent.futures.ProcessPoolExecutor` | Bypasses Python GIL for true multi-core CPU parallelism |
| **Computer Vision** | **OpenCV (cv2)**, **NumPy** | Seamless clone, inpainting, CLAHE, LAB color space, transforms |
| **Image Core** | **Pillow (PIL)** | Lanczos resampling, format encoding, pixel validation |
| **AI Background Removal** | **rembg** (`isnet-general-use`, ONNX Runtime) | Zero-GPU background extraction (~1-2s CPU) |
| **Desktop Shell** | **Tauri v2 (Rust)** | Native OS WebView2 wrapper (15-25MB footprint) |
| **Desktop Backend** | **PyInstaller** | Bundles FastAPI & libraries into an autonomous executable sidecar |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0 or higher (v22+ recommended)
- **pnpm** or **npm**
- **Python**: v3.10 or higher
- *(Optional for Desktop Build)*: **Rust** toolchain & Tauri CLI

---

### 1. Clone the Repository
```bash
git clone https://github.com/muhamedaldias/luen.git
cd luen
```

---

### 2. Frontend Setup (Web)
```bash
# Install dependencies
pnpm install
# or: npm install

# Start development server
pnpm dev
# or: npm run dev
```
The application will launch on `http://localhost:8443` (or `http://localhost:5173`).

---

### 3. Backend Setup (FastAPI)
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

### 4. Desktop Packaging (Tauri + PyInstaller)

To build the native standalone desktop application:

```powershell
# 1. Build the production frontend bundle
npm run build

# 2. Package the backend executable via PyInstaller
cd backend
pip install pyinstaller
pyinstaller lumen.spec --noconfirm

# 3. Copy backend binary to Tauri binaries directory
Copy-Item dist\lumen-backend\lumen-backend.exe ..\src-tauri\binaries\lumen-backend-x86_64-pc-windows-msvc.exe

# 4. Build native desktop installer
cd ..\src-tauri
cargo tauri build
```

---

## 📡 API & Operations Registry

All backend operations follow the unified registry pattern:

```http
POST /api/operations/{operation_name}
Content-Type: application/json

{
  "image_id": "32_hex_id",
  "params": { ... }
}
```

### Supported Operations:
| Operation Key | Description | Engine | Mode |
|---|---|---|---|
| `crop`, `resize`, `rotate`, `flip` | Spatial transformations with Lanczos resampling | Pillow / OpenCV | Sync |
| `adjust` | Brightness, contrast, saturation, shadows, highlights in LAB | OpenCV / Pillow | Sync |
| `auto_enhance` | Local contrast adaptive histogram equalization (CLAHE) | OpenCV | Async (Job) |
| `pro_enhance` | 5-stage professional vision pipeline | OpenCV | Async (Job) |
| `blend` | Poisson Seamless Cloning & Laplacian multi-band blending | OpenCV | Async (Job) |
| `remove_background` | AI background removal (`isnet-general-use` / `GrabCut`) | rembg / OpenCV | Async (Job) |
| `remove_object` | Navier-Stokes & Telea inpainting with mask dilation | OpenCV | Sync |
| `levels`, `curves` | Photoshop-grade color levels and natural cubic splines | NumPy / Sci | Sync |
| `blur`, `sharpen`, `vignette` | Gaussian filters, unsharp masks, and vignette gradients | OpenCV / Pillow | Sync |
| `invert`, `posterize`, `solarize` | Artistic and tonal color operations | Pillow / NumPy | Sync |
| `upscale` | High-quality 2x / 4x Lanczos4 interpolation with pixel cap | OpenCV | Async (Job) |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Tool / Action |
|---|---|
| `V` | **Select Tool** (Move, scale, transform) |
| `C` | **Crop Tool** |
| `B` | **Brush Tool** (Freehand drawing) |
| `E` | **Eraser Tool** |
| `T` | **Text Tool** (Add text box) |
| `U` | **Shape Tool** (Rectangles & Ellipses) |
| `W` | **Smart Select / Magic Wand** |
| `Q` | **Quick Select Tool** |
| `I` | **Eyedropper Tool** |
| `H` | **Pan Tool** |
| `Z` | **Zoom Tool** |
| `Ctrl + Z` / `Cmd + Z` | **Undo** (Adaptive Memento history) |
| `Ctrl + Y` / `Cmd + Shift + Z` | **Redo** |
| `Ctrl + S` / `Cmd + S` | **Quick Save Project** |

---

## 📁 Project Directory Layout

```
luen/
├── src/                          # Frontend source code (React 19 + TypeScript)
│   ├── components/               # Modular UI Components
│   │   ├── Canvas.tsx            # Fabric.js stage, rulers, guides & snapping
│   │   ├── RightPanel.tsx        # Layers, Design inspector, Adjustments & History
│   │   ├── TopBar.tsx            # Application menu bar & shortcuts
│   │   ├── LeftToolbar.tsx       # Tool selection dock
│   │   ├── BottomBar.tsx         # Status bar & zoom controls
│   │   ├── BlendDialog.tsx       # OpenCV Poisson & Pyramid blending modal
│   │   ├── MenuDialog.tsx        # Levels, Curves, Sizes & Filters modal
│   │   ├── MaskEditor.tsx        # Inpainting mask painter
│   │   └── AgentDock.tsx         # Collapsible AI Agent assistant dock
│   ├── lib/                      # Pure business logic & algorithms
│   │   ├── localOps.ts           # Offline in-browser Canvas 2D image processing
│   │   ├── exportComposite.ts    # Taint-free multi-layer high-resolution exporter
│   │   ├── selection.ts          # Magic Wand & Quick Select algorithms
│   │   ├── layerSystem.ts        # Layer ordering, alignment, and 16 blend modes
│   │   ├── history.ts            # Memory-adaptive Memento undo/redo
│   │   ├── projectFile.ts        # Native .lumen project serialization
│   │   └── api.ts                # REST API client & job polling helpers
│   ├── themes.ts                 # 5 studio color themes (Ember, Arctic, Sage, etc.)
│   └── App.tsx                   # Master state orchestrator component
├── backend/                      # Backend source code (FastAPI + OpenCV + Pillow)
│   ├── app/
│   │   ├── api/                  # FastAPI routers (images, operations, projects)
│   │   ├── operations/           # Image processing algorithms & registry
│   │   ├── security/upload.py    # Decompression bomb & path traversal validation
│   │   ├── process_pool.py       # Multi-core ProcessPoolExecutor manager
│   │   ├── jobs.py               # Asynchronous job polling store
│   │   └── main.py               # Application entrypoint & CORS config
│   ├── lumen.spec                # PyInstaller specification for desktop binary
│   └── requirements.txt          # Python dependencies
├── src-tauri/                    # Native desktop application shell (Rust + Tauri v2)
│   ├── src/main.rs               # Rust entrypoint
│   └── tauri.conf.json           # Window setup & sidecar binary config
├── packaging/                    # Packaging guidelines & standalone scripts
└── docs/                         # Extended specifications & architectural designs
```

---

## 🇸🇦 نظرة عامة باللغة العربية

**Lumen (مشروع محرر الصور الاحترافي الهجين)** هو برنامج استوديو لمعالجة وتصميم الصور النقطية (Raster) يدمج بين سلاسة تطبيقات الويب الحديثة وقوة برامج سطح المكتب الاحترافية.

### أهم مميزات المشروع:
- **معمارية هجينة من كود واحد:** يعمل كتطبيق ويب فائق السرعة ويُترجم إلى تطبيق سطح مكتب مستقل بحجم خفيف (15 ميجابايت عبر Tauri v2).
- **محرك معالجة ثنائي:** معالجة سحابية صناعية عبر خادم FastAPI وأنوية المعالج المتعددة، مع محرك محلي بديل بالكامل داخل المتصفح (Canvas 2D) يعمل عند انقطاع الاتصال.
- **خوارزميات رؤية حاسوبية متقدمة:**
  - دمج الصور السلس بمعادلات بواسون التفاضلية (`cv2.seamlessClone`) وهرم لابلاس متعدد النطاقات.
  - إزالة الخلفيات الذكية عبر الذكاء الاصطناعي (`rembg` ونموذج `isnet-general-use`) مع تنظيف مورفولوجي للحواف، وتراجع تلقائي لخوارزمية `GrabCut`.
  - استئصال العناصر وترميم الصور (Inpainting) بخوارزميات Navier-Stokes وتوسيع القناع البيضاوي.
  - خط أنابيب التحسين الاحترافي خماسي المراحل (`pro_enhance`) مع الحفاظ على صبغة البشرة وتفاصيل الحواف.
  - منحنيات احترافية بمحاكاة فوتوشوب عبر المنحنيات التكعيبية الطبيعية (Natural Cubic Splines).
- **نظام طبقات متكامل:** يدعم 16 نمط مزج قياسي، وأقنعة الطبقات، والمجموعات، والمحاذاة الذكية، والتصدير المسطح الآمن تماماً من تلوث الكانفاس.
- **أمان صناعي:** حماية كاملة من هجمات قنابل إلغاء الضغط (Decompression Bomb) وحماية مسارات التخزين من الاختراق.

---

## 📄 License

This project is open-source and licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Built with precision and passion for modern digital artists and developers.
</div>
