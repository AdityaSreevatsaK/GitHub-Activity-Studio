"""Deterministic offline GitHub Constellation renderer. Python 3.11+, no dependencies."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
import json
from math import cos, pi, sin, sqrt
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEMO = ROOT / "shared" / "fixtures" / "demo-activity.json"
KINDS = ("commit", "pr_opened", "pr_merged", "issue_opened", "release")
SYMBOLS = {"commit": "·", "pr_opened": "+", "pr_merged": "✓", "issue_opened": "?", "release": "◆"}
PALETTES = {
    "night": {"bg": "#080f23", "bg2": "#17263d", "ink": "#eaf2ff", "mute": "#9cacc9", "line": "#537f9a", "focus": "#a5e4e8", "spark": "#e8d9a6", "accent": "#9bd9d5", "panel": "#102039", "hair": "#32445d", "grid": "#263751"},
    "paper": {"bg": "#f8f4e9", "bg2": "#eae6d9", "ink": "#263548", "mute": "#617281", "line": "#7c9fa3", "focus": "#276879", "spark": "#a47739", "accent": "#32798a", "panel": "#fffdf5", "hair": "#d1c7b0", "grid": "#d9d0bc"},
}


def clean_text(value: object, *, optional: bool = False, limit: int = 180) -> str:
    if value is None and optional:
        return ""
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError("Expected non-empty, bounded text field")
    return value.strip()


def safe_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 500:
        raise ValueError("Invalid GitHub URL")
    url = urlsplit(value)
    if url.scheme != "https" or url.netloc.lower() != "github.com" or url.username or url.password:
        raise ValueError("Only public https://github.com URLs are allowed")
    return value


def utc(value: object) -> datetime:
    raw = clean_text(value, limit=40)
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid ISO UTC timestamp") from exc
    if dt.tzinfo is None or dt.utcoffset() != timezone.utc.utcoffset(dt):
        raise ValueError("All timestamps must be UTC")
    return dt.astimezone(timezone.utc)


def normalise(payload: object) -> dict:
    """Validate untrusted input, deduplicate events and stabilise ordering."""
    if not isinstance(payload, dict) or payload.get("schema_version") != "1":
        raise ValueError("Expected data contract schema_version 1")
    if payload.get("source") not in ("demo", "github"):
        raise ValueError("source must be demo or github")
    generated = utc(payload.get("generated_at"))
    user = payload.get("user")
    if not isinstance(user, dict):
        raise ValueError("Missing user object")
    login = clean_text(user.get("login"))
    user_url = safe_url(user.get("url"))
    repos = payload.get("repositories")
    events = payload.get("activity")
    if not isinstance(repos, list) or not isinstance(events, list) or len(repos) > 500 or len(events) > 10000:
        raise ValueError("Invalid or oversized repositories/activity arrays")
    by_name = {}
    for item in repos:
        if not isinstance(item, dict):
            raise ValueError("Invalid repository")
        full = clean_text(item.get("full_name"))
        if full in by_name or "/" not in full:
            raise ValueError("Duplicate or invalid repository full_name")
        stars = item.get("stars", 0)
        if isinstance(stars, bool) or not isinstance(stars, int) or not 0 <= stars <= 100_000_000:
            raise ValueError("Invalid stars count")
        by_name[full] = {"full_name": full, "name": clean_text(item.get("name", full.split("/")[-1])), "url": safe_url(item.get("url")), "language": clean_text(item.get("language") or "Unspecified"), "stars": stars}
    unique = {}
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("Invalid event")
        eid = clean_text(event.get("id"))
        if eid in unique:
            continue
        kind = event.get("kind")
        if kind not in KINDS:
            raise ValueError("Unsupported activity kind")
        full = clean_text(event.get("repo_full_name"))
        if full not in by_name:
            raise ValueError("Activity references unknown repository")
        count = event.get("count", 1)
        if isinstance(count, bool) or not isinstance(count, int) or not 1 <= count <= 1_000_000:
            raise ValueError("Activity count must be positive integer")
        unique[eid] = {"id": eid, "kind": kind, "repo_full_name": full, "occurred_at": utc(event.get("occurred_at")), "url": safe_url(event.get("url")), "count": count}
    ordered = sorted(unique.values(), key=lambda e: (e["occurred_at"], e["id"]))
    intensity = Counter()
    for event in ordered:
        intensity[event["repo_full_name"]] += event["count"]
    top = sorted(by_name.values(), key=lambda r: (-intensity[r["full_name"]], r["full_name"]))[:15]
    # Positions use stable name order, independent of changes in activity levels.
    visible = sorted(top, key=lambda r: r["full_name"])
    return {"source": payload["source"], "generated_at": generated, "login": login, "user_url": user_url, "repositories": visible, "events": [e for e in ordered if e["repo_full_name"] in {r["full_name"] for r in visible}], "total_repos": len(by_name), "total_events": len(ordered)}


def positions(repos: list[dict], layout: str) -> dict[str, tuple[float, float]]:
    """Curated radial rings or language lanes, with collision-safe cell fallback."""
    if layout not in ("radial", "clustered"):
        raise ValueError("layout must be radial or clustered")
    n = len(repos)
    out = {}
    if not n:
        return out
    if layout == "radial" and n <= 9:
        # Elliptical clock face: whitespace reserved for left-hand editorial index.
        phase = -pi / 2
        for i, repo in enumerate(repos):
            angle = phase + 2 * pi * i / n
            rx, ry = (300, 94) if n <= 6 else (320, 116)
            out[repo["full_name"]] = (767 + rx * cos(angle), 197 + ry * sin(angle))
        return out
    if layout == "clustered":
        languages = sorted({r["language"] for r in repos})
        lanes = {language: index for index, language in enumerate(languages)}
        grouped = defaultdict(list)
        for repo in repos:
            grouped[repo["language"]].append(repo)
        for language in languages:
            lane = lanes[language]
            group = grouped[language]
            # For many distinct languages, fall back to wider grid to maintain legibility.
            if len(languages) <= 4 and max(len(grouped[value]) for value in languages) <= 5:
                y = 108 + lane * (180 / max(1, len(languages) - 1))
                for i, repo in enumerate(group):
                    x = 445 + (i + 0.5) * 650 / len(group)
                    out[repo["full_name"]] = (x, y + (i % 2) * 13)
                continue
            break
        if len(out) == n:
            return out
    # Graceful crowding strategy: stable, staggered 5-column bands.
    out.clear()
    cols = min(5, n)
    rows = (n + cols - 1) // cols
    for i, repo in enumerate(repos):
        row, col = divmod(i, cols)
        out[repo["full_name"]] = (475 + col * (590 / max(1, cols - 1)) + (row % 2) * 14, 101 + row * (182 / max(1, rows - 1)))
    return out


def short(name: str, max_len: int = 19) -> str:
    return name if len(name) <= max_len else name[:max_len - 1] + "…"


def fnum(number: float) -> str:
    return f"{number:.1f}"


def render(model: dict, layout: str = "radial", theme: str = "night", *, animated: bool = True) -> str:
    if theme not in PALETTES:
        raise ValueError("Invalid theme")
    p = PALETTES[theme]
    repos, events = model["repositories"], model["events"]
    coords = positions(repos, layout)
    units = Counter()
    by_repo = defaultdict(Counter)
    for e in events:
        units[e["repo_full_name"]] += e["count"]
        by_repo[e["repo_full_name"]][e["kind"]] += e["count"]
    links = []
    for i, r in enumerate(repos):
        for other in repos[i + 1:]:
            if r["language"] != "Unspecified" and r["language"] == other["language"]:
                links.append((r["full_name"], other["full_name"]))
    esc = lambda s: escape(str(s), quote=True)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 375" width="1200" height="375" role="img" aria-labelledby="sky-title sky-desc" data-layout="{layout}" data-theme="{theme}" data-source="{model["source"]}" data-repositories="{len(repos)}" data-events="{len(events)}">',
        '<title id="sky-title">GitHub Constellation, ' + esc(layout) + ', ' + esc(theme) + '</title>',
        '<desc id="sky-desc">' + esc(f'{"DEMO synthetic" if model["source"] == "demo" else "Public GitHub snapshot"} activity for {model["login"]}: {len(repos)} visible repositories. Stars represent repositories, lines indicate shared programming language, rings replay sourced events. No connection implies collaboration.') + '</desc>',
        '<defs>',
        f'<linearGradient id="sky" x2="1" y2="1"><stop stop-color="{p["bg"]}"/><stop offset="1" stop-color="{p["bg2"]}"/></linearGradient>',
        f'<radialGradient id="halo"><stop stop-color="{p["spark"]}" stop-opacity=".35"/><stop offset="1" stop-color="{p["spark"]}" stop-opacity="0"/></radialGradient>',
        '<style><![CDATA[',
        'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif} .pulse{opacity:0;transform-box:fill-box;transform-origin:center;animation:echo 16s ease-out infinite} .twinkle{animation:twinkle 16s ease-in-out infinite} .trail{stroke-dasharray:3 13;animation:drift 16s linear infinite} .star-link{cursor:pointer} .star-link:focus .hit,.star-link:hover .hit{stroke-width:2.5;stroke-opacity:1} @keyframes echo{0%,9%,100%{opacity:0;transform:scale(.7)}12%{opacity:.75;transform:scale(1)}22%{opacity:0;transform:scale(2.8)}} @keyframes twinkle{0%,100%{opacity:.75}50%{opacity:1}} @keyframes drift{to{stroke-dashoffset:-128}} @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}.traveller{display:none!important}}',
        ']]></style></defs>',
        '<rect width="1200" height="375" rx="20" fill="url(#sky)"/>',
        f'<rect x="10" y="10" width="1180" height="355" rx="14" fill="none" stroke="{p["hair"]}" stroke-opacity=".70"/>',
    ]
    if theme == "paper":
        for x in range(64, 1180, 55):
            parts.append(f'<path d="M{x} 24 V351" stroke="{p["grid"]}" stroke-opacity=".27" stroke-width=".8"/>')
        for y in range(42, 350, 42):
            parts.append(f'<path d="M28 {y} H1172" stroke="{p["grid"]}" stroke-opacity=".27" stroke-width=".8"/>')
        parts.append(f'<circle cx="766" cy="195" r="155" fill="none" stroke="{p["grid"]}" stroke-dasharray="2 7" opacity=".8"/>')
    else:
        for i in range(54):
            digest = sha256(f"dust:{i}".encode()).digest()
            x = 335 + digest[0] * 3.2
            y = 40 + digest[1] * 1.08
            parts.append(f'<circle cx="{fnum(x)}" cy="{fnum(y)}" r="{.4 + digest[2]/700:.2f}" fill="{p["ink"]}" opacity=".19"/>')
        parts.append(f'<path d="M364 288 Q745 -15 1145 151" fill="none" stroke="{p["line"]}" stroke-opacity=".16" stroke-width="28"/>')
    parts += [
        f'<text x="47" y="52" font-size="11" letter-spacing="3.5" fill="{p["accent"]}">THE ACTIVITY ATLAS / 01</text>',
        f'<text x="45" y="106" font-family="Georgia,serif" font-size="34" font-weight="500" fill="{p["ink"]}">Constellation</text>',
        f'<text x="47" y="135" font-size="12" fill="{p["mute"]}">A map of repositories in motion.</text>',
        f'<path d="M47 155 H282" stroke="{p["hair"]}"/>',
        f'<text x="47" y="183" font-size="10" letter-spacing="1.8" fill="{p["mute"]}">{esc(model["login"].upper()[:30])}</text>',
        f'<text x="47" y="216" font-size="25" fill="{p["ink"]}">{len(repos):02d} <tspan font-size="12" fill="{p["mute"]}">systems in view</tspan></text>',
        f'<text x="47" y="246" font-size="12" fill="{p["mute"]}">{len(events)} distinct events · {sum(e["count"] for e in events)} units</text>',
        f'<text x="47" y="277" font-size="11" fill="{p["accent"]}">● <tspan fill="{p["mute"]}">star size = GitHub stars</tspan></text>',
        f'<text x="47" y="296" font-size="11" fill="{p["accent"]}">⌁ <tspan fill="{p["mute"]}">link = shared language</tspan></text>',
        f'<text x="47" y="316" font-size="11" fill="{p["accent"]}">◌ <tspan fill="{p["mute"]}">pulse = recorded event</tspan></text>',
    ]
    if not repos:
        parts.append(f'<text x="756" y="190" text-anchor="middle" font-family="Georgia,serif" font-size="24" fill="{p["ink"]}">The sky is quiet.</text>')
        parts.append(f'<text x="756" y="216" text-anchor="middle" font-size="12" fill="{p["mute"]}">No public repositories are present in this snapshot.</text>')
    for first, second in links:
        x1, y1 = coords[first]; x2, y2 = coords[second]
        parts.append(f'<path d="M{fnum(x1)} {fnum(y1)} Q{fnum((x1+x2)/2)} {fnum((y1+y2)/2-23)} {fnum(x2)} {fnum(y2)}" fill="none" stroke="{p["line"]}" stroke-opacity=".47" stroke-width="1.2" stroke-dasharray="3 5" data-relation="shared-language"/>')
    if animated and events:
        # Chronological event order drives phase; each source event emits one pulse.
        for index, e in enumerate(events[:150]):
            x, y = coords[e["repo_full_name"]]
            phase = 16 * index / len(events)
            size = 9 + min(10, sqrt(e["count"]) * 2.2)
            parts.append(f'<circle class="pulse" cx="{fnum(x)}" cy="{fnum(y)}" r="{fnum(size)}" fill="none" stroke="{p["spark"]}" stroke-width="1.4" style="animation-delay:{phase:.3f}s" data-event="{esc(e["id"])}" data-kind="{esc(e["kind"])}"><title>{esc(e["kind"])}: {e["count"]} at {esc(e["occurred_at"].isoformat())}</title></circle>')
    if animated and links and events:
        # A traveller runs only on a factual same-language link, triggered by an event
        # in one of its endpoint repositories. It is not a claim of collaboration.
        for index, e in enumerate(events[:150]):
            target = next((b if a == e["repo_full_name"] else a for a, b in links if e["repo_full_name"] in (a, b)), None)
            if target is None:
                continue
            x1, y1 = coords[e["repo_full_name"]]; x2, y2 = coords[target]
            a = 0.03 + 0.90 * index / len(events)
            b = min(.98, a + .065)
            path = f"M{fnum(x1)} {fnum(y1)} Q{fnum((x1+x2)/2)} {fnum((y1+y2)/2-23)} {fnum(x2)} {fnum(y2)}"
            parts.append(f'<circle class="traveller" r="2.5" fill="{p["spark"]}" opacity="0"><animateMotion path="{path}" dur="16s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;{a:.3f};{b:.3f};1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;.85;0;0" keyTimes="0;{a:.3f};{(a+b)/2:.3f};{b:.3f};1"/></circle>')
    for index, r in enumerate(repos):
        x, y = coords[r["full_name"]]
        radius = 4.4 + min(5.5, sqrt(r["stars"]) * 1.15)
        full = r["full_name"]
        detail = " · ".join(f"{k.replace('_', ' ')} {by_repo[full][k]}" for k in KINDS if by_repo[full][k]) or "no activity"
        label = short(r["name"], 16 if len(repos) > 9 else 19)
        parts.append(f'<a class="star-link" href="{esc(r["url"])}" target="_blank" rel="noopener noreferrer" tabindex="0" aria-label="{esc(full)}; {esc(r["language"])}; {r["stars"]} stars; {units[full]} recorded units" data-full-name="{esc(full)}" data-language="{esc(r["language"])}" data-stars="{r["stars"]}" data-units="{units[full]}" data-events="{esc(detail)}">')
        parts.append(f'<title>{esc(full)} · {esc(r["language"])} · {r["stars"]} stars · {esc(detail)}</title>')
        parts.append(f'<circle cx="{fnum(x)}" cy="{fnum(y)}" r="22" fill="url(#halo)" opacity=".7"/>')
        parts.append(f'<circle class="hit" cx="{fnum(x)}" cy="{fnum(y)}" r="{fnum(radius+5)}" fill="none" stroke="{p["accent"]}" stroke-opacity=".38" stroke-width=".85"/>')
        parts.append(f'<circle class="twinkle" cx="{fnum(x)}" cy="{fnum(y)}" r="{fnum(radius)}" fill="{p["spark"]}" stroke="{p["panel"]}" stroke-width="1.8"/>')
        parts.append(f'<path d="M{fnum(x-15)} {fnum(y)} H{fnum(x-9)} M{fnum(x+9)} {fnum(y)} H{fnum(x+15)} M{fnum(x)} {fnum(y-15)} V{fnum(y-9)} M{fnum(x)} {fnum(y+9)} V{fnum(y+15)}" stroke="{p["accent"]}" stroke-opacity=".6" stroke-width=".8"/>')
        # Label backing permits contrast against dust/lines; separate activity units.
        width = min(172, 14 + len(label) * 7.3)
        parts.append(f'<rect x="{fnum(x-width/2)}" y="{fnum(y+21)}" width="{fnum(width)}" height="27" rx="7" fill="{p["panel"]}" fill-opacity=".92" stroke="{p["hair"]}" stroke-opacity=".65"/>')
        parts.append(f'<text x="{fnum(x)}" y="{fnum(y+33)}" text-anchor="middle" font-size="11" font-weight="600" fill="{p["ink"]}">{esc(label)}</text>')
        parts.append(f'<text x="{fnum(x)}" y="{fnum(y+43)}" text-anchor="middle" font-size="8" fill="{p["mute"]}">{units[full]} activity units</text></a>')
    marker = "SYNTHETIC DEMO · NOT LIVE DATA" if model["source"] == "demo" else "PUBLIC GITHUB SNAPSHOT · NOT LIVE"
    hidden = model["total_repos"] - len(repos)
    parts += [
        f'<path d="M33 334 H1167" stroke="{p["hair"]}"/>',
        f'<text x="47" y="352" font-size="10" font-weight="700" letter-spacing="1.2" fill="{p["accent"]}">{esc(marker)}</text>',
        f'<text x="1155" y="352" text-anchor="end" font-size="10" fill="{p["mute"]}">{esc(layout.upper())} · 16s replay{f" · {hidden} omitted (top 15 by units)" if hidden else ""}</text>',
        '</svg>'
    ]
    return "\n".join(parts) + "\n"


def build(input_path: Path = DEMO, output: Path = HERE / "assets") -> list[Path]:
    data = normalise(json.loads(input_path.read_text(encoding="utf-8")))
    output.mkdir(parents=True, exist_ok=True)
    files = []
    for layout in ("radial", "clustered"):
        for theme in ("night", "paper"):
            for animated, label in ((True, "animated"), (False, "still")):
                path = output / f"{layout}-{theme}-{label}.svg"
                path.write_text(render(data, layout, theme, animated=animated), encoding="utf-8")
                files.append(path)
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description="Render deterministic GitHub Constellation exports offline")
    parser.add_argument("--input", type=Path, default=DEMO, help="Normalised contract-v1 JSON snapshot")
    parser.add_argument("--out", type=Path, default=HERE / "assets", help="Export directory")
    args = parser.parse_args()
    for path in build(args.input, args.out):
        print(f"Wrote {path} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()