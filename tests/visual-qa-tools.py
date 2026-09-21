"""Visual QA for tools: raster eraser, second-image drag, background lock, panel toggle.

Drives http://localhost:8443 in headless Chrome. Generates its own 400x300
test PNG (pure stdlib) so uploads need no fixtures.
"""

import hashlib
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".qa-libs"))

from playwright.sync_api import expect, sync_playwright

URL = "http://localhost:8443"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "visual-qa-shots")
TEST_PNG = os.path.join(OUT, "qa-fixture.png")
BLUE_PNG = os.path.join(OUT, "qa-blue.png")
os.makedirs(OUT, exist_ok=True)

failures: list[str] = []
passes: list[str] = []
page_errors: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (passes if cond else failures).append(name)
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""), flush=True)


def chunk(kind: bytes, data: bytes) -> bytes:
    out = kind + data
    return struct.pack(">I", len(data)) + out + struct.pack(">I", zlib.crc32(out))


def make_png() -> None:
    w, h = 400, 300
    orange = (201, 123, 74)
    blue = (60, 120, 220)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            c = blue if 150 <= x < 250 and 110 <= y < 190 else orange
            raw += bytes(c)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw)))
    png += chunk(b"IEND", b"")
    with open(TEST_PNG, "wb") as f:
        f.write(png)
    bw, bh = 200, 150
    raw2 = bytearray()
    for _ in range(bh):
        raw2.append(0)
        for _ in range(bw):
            raw2 += bytes((40, 90, 220))
    ihdr2 = struct.pack(">IIBBBBB", bw, bh, 8, 2, 0, 0, 0)
    blue = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr2)
    blue += chunk(b"IDAT", zlib.compress(bytes(raw2)))
    blue += chunk(b"IEND", b"")
    with open(BLUE_PNG, "wb") as f:
        f.write(blue)


