"""Validate checked-in, GitHub README-ready Open Source Metro SVG exports.

Runs offline with Python 3.11+ standard library. No repository settings,
network calls or GitHub credentials are required.
"""
from __future__ import annotations

import argparse
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit static metro README exports offline")
    parser.add_argument("--concept", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate_gallery(args.concept)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("PASS: all 3 README exports are accessible, self-contained, valid SVGs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
