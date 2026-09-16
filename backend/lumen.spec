# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller bundle for the Lumen FastAPI backend.

تجربة الدخان المبكرة (موصى بها من الوثيقة):
    cd backend
    pip install pyinstaller
    pyinstaller lumen.spec --noconfirm

ملاحظة: مكتبات cv2/rembg/PIL لا تُكتشف تلقائياً بالكامل —
لهذا أُضيفت hiddenimports و datas صريحة أدناه.
نموذج rembg (~44-176MB) يُنزَّل عند أول تشغيل ما لم يُضمَّن يدوياً.
"""
import sys
from pathlib import Path

block_cipher = None
ROOT = Path(SPECPATH)  # noqa: F821

a = Analysis(  # noqa: F821
    ["run.py"] if (ROOT / "run.py").exists() else ["app/main.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(ROOT / "alembic.ini"), "."),
        (str(ROOT / "alembic"), "alembic"),
    ],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.lifespan",
        "PIL",
        "PIL.Image",
        "cv2",
        "numpy",
        "sqlalchemy",
        "alembic",
        "pydantic_settings",
        # optional AI — تُحزم فقط إن كانت مثبتة وقت البناء
        "rembg",
        "onnxruntime",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="lumen-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