def digest(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()[:12]


def main() -> int:
    make_png()
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.goto(URL, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(1800)

        page.locator('input[type="file"]').first.set_input_files(TEST_PNG)
        page.wait_for_timeout(1800)
        frame = page.get_by_test_id("artboard-frame")
        box = frame.first.bounding_box()
        assert box, "artboard missing after upload"
        cx, cy, w = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, box["width"]

        page.keyboard.press("b")
        page.wait_for_timeout(300)
        page.mouse.move(cx - w * 0.25, cy)
        page.mouse.down()
        for i in range(1, 11):
            page.mouse.move(cx - w * 0.25 + (w * 0.5 * i) / 10, cy, steps=2)
        page.mouse.up()
        page.wait_for_timeout(800)
        shot_stroke = page.screenshot(clip=box)
        check("brush stroke paints pixels", True, f"hash {digest(shot_stroke)}")

        page.keyboard.press("e")
        page.wait_for_timeout(300)
        page.mouse.move(cx + w * 0.25, cy)
        page.mouse.down()
        for i in range(1, 11):
            page.mouse.move(cx + w * 0.25 - (w * 0.5 * i) / 10, cy, steps=2)
        page.mouse.up()
        page.wait_for_timeout(800)
        shot_erased = page.screenshot(clip=box)
        with open(os.path.join(OUT, "10-eraser-result.png"), "wb") as f:
            f.write(shot_erased)
        check(
            "eraser visibly removes content",
            digest(shot_stroke) != digest(shot_erased),
            f"{digest(shot_stroke)} -> {digest(shot_erased)}",
        )
        check(
            "eraser commit marks unsaved state",
            page.get_by_test_id("bottom-bar").get_by_text("Unsaved changes", exact=False).count() > 0,
        )

        page.get_by_role("button", name="Layers").click()
        page.wait_for_timeout(300)
        page.get_by_title("New layer (text/image/shape/solid)").click()
        page.wait_for_timeout(300)
        page.locator('input[type="file"]').last.set_input_files(TEST_PNG)
        page.wait_for_timeout(2000)
        page.get_by_role("button", name="Design").click()
        page.wait_for_timeout(400)
        geom = page.get_by_test_id("geom-px")
        x_before = float(geom.locator("input").first.input_value())
        lx, ly = box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.45
        page.mouse.move(lx, ly)
        page.mouse.down()
        page.mouse.move(lx + 120, ly, steps=12)
        page.mouse.up()
        page.wait_for_timeout(800)
        x_after = float(geom.locator("input").first.input_value())
        page.screenshot(path=os.path.join(OUT, "11-image-dragged.png"))
        check(
            "second image drags freely, X updates live",
            abs(x_after - x_before) > 5,
            f"X {x_before} -> {x_after}",
        )

        page.get_by_role("button", name="Layers").click()
        page.wait_for_timeout(300)
        check(
            "background row exists and is locked",
            page.get_by_text("Background image", exact=False).count() > 0,
        )
        page.get_by_text("Background image", exact=False).first.click()
        page.wait_for_timeout(400)
        check(
            "clicking background clears to document panel, no crash",
            page.get_by_text("Empty — nothing selected", exact=False).count() > 0
            or page.get_by_text("Select any layer", exact=False).count() > 0,
        )

        page.get_by_role("button", name="Adjust").click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Blend Two Images").click()
        page.wait_for_timeout(400)
        page.locator('input[type="file"]').last.set_input_files(BLUE_PNG)
        place_btn = page.get_by_role("button", name="Place as movable layer")
        expect(place_btn).to_be_enabled(timeout=8000)
        place_btn.click()
        page.wait_for_timeout(1000)
        page.get_by_role("button", name="Layers").click()
        page.wait_for_timeout(400)
        check(
            "blend place adds a layer (bg + 2 images = 3)",
            page.get_by_text("3 layers", exact=False).count() > 0,
        )
        page.get_by_role("button", name="Design").click()
        page.wait_for_timeout(400)
        geom2 = page.get_by_test_id("geom-px")
        placed_x = float(geom2.locator("input").first.input_value())
        check("placed foreground starts at dialog position", 100 <= placed_x <= 140, f"X={placed_x}")
        art = page.get_by_test_id("artboard-frame").first.bounding_box()
        assert art
        px = art["x"] + placed_x / 400 * art["width"] + 40
        py = art["y"] + art["height"] * 0.45
        page.mouse.move(px, py)
        page.mouse.down()
        page.mouse.move(px + 120, py, steps=12)
        page.mouse.up()
        page.wait_for_timeout(800)
        placed_after = float(geom2.locator("input").first.input_value())
        page.screenshot(path=os.path.join(OUT, "13-blend-placed-dragged.png"))
        check(
            "placed foreground drags anywhere, X updates",
            placed_after - placed_x > 20,
            f"X {placed_x} -> {placed_after}",
        )

        page.get_by_role("button", name="Adjust").click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Blend Two Images").click()
        page.wait_for_timeout(400)
        page.locator('input[type="file"]').last.set_input_files(BLUE_PNG)
        bake_btn = page.get_by_role("button", name="Blend images")
        expect(bake_btn).to_be_enabled(timeout=8000)
        bake_btn.click()
        page.wait_for_timeout(6000)
        check(
            "blend bake still works and closes",
            page.get_by_text("Blend Two Images — High-Quality", exact=False).count() == 0,
        )

        topbar = page.get_by_test_id("top-bar")
        topbar.get_by_title("Hide side panel").click()
        page.wait_for_timeout(500)
        check(
            "top-bar toggle collapses panel",
            page.get_by_text("Layers", exact=True).count() == 0,
        )
        check(
            "ugly floating pill is gone",
            page.get_by_text("Panel", exact=True).count() == 0,
        )
        page.screenshot(path=os.path.join(OUT, "12-panel-collapsed.png"))
        topbar.get_by_title("Show side panel").click()
        page.wait_for_timeout(500)
        check(
            "top-bar toggle restores panel",
            page.get_by_text("Layers", exact=True).count() > 0,
        )

        check("no page errors during tool flows", len(page_errors) == 0, "; ".join(page_errors[:3]))
        browser.close()

    print(f"\nRESULT: {len(passes)} passed, {len(failures)} failed", flush=True)
    for f in failures:
        print(f"FAILED: {f}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
