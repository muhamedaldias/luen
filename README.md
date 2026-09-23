# 🌟 Lumen — Professional Hybrid Photo & Graphics Suite

<div align="center">

![Lumen Banner](https://img.shields.io/badge/LUMEN-PHOTO_EDITOR-C97B4A?style=for-the-badge&logo=adobephotoshop&logoColor=white)

**A high-performance, studio-grade raster photo editor and creative graphics suite built for Web & Desktop.**  
*Combines the fluidity of modern React 19 & Fabric.js with in-browser ONNX AI models and the algorithmic power of FastAPI, OpenCV, and Pillow.*

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![ONNX Runtime Web](https://img.shields.io/badge/ONNX_Runtime-1.19.2_WASM-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer_Vision-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2_Desktop-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[Features](#-key-features) • [Installation Guide](#-installation--prerequisites) • [Architecture](#-system-architecture) • [Tech Stack](#-technology-stack) • [User Guide & Docs](#-user-guide--documentation) • [API Guide](#-api--operations-registry) • [دليل التثبيت بالعربية](#-متطلبات-التثبيت-والتشغيل-باللغة-العربية)

</div>

---

## 📖 Overview

**Lumen** is engineered to deliver a seamless, Photoshop-grade raster editing experience directly within modern web browsers and as a lightweight native desktop application. 

Instead of choosing between a pure client-side editor (which struggles with heavy mathematical vision algorithms) and a heavy cloud-only service (which introduces network latency for interactive tasks), Lumen introduces a **Dual-Engine Hybrid Architecture**:
1. **Interactive Client Stage (Fabric.js & Canvas 2D):** Instant sub-millisecond feedback for dragging, drawing, text styling, layer reordering, snapping, and vector overlays with a memory-safe preview resolution ceiling.
2. **In-Browser Neural AI Engine (ONNX Runtime Web + WASM):** Runs the `u2netp.onnx` neural model directly inside the client's browser, enabling instant offline AI background extraction without GPU or server requirements.
3. **Industrial Vision Engine (FastAPI & Multi-Core Process Pool):** Full-precision (`float32`), multi-threaded image processing running on multi-core CPU workers with OpenCV, Pillow, and `rembg`.
4. **Full Offline Fallback:** When working without internet or without a running backend, Lumen seamlessly switches to its pure local Canvas 2D and ONNX WASM engine so you can continue editing without interruption.
5. **Single Codebase, Dual Output:** Runs natively on the Web and compiles to a lightweight **15MB Native Desktop App** via **Tauri v2** and **PyInstaller Sidecar**.

---

## ✨ Key Features

### 🧠 In-Browser AI & Neural Mask Refinement
- **Zero-Backend Neural Cutout:** Pre-packaged with `public/models/u2netp.onnx` (4.5MB) executing client-side via `onnxruntime-web` WASM.
- **Smart Click Anchor Targeting:** Clicking on an object uses coordinates `(fx, fy)` to isolate the specific subject and eliminate background artifacts.
- **Mathematical Mask Refinement (`maskRefine.ts`):**
  - **8-Connectivity Connected Components:** Automatically prunes stray islands and secondary reflections.
  - **Softness Detection & Adaptive Erosion:** Preserves fine transparent edges (e.g., glassware, hair) while eliminating colored edge halos on solid subjects.
  - **High-Quality Alpha Feathering:** Blends mask perimeters seamlessly into composite canvas targets.
  - **Graceful Fallback:** Classical region-growing background segmentation when neural confidence is low.

### 🖼️ Creative Asset Library Drawer (`AssetsDrawer`)
- **Slide-Out Studio Drawer:** Quick access with shortcut `L` or toolbar icon.
- **Categorized Presets:** Product backdrops, podiums, studio lighting, gradient atmospheres, and solid backdrops.
- **Instant Insertion:** Drag-and-drop directly onto the canvas or click `+` to insert centered at original scale.
- **Live Search & Filter:** Instant substring search across categories.

### 💾 Pro Multi-Format Export System (`ExportDialog`)
- **PNG:** Lossless compression preserving 32-bit alpha transparency.
- **JPG:** High-speed web compression with a customizable background matte color picker.
- **WEBP:** Modern high-efficiency format combining high compression ratios with full alpha channel support.
- **Quality Control:** 60% to 100% fine-tuning slider with persistent user preferences in `localStorage` and `SettingsModal`.
- **Taint-Free Composite Pipeline:** Custom Canvas 2D exporter avoiding SVG `<foreignObject>` to completely eliminate browser security exceptions.

### 🔍 Live Hover Filter Previews (`FilterInfoCard`)
- **Interactive Thumbnails:** Hovering over any filter in the TopBar menu displays a live before/after comparison preview card.
- **Real-Time Synthesis:** Previews are generated through the actual image filter algorithms.
- **Behavioral Guidance:** Clear descriptions and usage advice for each optical filter.

### 🎨 Layer System, Shapes & Typography
- **Multi-Type Layer Stack:** Image Layers, Text Layers, Shape Layers (`Rect`, `Ellipse`), Solid Fill Layers, and Brush Stroke Layers.
- **16 Professional Blend Modes:** Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion, Hue, Saturation, Color, and Luminosity.
- **Advanced Text System:** Custom typography, gradients, borders, corner rounding, padding, line-height, letter spacing, alignment, and drop shadows.
- **Layer Masks (Alpha Masks):** Non-destructive white/black masks with live editing, invert, disable/enable, and bake-in options.
- **Smart Alignment & Guides:** Magnetic snapping to document bounds (0%, 50%, 100%) and sibling layer edges with visual guide lines.

### 🎨 11 Studio Color Themes
Seamlessly toggle between custom tailored dark and light studio palettes:
- **Ember** (Warm studio dark — default)
- **Arctic** (Cool steel blue)
- **Sage** (Forest teal dark)
- **Obsidian** (Deep dark with gold accents)
- **Pearl** (Clean modern light studio)
- **Cinematic**, **Warm**, **Cold**, **Noir**, **Faded**, **Vivid**

---

## 💻 System Architecture

```
                                    +------------------------------------------+
                                    |         Lumen Client (React 19)          |
                                    |  +------------------------------------+  |
                                    |  | Fabric.js Stage & Interactive UI   |  |
                                    |  | - Assets Drawer & Presets (Key: L) |  |
                                    |  | - Multi-Format Export Dialog       |  |
                                    |  | - Live Hover Filter Previews       |  |
                                    |  +------------------+-----------------+  |
                                    +---------------------|--------------------+
                                                          |
                                      +-------------------+-------------------+
                                      |                                       |
                       [Backend Connected: High-Res]             [Offline: Client Fallback]
                                      |                                       |
                                      v                                       v
                     +----------------------------------+    +----------------------------------+
                     |        FastAPI REST API          |    |  Client Engine (localOps.ts)     |
                     |  +----------------------------+  |    |  - ONNX Runtime Web (u2netp)     |
                     |  | Security & Upload Guards   |  |    |  - Mask Refine (8-connectivity)  |
                     |  +--------------+-------------+  |    |  - Canvas 2D Convolution Filters |
                     |                 |                |    |  - Local Brightness / Contrast   |
                     |  +--------------v-------------+  |    +----------------------------------+
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

## 🛠️ Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend Framework** | **React 19**, **Vite 8**, **TypeScript 5.7** | Core UI reactivity, ultra-fast HMR, strict type safety |
| **Canvas Engine** | **Fabric.js v6.4** | Interactive 2D canvas, vector text, shape primitives |
| **In-Browser AI** | **ONNX Runtime Web (WASM)**, `u2netp.onnx` | Instant client-side AI background segmentation without GPU |
| **Styling & Themes** | **Tailwind CSS v4**, Lucide Icons | Responsive dockable panels, 11 custom studio themes |
| **Layout Management** | `react-resizable-panels` | Photoshop/Figma dockable split views |
| **Backend API** | **FastAPI**, **Uvicorn**, Pydantic v2 | Asynchronous REST endpoints, OpenAPI docs |
| **Execution Pool** | `concurrent.futures.ProcessPoolExecutor` | True multi-core CPU parallelism bypassing Python GIL |
| **Computer Vision** | **OpenCV (cv2)**, **NumPy** | Seamless Poisson cloning, inpainting, CLAHE, LAB color space |
| **Image Core** | **Pillow (PIL)** | Lanczos resampling, format conversions, security checks |
| **Desktop Shell** | **Tauri v2 (Rust)** | Native OS WebView2 wrapper (15-25MB distribution footprint) |
| **Desktop Backend** | **PyInstaller** | Bundles FastAPI into an autonomous executable sidecar |

---

## 🚀 Installation & Prerequisites

Follow these instructions to set up, install, and run Lumen locally.

### 📋 Prerequisites Checklist

| Component | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Node.js** | `v18.0.0+` | `v20.x` or `v22.x LTS` | Required for frontend & dev server |
| **pnpm** or **npm** | `pnpm v9+` or `npm v9+` | `pnpm 10.x` | Package manager |
| **Python** *(Optional)* | `v3.10+` | `v3.11.x` | Only needed for backend vision server |
| **Rust / Cargo** *(Optional)*| Latest stable | Latest | Only needed for building Tauri desktop app |

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/muhamedaldias/luen.git
cd luen
```

---

### 2️⃣ Frontend Setup & Running (Web Application)

> [!TIP]
> The frontend is **completely self-contained**! Thanks to in-browser **ONNX Runtime Web**, the pre-bundled `u2netp.onnx` model, and local Canvas 2D image operations, you can perform full photo editing, layers, typography, drawing, AI background removal, filters, and exports without running the Python backend.

```bash
# 1. Install dependencies
pnpm install
# or if using npm:
# npm install

# 2. Start the Vite development server
pnpm dev
# or if using npm:
# npm run dev
```

The application will launch immediately at:
👉 **`http://localhost:8443`** (or `http://localhost:5173`)

To compile the production frontend build:
```bash
pnpm build
# or: npm run build
```
The optimized static bundle will be generated inside the `dist/` folder.

---

### 3️⃣ Backend Setup (Optional: FastAPI Vision Server)

The Python backend unlocks high-precision industrial vision algorithms (Poisson seamless cloning, multi-band Laplacian pyramid blending, Navier-Stokes inpainting, and server-side CLAHE).

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

# 3. Upgrade pip and install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Documentation (Swagger UI):** `http://localhost:8000/docs`
- **Alternative ReDoc UI:** `http://localhost:8000/redoc`

---

### 4️⃣ Desktop Application Packaging (Tauri v2 + PyInstaller)

To compile Lumen as a native standalone desktop executable (`.exe` on Windows):

```powershell
# 1. Build the production frontend bundle
pnpm build

# 2. Package the Python backend sidecar
cd backend
pip install pyinstaller
pyinstaller lumen.spec --noconfirm

# 3. Copy the compiled sidecar binary to Tauri's binary folder
Copy-Item dist\lumen-backend\lumen-backend.exe ..\src-tauri\binaries\lumen-backend-x86_64-pc-windows-msvc.exe

# 4. Compile the native desktop installer
cd ..\src-tauri
cargo tauri build
```
The installer executable will be generated inside `src-tauri/target/release/bundle/`.

---

## 📚 User Guide & Documentation

Lumen includes comprehensive, studio-grade illustrated documentation:

- 📖 **Complete Illustrated User Guide (PDF):** [`Lumen-User-Guide-AR.pdf`](Lumen-User-Guide-AR.pdf) (Also accessible at `/Lumen-User-Guide-AR.pdf` when running the web app).
- 🌐 **Interactive Web User Guide (HTML):** [`Lumen-User-Guide-AR.html`](Lumen-User-Guide-AR.html).
- 📸 **Visual Screenshots & Step-by-Step Stages:** Located in the [`guide-assets/`](guide-assets/) directory.
- 📐 **Comprehensive Architectural Specification:** [`الوثيقة-الشاملة-المحدثة-للمشروع.md`](الوثيقة-الشاملة-المحدثة-للمشروع.md).

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Tool / Action |
|---|---|
| `V` | **Select Tool** (Move, transform, scale) |
| `C` | **Crop Tool** |
| `B` | **Brush Tool** (Freehand drawing) |
| `E` | **Eraser Tool** (Eraser to transparency with ring cursor) |
| `T` | **Text Tool** (Typography and text boxes) |
| `U` | **Shape Tool** (Rectangles & Ellipses) |
| `W` | **Smart Select / Magic Wand** |
| `Q` | **Quick Select Tool** |
| `I` | **Eyedropper Tool** (Sample color to palette) |
| `L` | **Asset Library Drawer** (Toggle backdrops & products drawer) |
| `H` | **Pan Tool** |
| `Z` | **Zoom Tool** |
| `[` / `]` | **Decrease / Increase Brush or Eraser Size** |
| `Ctrl + Z` / `Cmd + Z` | **Undo** (Adaptive Memento history) |
| `Ctrl + Y` / `Cmd + Shift + Z` | **Redo** |
| `Ctrl + S` / `Cmd + S` | **Quick Save Project (`.lumen`)** |

---

## 📡 API & Operations Registry

Backend operations follow a unified registry pattern:

```http
POST /api/operations/{operation_name}
Content-Type: application/json

{
  "image_id": "hex_image_id",
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

## 🇸🇦 متطلبات التثبيت والتشغيل باللغة العربية

برنامج **Lumen** مصمم ليعمل بسهولة فائقة دون تعقيدات، حيث يمكن تشغيله كبرنامج ويب فوري أو كمنظومة كاملة مع خادم بايثون لمعالجة الصور المتقدمة.

### 📌 المتطلبات الأساسية للنظام:
1. **Node.js**: الإصدار `18` أو أحدث (يُفضل بشدة الإصدار المستقر `Node.js 20 LTS` أو `22`).
2. **مدير الحزم**: `pnpm` (الموصى به) أو `npm`.
3. **Python (اختياري)**: الإصدار `3.10` فما فوق (مطلوب فقط في حال الرغبة بتشغيل خادم المعالجة الخلفي FastAPI).
4. **Rust / Cargo (اختياري)**: مطلوب فقط لتجميع تطبيق سطح المكتب المستقل عبر Tauri v2.

---

### 🚀 خطوات التشغيل خطوة بخطوة:

#### 1. استنساخ المشروع من GitHub:
```bash
git clone https://github.com/muhamedaldias/luen.git
cd luen
```

#### 2. تثبيت الحزم وتشغيل الواجهة الأمامية:
```bash
# تثبيت الاعتماديات
pnpm install
# أو باستخدام npm:
# npm install

# تشغيل خادم التطوير
pnpm dev
# أو:
# npm run dev
```
افتح المتصفح على الرابط: **`http://localhost:8443`** (أو `http://localhost:5173`).

> [!NOTE]
> **الذكاء الاصطناعي مدمج ويعمل بدون إنترنت وبدون سيرفر!**  
> بفضل نموذج `u2netp.onnx` ومكتبة `onnxruntime-web` عبر تقنية WebAssembly، يمكنك إزالة الخلفية وقص الصور وإضافة النصوص والأشكال والفلاتر وتصديرها بصيغ PNG/JPG/WEBP مباشرة دون تشغيل الباك-إند.

#### 3. تشغيل الخادم الخلفي (اختياري للميزات المتقدمة مثل دمج بواسون السلس):
```bash
cd backend
python -m venv .venv

# على نظام Windows:
.venv\Scripts\activate
# على أنظمة Linux أو macOS:
source .venv/bin/activate

# تثبيت متطلبات بايثون
pip install -r requirements.txt

# تشغيل الخادم
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
توثيق Swagger التفاعلي متاح عبر: `http://localhost:8000/docs`.

---

## 📄 License

This project is open-source and licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
<b>Lumen Photo Suite</b> — Engineered for performance, creative control, and seamless editing.
</div>
