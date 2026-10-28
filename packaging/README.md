# Packaging Lumen (Tauri + PyInstaller)

Packaging exists as a scaffold now, where before it did not exist at all. Treat it as an early smoke test, not a finished release pipeline.

## 1) Backend only (PyInstaller)

```powershell
cd backend
pip install pyinstaller
pyinstaller lumen.spec --noconfirm
# One file (onefile) because a Tauri sidecar expects a single binary:
.\dist\lumen-backend.exe
```

`lumen.spec` lists the `hiddenimports` for `cv2`/`rembg`/`PIL`/`onnxruntime` explicitly, because PyInstaller does not discover them on its own. The entry point is `run.py`, which calls `uvicorn.run`. Neural background removal is optional and comes from `backend/requirements-ai.txt`.

## 2) Desktop application (Tauri)

```powershell
npm run build
cd backend
pyinstaller lumen.spec --noconfirm
Copy-Item dist\lumen-backend.exe ..\src-tauri\binaries\lumen-backend-x86_64-pc-windows-msvc.exe
cd ..\src-tauri
cargo tauri build
```

`src-tauri/` is now a complete scaffold: `Cargo.toml`, `src/main.rs`, `capabilities/`, and `tauri.conf.json` (which points at `../dist` and sets `externalBin: binaries/lumen-backend`). The bundled backend is meant to run as a sidecar managed by Tauri, serving the frontend on `http://localhost:8000`.

Sidecar naming: the binary suffix is the target triple, so Windows expects `lumen-backend-x86_64-pc-windows-msvc.exe`.

## Notes

- The current icons were generated locally by `python packaging/gen_icons.py` (standard library only, no dependencies). For a macOS release, generate `icon.icns` with `cargo tauri icon src-tauri/icons/icon.png` and add it back to the `bundle.icon` list.
- The `rembg` model (roughly 44-176 MB) downloads on the first background removal unless you bundle it into the package by hand.
- `react-router` is deliberately absent: the app is a single editor page and needs no routing, so adding it would grow the bundle for nothing.
- Authentication: this is a local single-user app (`default_user_id="local"`) with no JWT. What is enforced instead: `serve_storage` is scoped to the default user, path traversal is blocked, and there is a pixel-count ceiling on uploads.