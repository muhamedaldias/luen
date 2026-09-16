# تغليف Lumen (Tauri + PyInstaller)

التغليف الآن **موجود كسقالة** بعد أن كان غائباً تماماً — جرّبه مبكراً كتجربة دخان.

## 1) الباكند وحده (PyInstaller)

```powershell
cd backend
pip install pyinstaller
pyinstaller lumen.spec --noconfirm
.\dist\lumen-backend\lumen-backend.exe
```

`lumen.spec` يتضمن `hiddenimports` الصريحة لـ `cv2/rembg/PIL/onnxruntime`
لأن PyInstaller لا يكتشفها تلقائياً.

## 2) تطبيق سطح المكتب (Tauri)

```powershell
npm run build
cd src-tauri
cargo tauri build
```

`src-tauri/tauri.conf.json` جاهز ويشير إلى `../dist`.
الباكند المجمّع يُشغَّل كـ sidecar (يُدار من Tauri) ويخدم الواجهة عبر `http://localhost:8000`.

## ملاحظات

- نموذج `rembg` (~44-176MB) يُنزَّل عند أول إزالة خلفية ما لم تضمّنه يدوياً في الحزمة.
- `react-router` **غير مضاف عمداً**: التطبيق صفحة واحدة (محرر) ولا يحتاج توجيهاً — إضافته كانت ستضخم الحزمة بلا فائدة.
- المصادقة: التطبيق محلي single-user (`default_user_id="local"`) — لا JWT. الحماية المطبقة: حصر `serve_storage` على المستخدم الافتراضي + منع traversal + حد بكسلات.
