"""Code Factory: offline, deterministic GitHub activity illustration generator.

All assets are original procedural SVG. A factory is a visual metaphor, not CI status.
Run: python concepts/code-factory/factory.py
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
import re
from typing import Any

KINDS = ("commit", "pr_opened", "pr_merged", "issue_opened", "release")
LABELS = {"commit": "PARTS", "pr_opened": "ASSEMBLE", "pr_merged": "SEALED", "issue_opened": "INSPECT", "release": "DISPATCH"}
SYMBOLS = {"commit": "●", "pr_opened": "◇", "pr_merged": "◆", "issue_opened": "!", "release": "✦"}
COLOURS = {"commit": "#55cbb9", "pr_opened": "#83a7ed", "pr_merged": "#e6af62", "issue_opened": "#e78f97", "release": "#bc9ce8"}
THEMES = {
    "dark": {"bg": "#101d2a", "panel": "#1b2e3c", "floor": "#233c4a", "floor2": "#304c59", "edge": "#0c1723", "ink": "#f4e9d6", "muted": "#a8bbc3", "soft": "#355364", "accent": "#e5b778", "machine": "#436477", "machine2": "#608494", "window": "#f3d89c", "rail": "#7892a0"},
    "light": {"bg": "#f6efde", "panel": "#fdf7e9", "floor": "#e0d7c4", "floor2": "#cfc5b0", "edge": "#4d5964", "ink": "#24394b", "muted": "#627786", "soft": "#bccabb", "accent": "#b77946", "machine": "#8eaab5", "machine2": "#b5cad0", "window": "#f6d187", "rail": "#657c8a"},
}
MAX_REPOS, MAX_EVENTS, MAX_COUNT = 5, 15, 100_000


def _utc(value: Any) -> datetime:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value):
        raise ValueError("timestamps must use ISO 8601 UTC with Z")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError("invalid calendar timestamp") from exc


def normalise(data: Any) -> dict:
    """Validate shared contract, deduplicate events, preserve truthful event types."""
    if not isinstance(data, dict) or data.get("schema_version") != "1":
        raise ValueError("expected shared snapshot schema_version 1")
    if data.get("source") not in ("demo", "github"):
        raise ValueError("source must be demo or github")
    _utc(data.get("generated_at"))
    if not isinstance(data.get("repositories"), list) or not isinstance(data.get("activity"), list):
        raise ValueError("repositories and activity must be arrays")
    if len(data["repositories"]) > 5000 or len(data["activity"]) > 10000:
        raise ValueError("input exceeds safe size limits")
    repo_map = {}
    for repo in data["repositories"]:
        if not isinstance(repo, dict):
            raise ValueError("invalid repository")
        full = repo.get("full_name")
        if not isinstance(full, str) or len(full) > 240 or not re.fullmatch(r"[^\s/]+/[^\s/]+", full):
            raise ValueError("invalid repository full_name")
        name = repo.get("name", full.split("/", 1)[1])
        if not isinstance(name, str) or len(name) > 240:
            raise ValueError("invalid repository name")
        if full in repo_map:
            raise ValueError("duplicate repository full_name")
        repo_map[full] = {"full_name": full, "name": name}
    unique = {}
    for event in data["activity"]:
        if not isinstance(event, dict):
            raise ValueError("invalid activity record")
        ident = event.get("id")
        kind, full, count = event.get("kind"), event.get("repo_full_name"), event.get("count")
        if not isinstance(ident, str) or not ident or len(ident) > 240:
            raise ValueError("invalid event id")
        if not isinstance(kind, str) or kind not in KINDS or not isinstance(full, str) or full not in repo_map or type(count) is not int or not 1 <= count <= MAX_COUNT:
            raise ValueError("unknown kind, repository, or invalid count")
        stamp = _utc(event.get("occurred_at"))
        if ident in unique:
            if unique[ident] != (kind, full, count, stamp):
                raise ValueError("conflicting duplicate event id")
            continue
        unique[ident] = (kind, full, count, stamp)
    events = [{"id": k, "kind": v[0], "repo": v[1], "count": v[2], "when": v[3]} for k, v in unique.items()]
    events.sort(key=lambda x: (x["when"], x["id"]))
    activity_by_repo = Counter()
    for ev in events:
        activity_by_repo[ev["repo"]] += ev["count"]
    # Busy stations first. Ties are stable, alphabetical by full owner/name.
    stations = sorted(repo_map.values(), key=lambda x: (-activity_by_repo[x["full_name"]], x["full_name"]))[:MAX_REPOS]
    visible = {r["full_name"] for r in stations}
    shown = [e for e in events if e["repo"] in visible]
    # Latest 15 events, in chronological order, and explicit truncation label.
    shown = shown[-MAX_EVENTS:]
    return {"source": data["source"], "generated_at": data["generated_at"], "stations": stations,
            "events": shown, "total_events": len(events), "total_repos": len(repo_map),
            "counts": Counter({kind: sum(e["count"] for e in events if e["kind"] == kind) for kind in KINDS})}


def _text(x: float, y: float, value: Any, size: int = 12, fill: str = "currentColor", **extra: str) -> str:
    attrs = " ".join(f'{k.replace("_", "-")}="{escape(str(v), quote=True)}"' for k, v in extra.items())
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" {attrs}>{escape(str(value))}</text>'


def _rect(x: float, y: float, w: float, h: float, colour: str, r: int = 0, **extra: Any) -> str:
    attrs = " ".join(f'{k.replace("_", "-")}="{escape(str(v), quote=True)}"' for k, v in extra.items())
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{colour}" {attrs}/>'


def _path(points: str, colour: str, **extra: Any) -> str:
    attrs = " ".join(f'{k.replace("_", "-")}="{escape(str(v), quote=True)}"' for k, v in extra.items())
    return f'<path d="{escape(points, quote=True)}" fill="{colour}" {attrs}/>'


def _label(name: str, max_len: int = 15) -> str:
    clean = " ".join(name.split())
    return clean if len(clean) <= max_len else clean[:max_len - 1] + "…"


def _intro(scene: dict, theme: str, layout: str, animated: bool) -> tuple[list[str], dict]:
    p = THEMES[theme]
    source = "SYNTHETIC DEMO" if scene["source"] == "demo" else "PUBLIC GITHUB SNAPSHOT"
    counts = ", ".join(f"{scene['counts'][k]} {k.replace('_', ' ')}" for k in KINDS)
    description = (f"Code Factory {layout} illustration. {source}. "
                   f"{scene['total_repos']} repositories, {scene['total_events']} unique event records. "
                   f"{counts}. Factory processes are visual metaphors only, not build or deployment status.")
    v = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="310" viewBox="0 0 1000 310" role="img" aria-labelledby="factory-title factory-desc">',
         f'<title id="factory-title">Code Factory | {layout} | {source}</title>',
         f'<desc id="factory-desc">{escape(description)}</desc>',
         '<defs>',
         '<pattern id="bolts" width="28" height="16" patternUnits="userSpaceOnUse"><path d="M0 14h6" stroke="' + p["rail"] + '" opacity=".45" stroke-width="2"/></pattern>',
         '<clipPath id="belt-clip"><rect x="80" y="208" width="838" height="54"/></clipPath>',
         '</defs>',
         _rect(0, 0, 1000, 310, p["bg"]),
         _rect(16, 13, 968, 283, p["panel"], 15, stroke=p["soft"], stroke_width="1", opacity=".96"),
         _text(39, 46, "CODE FACTORY", 24, p["ink"], font_weight="900", letter_spacing="3"),
         _text(40, 66, "a little production line of open-source activity", 12, p["muted"]),
         _rect(780, 27, 174, 26, p["floor"], 13),
         _text(867, 45, source, 11, p["ink"], text_anchor="middle", font_weight="bold", letter_spacing="1"),
         _text(40, 88, "FLOOR 01 / ISOMETRIC" if layout == "isometric" else "FLOOR 02 / PIXEL WORKS", 10, p["accent"], font_weight="bold", letter_spacing="1.5"),
         _text(957, 87, "LIVE LOOP" if animated else "STILL FRAME", 10, p["muted"], text_anchor="end"),
         ]
    return v, p


def _conveyor(p: dict, iso: bool, animated: bool) -> list[str]:
    v = []
    if iso:
        v.extend([_path("M78 218 L910 218 938 251 105 251 Z", p["edge"]),
                  _path("M83 219 L905 219 921 235 99 235 Z", p["rail"]),
                  _path("M87 221 L905 221 914 231 96 231 Z", p["floor"]),
                  _path("M102 252 L938 252 934 259 100 259 Z", p["machine"]),
                  _path("M113 251 l11 0 -2 16 -11 0z M876 251 l13 0 4 16 -13 0z", p["edge"]),
                 ])
        y=228
    else:
        v.extend([_rect(75, 219, 855, 29, p["edge"], 4), _rect(80, 220, 845, 15, p["floor"]),
                  _rect(82, 238, 840, 4, p["rail"]),
                  _rect(130, 246, 12, 16, p["machine"]), _rect(860, 246, 12, 16, p["machine"]),
                  ])
        y=225
    for x in range(106, 918, 32):
        v.append(_path(f"M{x} {y} l12 0", "none", stroke=p["ink"], stroke_width="2", opacity=".30"))
    if animated:
        v += [f'<g opacity=".35" clip-path="url(#belt-clip)"><g class="belt-lines">' +
              ''.join(_path(f"M{x} {y + 7} l14 0", "none", stroke=p["accent"], stroke_width="3") for x in range(78, 944, 32)) +
              '</g></g>']
    return v


def _station_iso(i: int, station: dict, p: dict, active: bool, animated: bool) -> list[str]:
    x = 110 + i * 167
    y = 145 - (i % 2) * 8
    accent = list(COLOURS.values())[i % len(COLOURS)]
    v = [_path(f"M{x-29} {y+61} l41 -21 67 32 -42 22 z", p["edge"], opacity=".45"),
         _path(f"M{x-27} {y+15} l45 -24 45 22 -45 24 z", p["machine2"]),
         _path(f"M{x-27} {y+15} l45 22 v53 l-45 -22 z", p["machine"]),
         _path(f"M{x+18} {y+37} l45 -24 v53 l-45 24 z", p["edge"]),
         _path(f"M{x-19} {y+46} l30 15 v18 l-30 -15 z", p["floor"]),
         _path(f"M{x+27} {y+48} l25 -13 v18 l-25 13 z", p["soft"]),
         _path(f"M{x-17} {y+48} l10 5 v9 l-10 -5 z", accent),
         _path(f"M{x-4} {y+55} l10 5 v9 l-10 -5 z", p["window"]),
         _path(f"M{x+14} {y-7} l11 -6 v-16 l-11 6 z", p["edge"]),
         _path(f"M{x+13} {y-23} l13 -7 10 5 -13 7 z", accent),
         _path(f"M{x+42} {y+11} l8 -4 v-23 l-8 4 z", p["edge"]),
         _path(f"M{x+38} {y-13} l12 -7 9 5 -12 7 z", p["rail"]),
         _text(x+12, y-39, _label(station['name'], 15), 12, p["ink"], text_anchor="middle", font_weight="bold")]
    # Miniature inspection gauge, four rivets and chimney plume.
    v += [_rect(x+35, y+43, 7, 7, p["window"], 2),
          _path(f"M{x+38} {y+45} l3 1", "none", stroke=p["edge"], stroke_width="1"),
          _path(f"M{x-23} {y+20} l3 1 M{x+56} {y+20} l3 -2", "none", stroke=p["window"], stroke_width="1.5")]
    if animated and active:
        v.append(f'<g class="steam"><circle cx="{x+46}" cy="{y-25}" r="3" fill="{p["muted"]}" opacity=".4">'
                 f'<animate attributeName="cy" values="{y-25};{y-44};{y-25}" dur="3.6s" repeatCount="indefinite"/>'
                 '<animate attributeName="opacity" values=".15;.45;0" dur="3.6s" repeatCount="indefinite"/></circle></g>')
    if active:
        v += [_path(f"M{x+39} {y+2} l6 -3 6 3 -6 3z", accent),
              _path(f"M{x-2} {y+8} l11 -6 10 5 -11 6z", p["window"], opacity=".8")]
        if animated:
            v.append(f'<circle cx="{x+42}" cy="{y-7}" r="4" fill="{accent}" class="blink"/>')
    return v


def _station_pixel(i: int, station: dict, p: dict, active: bool, animated: bool) -> list[str]:
    x = 93 + 167 * i
    y = 141 - (i % 2) * 10
    accent = list(COLOURS.values())[i % len(COLOURS)]
    v = [_rect(x, y+18, 120, 63, p["machine"]), _rect(x+5, y+23, 110, 53, p["machine2"]),
         _rect(x+11, y+30, 34, 30, p["edge"]), _rect(x+16, y+35, 24, 20, p["window"]),
         _rect(x+53, y+29, 52, 10, p["edge"]), _rect(x+57, y+31, 24, 6, accent),
         _rect(x+56, y+45, 10, 18, p["floor"]), _rect(x+72, y+45, 10, 18, p["floor"]),
         _rect(x+88, y+45, 10, 18, p["floor"]),
         _rect(x+8, y+5, 104, 14, p["edge"]), _rect(x+17, y-6, 86, 12, p["machine2"]),
         _rect(x+28, y-21, 15, 16, p["edge"]), _rect(x+26, y-26, 20, 5, accent),
         _rect(x+100, y+16, 10, 5, p["window"]),
         _text(x+60, y-36, _label(station['name'], 14), 12, p["ink"], text_anchor="middle", font_weight="bold")]
    # Eight-bit bolt heads, safety stripes and a working chimney.
    v += [_rect(x+10, y+70, 5, 5, p["rail"]), _rect(x+104, y+70, 5, 5, p["rail"]),
          _rect(x+49, y+67, 58, 4, p["edge"]) ]
    if animated and active:
        v.append(f'<g class="steam">{_rect(x+31, y-35, 10, 6, p["muted"])}'
                 f'<animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="3.6s" repeatCount="indefinite"/>'
                 '<animate attributeName="opacity" values="0;.45;0" dur="3.6s" repeatCount="indefinite"/></g>')
    if active:
        v.append(_rect(x+88, y+29, 11, 10, accent))
        if animated:
            v.append(f'<g class="blink">{_rect(x+18,y+40,20,10,p["window"])}</g>')
    return v


def _package(event: dict, p: dict, idx: int, animated: bool, iso: bool, station_index: int) -> str:
    kind, count = event["kind"], event["count"]
    tone = COLOURS[kind]
    symbol = SYMBOLS[kind]
    # No interpolated event content enters SVG as raw markup.
    x = (110 + 167 * station_index) if iso else (153 + 167 * station_index)
    y = 224 if iso else 215
    offset = f'{idx * 0.74:.2f}s'
    body = (_path("M-10 -8 l20 0 6 5 -20 0z", tone) +
            _path("M-10 -8 l6 5 v15 l-6 -5z", p["edge"]) +
            _path("M-4 -3 l20 0 v15 l-20 0z", tone) +
            _text(6, 9, symbol, 14, p["edge"], text_anchor="middle", font_weight="900")) if iso else (
            _rect(-10, -12, 22, 23, p["edge"]) + _rect(-8, -10, 18, 19, tone) +
            _rect(-8, -10, 18, 4, p["window"]) +
            _text(1, 6, symbol, 13, p["edge"], text_anchor="middle", font_weight="900"))
    body += _rect(-12, -15, 5, 5, list(COLOURS.values())[station_index])
    if count > 1:
        body += _rect(8, -21, 27, 13, p["edge"], 5) + _text(21, -11, f'×{count}', 10, p["ink"], text_anchor="middle", font_weight="bold")
    if animated:
        return (f'<g><title>{escape(event["repo"])} | {escape(kind)} ×{count} | {escape(event["when"].isoformat())}</title>'
                f'<g>{body}<animateMotion dur="12s" begin="{offset}" repeatCount="indefinite" '
                f'path="M{x},{y} L965,{y}" calcMode="linear"/></g></g>')
    # Static snapshot positions are deterministic and are not fabricated events.
    sx = 185 + (idx % 6) * 120
    sy = 227 if iso else 225
    return f'<g transform="translate({sx} {sy})"><title>{escape(event["repo"])} | {kind} ×{count}</title>{body}</g>'


def render(snapshot: dict, layout: str = "isometric", theme: str = "dark", animated: bool = True) -> str:
    if layout not in ("isometric", "pixel") or theme not in THEMES or not isinstance(animated, bool):
        raise ValueError("invalid rendering option")
    scene = normalise(snapshot)
    v, p = _intro(scene, theme, layout, animated)
    if animated:
        v.append('<style>@keyframes rolling{from{transform:translateX(-32px)}to{transform:translateX(0)}}'
                 '.belt-lines{animation:rolling .9s linear infinite}.blink{animation:glow 1.8s ease-in-out infinite}'
                 '@keyframes glow{0%,100%{opacity:.35}50%{opacity:1}}'
                 '@media(prefers-reduced-motion:reduce){.belt-lines,.blink{animation:none!important}.steam{display:none}}'
                 '</style>')
    if layout == "isometric":
        # Original, hand-coded geometric floor and mechanical truss.
        v += [_path("M56 210 L170 142 862 142 961 210 860 269 151 269 Z", p["floor2"]),
              _path("M56 210 L170 142 862 142 961 210", "none", stroke=p["rail"], stroke_width="3"),
              _path("M150 269 L860 269", "none", stroke=p["edge"], stroke_width="4"),
              _path("M88 195 l80 -47 693 0 69 47", "none", stroke=p["soft"], stroke_width="2", opacity=".8"),
              _path("M59 208 L167 147 M962 209 L862 146", "none", stroke=p["soft"], stroke_width="2"),
              _path("M60 209 L962 209", "none", stroke=p["rail"], stroke_width="1", opacity=".4"),
             ]
    else:
        v += [_rect(58, 104, 898, 101, p["floor"], 8), _rect(61, 111, 893, 5, p["soft"]),
              _rect(58, 203, 900, 12, p["floor2"]), _rect(55, 262, 910, 11, p["edge"]),
              _rect(61, 269, 897, 4, p["rail"])]
        for x in range(71, 954, 43):
            v.append(_rect(x, 263, 21, 6, p["machine"]))
    station_events = {e["repo"] for e in scene["events"]}
    for i, station in enumerate(scene["stations"]):
        f = _station_iso if layout == "isometric" else _station_pixel
        v.extend(f(i, station, p, station["full_name"] in station_events, animated))
    v += _conveyor(p, layout == "isometric", animated)
    # Maintain a readable single line of five symbols and a visibly honest total.
    station_lookup = {station["full_name"]: i for i, station in enumerate(scene["stations"])}
    for i, event in enumerate(scene["events"]):
        v.append(_package(event, p, i, animated, layout == "isometric", station_lookup[event["repo"]]))
    if not scene["events"]:
        v += [_rect(342, 216, 315, 39, p["panel"], 9, stroke=p["rail"]),
              _text(500, 241, "IDLE SHIFT · NO RECORDED ACTIVITY", 14, p["ink"], text_anchor="middle", font_weight="bold")]
    if scene["total_repos"] > MAX_REPOS or scene["total_events"] > len(scene["events"]):
        message = f'SHOWING {len(scene["stations"])}/{scene["total_repos"]} REPOS · {len(scene["events"])}/{scene["total_events"]} EVENTS'
        v.append(_text(510, 84, message, 10, p["muted"], text_anchor="middle"))
    v += [_rect(28, 273, 944, 16, p["panel"], 4)]
    for i, kind in enumerate(KINDS):
        x = 44 + i * 183
        v.append(_rect(x, 275, 13, 11, COLOURS[kind], 2))
        v.append(_text(x + 18, 285, f'{LABELS[kind]}  {scene["counts"][kind]}', 10, p["ink"], font_weight="bold"))
    v += [_text(965, 305, "METAPHOR ONLY · NOT CI OR DEPLOYMENT STATUS", 9, p["muted"], text_anchor="end"), "</svg>"]
    return "\n".join(v) + "\n"


def export(snapshot: dict, output: Path, layouts: tuple[str, ...] = ("isometric", "pixel"),
           themes: tuple[str, ...] = ("dark", "light")) -> list[Path]:
    output.mkdir(parents=True, exist_ok=True)
    written = []
    for layout in layouts:
        for theme in themes:
            for animated in (True, False):
                filename = f"{layout}-{theme}{'' if animated else '-still'}.svg"
                path = output / filename
                path.write_text(render(snapshot, layout, theme, animated), encoding="utf-8", newline="\n")
                written.append(path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Export LEGACY pre-calendar Code Factory art into exports-legacy by default")
    root = Path(__file__).resolve().parents[2]
    parser.add_argument("--input", type=Path, default=root / "shared/fixtures/demo-activity.json")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "exports-legacy")
    parser.add_argument("--layout", choices=("isometric", "pixel", "both"), default="both")
    parser.add_argument("--theme", choices=("dark", "light", "both"), default="both")
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    layouts = ("isometric", "pixel") if args.layout == "both" else (args.layout,)
    themes = ("dark", "light") if args.theme == "both" else (args.theme,)
    for path in export(data, args.output, layouts, themes):
        print(path)


if __name__ == "__main__":
    main()
