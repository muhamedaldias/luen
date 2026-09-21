"""Visual QA for the canvas-scale + right-panel overhaul.

Drives the running dev server (http://localhost:8443) in headless Chrome and
asserts, with screenshots as evidence:

1. The app renders with zero page errors (no React insertBefore crash).
2. The artboard frame fills a healthy share of the canvas viewport (not tiny).
3. The Design tab shows document dimensions in px (App wiring).
4. BottomBar 1:1 / Fit buttons change the zoom label as expected.
5. A new rectangle shape opens a Figma-style inspector: px geometry,
   aspect-ratio lock, and corner-radius controls - with no legacy % fields.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".qa-libs"))

from playwright.sync_api import sync_playwright

URL = "http://localhost:8443"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "visual-qa-shots")
os.makedirs(OUT, exist_ok=True)

failures: list[str] = []
passes: list[str] = []
page_errors: list[str] = []
console_errors: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (passes if cond else failures).append(name)
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""), flush=True)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on(
            "console",
            lambda msg: console_errors.append(
                str(msg.location) + " " + msg.text,
            )
            if msg.type == "error"
            and "ERR_NETWORK" not in msg.text
            and "favicon.ico" not in str(msg.location)
            else None,
        )
        page.goto(URL, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(2000)

        check("app renders top bar", page.get_by_text("File", exact=True).count() > 0)
        check("no page errors on load", len(page_errors) == 0, "; ".join(page_errors[:3]))

        frame = page.get_by_test_id("artboard-frame")
        check("artboard frame is visible", frame.count() == 1)
        box = frame.first.bounding_box() if frame.count() == 1 else None
        check("artboard has real size", box is not None and box["width"] > 500, str(box))
        if box:
            check(
                "artboard fills viewport (not tiny/far-away)",
                box["width"] / 1440 > 0.45,
                f"artboard={box['width']:.0f}x{box['height']:.0f}",
            )
        page.screenshot(path=os.path.join(OUT, "01-fit-overview.png"))

        page.get_by_role("button", name="Design").click()
        page.wait_for_timeout(500)
        check(
            "design tab shows document size in px",
            page.get_by_text("1200 × 800 px", exact=False).count() > 0,
        )
        page.screenshot(path=os.path.join(OUT, "02-design-empty.png"))

        bar = page.get_by_test_id("bottom-bar")
        check("bottom bar shows 100% fit zoom", bar.get_by_text("100%", exact=True).count() > 0)
        bar.get_by_role("button", name="1:1").click()
        page.wait_for_timeout(500)
        bar_text = bar.inner_text()
        check("1:1 button switches to actual-size zoom", "131%" in bar_text, bar_text.replace("\n", " ")[:160])
        page.screenshot(path=os.path.join(OUT, "03-actual-size.png"))
        bar.get_by_role("button", name="Fit").click()
        page.wait_for_timeout(500)
        check("Fit button restores 100%", bar.get_by_text("100%", exact=True).count() > 0)

        page.get_by_role("button", name="Layers").click()
        page.wait_for_timeout(400)
        page.get_by_title("New layer (text/image/shape/solid)").click()
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(OUT, "05-new-layer-dialog.png"))
        page.get_by_text("Rectangle", exact=True).click()
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(OUT, "06-after-add-shape.png"))
        check(
            "new shape stays selected (canvas-select self-nuke fixed)",
            page.get_by_text("Rectangle shape", exact=False).count() > 0,
        )
        check("shape inspector header", page.get_by_text("Rectangle shape", exact=False).count() > 0)
        check("px geometry section", page.get_by_text("POSITION & SIZE", exact=True).count() > 0)
        check("aspect-ratio lock control", page.get_by_text("Aspect locked", exact=True).count() > 0)
        check("corner-radius control", page.get_by_text("Corner radius", exact=True).count() > 0)
        check(
            "no legacy percent-geometry fields",
            page.get_by_text("X%", exact=True).count() == 0
            and page.get_by_text("W%", exact=True).count() == 0,
        )
        page.screenshot(path=os.path.join(OUT, "04-shape-inspector.png"))
        page.get_by_role("button", name="Layers").click()
        page.wait_for_timeout(400)
        check(
            "layers list shows the new shape",
            page.get_by_text("1 layers", exact=False).count() > 0,
        )

        check("no page errors after interactions", len(page_errors) == 0, "; ".join(page_errors[:3]))
        check("no console errors", len(console_errors) == 0, "; ".join(console_errors[:3]))
        browser.close()

    print(f"\nRESULT: {len(passes)} passed, {len(failures)} failed", flush=True)
    for f in failures:
        print(f"FAILED: {f}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
