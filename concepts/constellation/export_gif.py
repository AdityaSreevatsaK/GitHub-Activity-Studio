"""Optional native GIF exporter for GitHub READMEs. Runs entirely offline.

Prerequisites: py -3 -m pip install Pillow playwright
               py -3 -m playwright install chromium

Generate SVGs with export.mjs first, then run this tool. The default builds
three 16-second night-theme showcase GIFs. Select --theme paper for light.
"""
from __future__ import annotations

import argparse
from io import BytesIO
import os
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
DESIGNS = ("comet", "cartographer", "starforge")


def export(source: Path, destination: Path, designs: tuple[str, ...], theme: str, fps: int, width: int) -> list[Path]:
    try:
        from PIL import Image
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Install optional dependencies: py -3 -m pip install Pillow playwright; "
            "py -3 -m playwright install chromium"
        ) from exc
    if theme not in ("night", "paper") or not 2 <= fps <= 12 or not 480 <= width <= 1200:
        raise ValueError("Invalid theme, frame rate (2-12) or width (480-1200)")
    destination.mkdir(parents=True, exist_ok=True)
    generated = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=os.environ.get("CONSTELLATION_CHROMIUM") or None
        )
        try:
            page = browser.new_page(
                viewport={"width": 1200, "height": 390},
                device_scale_factor=1,
                reduced_motion="no-preference",
            )
            for design in designs:
                source_svg = source / f"{design}-{theme}-animated.svg"
                if not source_svg.is_file():
                    raise FileNotFoundError(f"{source_svg} missing: run node concepts/constellation/export.mjs first")
                svg = source_svg.read_text(encoding="utf-8")
                root = ET.fromstring(svg)
                if root.attrib.get("data-design") != design or root.attrib.get("data-theme") != theme:
                    raise ValueError(f"Source SVG metadata does not match filename: {source_svg}")
                page.set_content('<html><body style="margin:0">' + svg + '</body></html>')
                images = []
                for index in range(fps * 16):
                    second = index / fps
                    page.evaluate(
                        "t => { const svg=document.querySelector('svg'); "
                        "svg.setCurrentTime(t); svg.pauseAnimations(); "
                        "for (const animation of document.getAnimations()) { "
                        "animation.pause(); animation.currentTime=t*1000; } }",
                        second,
                    )
                    png = page.locator("svg").screenshot(type="png", animations="allow")
                    image = Image.open(BytesIO(png)).convert("RGB")
                    if width != 1200:
                        image = image.resize((width, round(width * 390 / 1200)), Image.Resampling.LANCZOS)
                    images.append(image)
                # Shared palette avoids distracting per-frame background shifts.
                atlas = Image.new("RGB", (width * 2, images[0].height * 2))
                for q, frame in enumerate((0, len(images)//4, len(images)//2, len(images)*3//4)):
                    atlas.paste(images[frame], ((q % 2) * width, (q // 2) * images[0].height))
                palette = atlas.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
                indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in images]
                gif = destination / f"{design}-{theme}.gif"
                indexed[0].save(
                    gif, save_all=True, append_images=indexed[1:], optimize=True,
                    duration=round(1000/fps), loop=0, disposal=2,
                )
                generated.append(gif)
                print(f"{gif} ({gif.stat().st_size // 1024} KiB)")
        finally:
            browser.close()
    return generated


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render native GIF loops from offline animated Constellation SVGs")
    parser.add_argument("--source", type=Path, default=HERE / "assets" / "stress")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--design", choices=DESIGNS)
    parser.add_argument("--theme", choices=("night", "paper"), default="night")
    parser.add_argument("--fps", type=int, default=3)
    parser.add_argument("--width", type=int, default=720)
    args = parser.parse_args()
    export(
        args.source, args.out or args.source, (args.design,) if args.design else DESIGNS,
        args.theme, args.fps, args.width,
    )
