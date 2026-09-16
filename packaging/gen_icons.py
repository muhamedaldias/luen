"""Generate placeholder Lumen icons for the Tauri bundle (stdlib only).

Usage (from repo root):
    python packaging\\gen_icons.py

Renders a dark rounded square with a terracotta lens mark, writes PNGs
plus a PNG-compressed .ico. For production icons prefer:
    cargo tauri icon icon.png
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = (20, 19, 18, 255)
ACCENT = (201, 123, 74, 255)
PAPER = (237, 235, 231, 255)


def render(size: int) -> bytearray:
    px = bytearray(size * size * 4)
    ins = 8 / 512 * size
    rad = 110 / 512 * size
    cx = cy = size / 2
    r1, r2, r3 = size * 0.22, size * 0.12, size * 0.06
    ix0, ix1 = ins + rad, size - ins - rad
    for y in range(size):
        row = y * size * 4
        for x in range(size):
            if not (ins <= x < size - ins and ins <= y < size - ins):
                continue
            dx = max(ix0 - x, 0.0, x - ix1)
            dy = max(ix0 - y, 0.0, y - ix1)
            if dx * dx + dy * dy > rad * rad:
                continue
            d = math.hypot(x - cx, y - cy)
            color = BG
            if d <= r1:
                color = ACCENT
            if d <= r2:
                color = BG
            if d <= r3:
                color = PAPER
            o = row + x * 4
            px[o] = color[0]
            px[o + 1] = color[1]
            px[o + 2] = color[2]
            px[o + 3] = color[3]
    return px


def downsample(src: bytearray, src_size: int, dst_size: int) -> bytearray:
    box = src_size // dst_size
    out = bytearray(dst_size * dst_size * 4)
    for y in range(dst_size):
        for x in range(dst_size):
            r = g = b = a = 0
            for j in range(box):
                for i in range(box):
                    o = ((y * box + j) * src_size + (x * box + i)) * 4
                    r += src[o]
                    g += src[o + 1]
                    b += src[o + 2]
                    a += src[o + 3]
            n = box * box
            o = (y * dst_size + x) * 4
            out[o] = r // n
            out[o + 1] = g // n
            out[o + 2] = b // n
            out[o + 3] = a // n
    return out


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def encode_png(px: bytes, size: int) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw += px[y * size * 4 : (y + 1) * size * 4]
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def encode_ico(entries: list[tuple[int, bytes]]) -> bytes:
    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    dirs, blobs = bytearray(), bytearray()
    for size, blob in entries:
        w = 0 if size >= 256 else size
        dirs += struct.pack("<BBBBHHII", w, w, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        blobs += blob
    return header + bytes(dirs) + bytes(blobs)


base = render(512)
(OUT / "icon.png").write_bytes(encode_png(base, 512))
for name, target in (("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)):
    (OUT / name).write_bytes(encode_png(downsample(base, 512, target), target))
ico_entries = [(s, encode_png(downsample(base, 512, s), s)) for s in (16, 32, 48, 64, 128, 256)]
(OUT / "icon.ico").write_bytes(encode_ico(ico_entries))
print("done:", OUT, sorted(p.name for p in OUT.iterdir()))
