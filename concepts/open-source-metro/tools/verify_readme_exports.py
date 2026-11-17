"""Validate checked-in, GitHub README-ready Open Source Metro SVG exports.

Runs offline with Python 3.11+ standard library. No repository settings,
network calls or GitHub credentials are required.
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

SVG = "{http://www.w3.org/2000/svg}"
XLINK = "{http://www.w3.org/1999/xlink}"
PRIMARY = (
    "modern-dark-still.svg",
    "vintage-light-still.svg",
    "stress-modern-dark-still.svg",
)
MAX_SIZE_BYTES = 900_000


def validate_export(path: Path) -> list[str]:
    """Return actionable errors; never execute, fetch or trust SVG content."""
    errors: list[str] = []
    if not path.is_file():
        return [f"Missing README preview: {path.name}"]
    if path.stat().st_size > MAX_SIZE_BYTES:
        errors.append(f"{path.name}: exceeds {MAX_SIZE_BYTES:,} bytes")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        return errors + [f"{path.name}: invalid SVG XML: {exc}"]
    if root.tag != SVG + "svg":
        errors.append(f"{path.name}: root element is not SVG")
    if root.attrib.get("viewBox", "").split()[:2] != ["0", "0"]:
        errors.append(f"{path.name}: expected an origin-aligned viewBox")
    for required in ("title", "desc"):
        if root.find(SVG + required) is None:
            errors.append(f"{path.name}: missing accessible {required}")
    text = " ".join("".join(e.itertext()) for e in root if e.tag in {SVG + "title", SVG + "desc"})
    if "demo" not in text.lower() and "synthetic" not in text.lower():
        errors.append(f"{path.name}: source provenance is not in accessible description")
    if not any(e.get("class") == "repository" for e in root.iter()):
        errors.append(f"{path.name}: no repository stations")
    if not any(e.get("data-date") for e in root.iter()):
        errors.append(f"{path.name}: no calendar cells")
    forbidden = {SVG + "script", SVG + "foreignObject", SVG + "image", SVG + "iframe"}
    for el in root.iter():
        if el.tag in forbidden:
            errors.append(f"{path.name}: forbidden embedded content {el.tag.split('}')[-1]}")
        for name, value in el.attrib.items():
            if name in {"href", XLINK + "href"} or name.lower().startswith("on"):
                errors.append(f"{path.name}: external link or event handler is not allowed")
            if isinstance(value, str) and re.search(r"(?:javascript:|data:text/html)", value, re.I):
                errors.append(f"{path.name}: unsafe URI in attribute")
    return errors


def validate_gallery(root: Path) -> list[str]:
    exports = root / "exports"
    errors: list[str] = []
    readme = root / "README.md"
    if not readme.is_file():
        return ["Missing concept README.md"]
    body = readme.read_text(encoding="utf-8")
    for name in PRIMARY:
        if f"exports/{name}" not in body:
            errors.append(f"Concept README does not embed {name}")
        errors.extend(validate_export(exports / name))
    if "synthetic" not in body.lower():
        errors.append("Concept README does not disclose synthetic provenance")
    return errors



def validate_reproducibility(concept: Path, fixture: Path | None = None) -> list[str]:
    """Compare committed profile previews byte-for-byte with the current renderer.

    Both the fixture and the source live inside the checkout. This does not use
    GitHub APIs or depend on a running browser, third-party fonts or packages.
    """
    source = concept / "calendar_metro.py"
    fixture = fixture or concept.parents[1] / "shared" / "fixtures" / "demo-activity.json"
    if not source.is_file():
        return [f"Missing renderer for reproducibility audit: {source}"]
    if not fixture.is_file():
        return [f"Missing shared fixture for reproducibility audit: {fixture}"]

    spec = importlib.util.spec_from_file_location("_verified_metro_renderer", source)
    if spec is None or spec.loader is None:
        return ["Unable to load the calendar renderer for reproducibility audit"]
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
        snapshot = module.read(fixture)
        stressed = module.demo_stress(snapshot)
        candidates = (
            ("modern-dark-still.svg", snapshot, "modern", "dark"),
            ("vintage-light-still.svg", snapshot, "vintage", "light"),
            ("stress-modern-dark-still.svg", stressed, "modern", "dark"),
        )
        issues = []
        for name, data, style, scheme in candidates:
            output = concept / "exports" / name
            if not output.is_file():
                issues.append(f"Cannot compare missing generated export: {name}")
                continue
            expected = module.render(data, style=style, scheme=scheme, animated=False)
            if output.read_text(encoding="utf-8") != expected:
                issues.append(f"Stale README export: {name}; regenerate with calendar_metro.py")
        return issues
    except (OSError, ValueError, ImportError) as exc:
        return [f"Unable to reproduce README exports: {exc}"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit static metro README exports offline")
    parser.add_argument("--concept", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--skip-reproducibility", action="store_true",
                        help="Only validate SVG structure; skip comparison with the renderer")
    args = parser.parse_args()
    errors = validate_gallery(args.concept)
    if not args.skip_reproducibility:
        errors += validate_reproducibility(args.concept)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("PASS: all 3 README exports are safe SVGs and meet requested reproducibility checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
