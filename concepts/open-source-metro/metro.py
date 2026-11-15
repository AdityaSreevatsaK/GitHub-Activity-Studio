"""Open Source Metro: deterministic, offline GitHub-activity schematic SVG renderer."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

KINDS = (
    ("commit", "CODE", "Commits"),
    ("pr_opened", "PROPOSE", "PRs opened"),
    ("pr_merged", "MERGE", "PRs merged"),
    ("issue_opened", "DISCUSS", "Issues opened"),
    ("release", "SHIP", "Releases"),
)
COLOURS = {
    "modern": ("#48DEC6", "#FF887C", "#B8A0F4", "#FFD074", "#78ACFF"),
    "vintage": ("#398174", "#B86658", "#89759E", "#B38445", "#607D9A"),
}
STYLES = {
    ("modern", "dark"): ("#0B1724", "#102335", "#EAF5FA", "#94A9BD", "#2A4052", "#152C3D"),
    ("modern", "light"): ("#F2F8FB", "#FFFFFF", "#163145", "#506B7F", "#C6D6E0", "#E8F1F6"),
    ("vintage", "light"): ("#F0E8D9", "#FBF4E5", "#322F2C", "#746D63", "#CCBFA9", "#E6DCC9"),
    ("vintage", "dark"): ("#24292D", "#31343A", "#F5E6CB", "#B8AD99", "#666157", "#3F403F"),
}
MAX_REPOS = 18
MAX_EVENTS = 240


def _date(value: object) -> datetime:
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError("timestamps must be UTC ISO 8601 strings")
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if not date.tzinfo or date.utcoffset() != timezone.utc.utcoffset(date):
        raise ValueError("timestamps must use UTC")
    return date.astimezone(timezone.utc)


def safe_url(value: object) -> str | None:
    """Only permit normal, external GitHub HTTPS links in browser previews."""
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 32 for c in value):
        return None
    try:
        url = urlsplit(value)
        if (url.scheme.lower() == "https" and url.hostname == "github.com" and
                not url.username and not url.password and url.port in (None, 443) and
                url.path.startswith("/") and not value.startswith("https://github.com//")):
            return value
    except ValueError:
        pass
    return None


def load_snapshot(path: str | Path) -> dict:
    return normalise(json.loads(Path(path).read_text(encoding="utf-8")))


def normalise(data: object) -> dict:
    if not isinstance(data, dict) or data.get("schema_version") != "1":
        raise ValueError("expected snapshot schema_version 1")
    if data.get("source") not in ("demo", "github"):
        raise ValueError("source must be demo or github")
    _date(data.get("generated_at"))
    if not isinstance(data.get("user"), dict) or not isinstance(data["user"].get("login"), str):
        raise ValueError("missing user.login")
    if not isinstance(data.get("repositories"), list) or not isinstance(data.get("activity"), list):
        raise ValueError("repositories and activity must be lists")
    repos = {}
    for repo in data["repositories"]:
        if not isinstance(repo, dict):
            raise ValueError("invalid repository")
        full = repo.get("full_name")
        if not isinstance(full, str) or len(full) > 200 or not re.fullmatch(r"[^/\s]+/[^/\s]+", full):
            raise ValueError("invalid repository full_name")
        if full in repos:
            raise ValueError("duplicate repository full_name")
        name = repo.get("name", full.split("/", 1)[1])
        if not isinstance(name, str) or not 1 <= len(name) <= 200:
            raise ValueError("invalid repository name")
        repos[full] = {"full_name": full, "name": name,
                       "url": safe_url(repo.get("url")),
                       "language": repo.get("language") if isinstance(repo.get("language"), str) else None}
    events, seen = [], set()
    for event in data["activity"]:
        if not isinstance(event, dict):
            raise ValueError("invalid event")
        identity = event.get("id")
        if not isinstance(identity, str) or not 1 <= len(identity) <= 160:
            raise ValueError("invalid event id")
        if identity in seen:
            continue
        seen.add(identity)
        if event.get("kind") not in {k[0] for k in KINDS}:
            raise ValueError("unsupported activity kind")
        if event.get("repo_full_name") not in repos:
            raise ValueError("activity references an unknown repository")
        count = event.get("count", 1)
        if type(count) is not int or not 1 <= count <= 100000:
            raise ValueError("event count must be a positive integer")
        event_date = _date(event.get("occurred_at"))
        events.append({"id": identity, "kind": event["kind"], "repo_full_name": event["repo_full_name"],
                       "when": event_date, "count": count, "url": safe_url(event.get("url"))})
    events.sort(key=lambda e: (e["when"], e["id"]))
    first = {full: next((e["when"] for e in events if e["repo_full_name"] == full), datetime.max.replace(tzinfo=timezone.utc)) for full in repos}
    sorted_repos = sorted(repos.values(), key=lambda r: (first[r["full_name"]], r["full_name"]))
    return {"source": data["source"], "user": data["user"]["login"], "repositories": sorted_repos,
            "events": events, "repo_total": len(sorted_repos), "event_total": len(events)}


def layout(snapshot: dict) -> dict:
    selected = snapshot["repositories"][:MAX_REPOS]
    per_row = 5 if len(selected) <= 5 else 6
    rows = max(1, (len(selected) + per_row - 1) // per_row)
    positions = {}
    for i, repo in enumerate(selected):
        row, col = divmod(i, per_row)
        row_count = min(per_row, len(selected) - row * per_row)
        x = 247 + (834 * (col + .5) / row_count) if row_count > 1 else 664
        positions[repo["full_name"]] = (round(x, 2), row)
    visible = [e for e in snapshot["events"] if e["repo_full_name"] in positions][:MAX_EVENTS]
    return {"positions": positions, "visible": visible, "repositories": selected, "rows": rows,
            "height": 376 + (rows - 1) * 258,
            "omitted_repos": snapshot["repo_total"] - len(selected),
            "omitted_events": snapshot["event_total"] - len(visible)}


def _text(x: float, y: float, text: object, klass: str = "", anchor: str = "start", extra: str = "") -> str:
    return f'<text x="{x:g}" y="{y:g}" class="{klass}" text-anchor="{anchor}" {extra}>{escape(str(text))}</text>'


def _clip_label(value: str, length: int = 19) -> str:
    return value if len(value) <= length else value[:length - 1] + "…"


def render(snapshot: dict, *, style: str = "modern", scheme: str = "dark", animated: bool = True,
           browser_links: bool = False) -> str:
    if (style, scheme) not in STYLES:
        raise ValueError("unknown design or colour scheme")
    plan = layout(snapshot)
    bg, surface, ink, muted, rule, panel = STYLES[style, scheme]
    colours = COLOURS[style]
    vintage = style == "vintage"
    h = plan["height"]
    e = escape
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 {h}" width="1200" height="{h}" role="img" aria-labelledby="metroTitle metroDesc">',
        f'<title id="metroTitle">Open Source Metro, {style} {scheme} visualisation</title>',
        f'<desc id="metroDesc">{"Synthetic demo" if snapshot["source"] == "demo" else "Public GitHub snapshot"} metro map. Repositories are stations; five colour-coded lines represent commits, pull requests opened, pull requests merged, issues opened, and releases. Animated trains replay recorded events in UTC timestamp order. Lines show shared event types, not repository dependencies.</desc>',
        '<defs><style><![CDATA[',
        f'.headline{{font:700 28px {"Georgia,serif" if vintage else "system-ui,sans-serif"};letter-spacing:1.3px;fill:{ink}}}',
        f'.kicker{{font:700 10px system-ui,sans-serif;letter-spacing:3px;fill:{muted}}}',
        f'.station{{font:600 14px {"Georgia,serif" if vintage else "system-ui,sans-serif"};fill:{ink}}}',
        f'.small{{font:600 9px system-ui,sans-serif;letter-spacing:1px;fill:{muted}}}',
        f'.line-name{{font:700 11px system-ui,sans-serif;letter-spacing:1px;fill:{ink}}}',
        f'.detail{{font:500 10px system-ui,sans-serif;fill:{muted}}}',
        '.stop:focus{outline:none}.stop:focus .focus-ring{stroke-width:4;opacity:1}',
        f'@media (prefers-reduced-motion:reduce){{.train,.pulse{{display:none}}}}',
        ']]></style></defs>',
        f'<rect width="1200" height="{h}" fill="{bg}"/>',
        f'<rect x="18" y="18" width="1164" height="{h-36}" rx="{14 if not vintage else 4}" fill="{surface}" stroke="{rule}" stroke-width="1.5"/>']
    if vintage:
        parts += [f'<path d="M30 78H1170 M30 {h-47}H1170" stroke="{rule}" stroke-width="2"/>',
                  f'<path d="M32 80H1168" stroke="{muted}" stroke-opacity=".4" stroke-width=".5"/>',
                  f'<circle cx="1137" cy="103" r="13" stroke="{muted}" stroke-width="1" fill="none" opacity=".5"/>',
                  _text(1137, 106, "OS", "small", "middle")]
    else:
        parts += [f'<rect x="34" y="30" width="5" height="44" rx="2.5" fill="{colours[0]}"/>']
    parts += [_text(52, 48, "OPEN SOURCE METRO", "headline"),
              _text(54, 67, "AN ACTIVITY TRANSIT DIAGRAM  /  EVENT-TYPE SERVICES", "kicker"),
              _text(1142, 39, "SYNTHETIC DEMO" if snapshot["source"] == "demo" else "PUBLIC GITHUB SNAPSHOT", "kicker", "end"),
              _text(1142, 57, f'{snapshot["repo_total"]} repos   ·   {snapshot["event_total"]} source events', "detail", "end")]
    # Every route occupies its own reserved lane and calls only at repos with recorded events of that type.
    for row in range(plan["rows"]):
        row_repos = [r for r in plan["repositories"] if plan["positions"][r["full_name"]][1] == row]
        off = row * 258
        if row > 0:
            parts.append(f'<path d="M44 {off+83}H1156" stroke="{rule}" stroke-width="1" stroke-dasharray="3 7"/>')
        parts.append(_text(54, 112 + off, f'DISTRICT {row + 1:02d}', "kicker"))
        for repo in row_repos:
            full, name = repo["full_name"], repo["name"]
            x = plan["positions"][full][0]
            parts.append(f'<g class="station-node"><title>{e(full)}</title>')
            parts.append(f'<path d="M{x:g} {143+off}V{309+off}" stroke="{rule}" stroke-width="1.2" stroke-dasharray="3 7"/>')
            if vintage:
                parts.append(f'<rect x="{x-4:g}" y="{133+off}" width="8" height="8" transform="rotate(45 {x:g} {137+off})" fill="{surface}" stroke="{ink}" stroke-width="1.7"/>')
            else:
                parts.append(f'<circle cx="{x:g}" cy="{137+off}" r="4.5" fill="{surface}" stroke="{ink}" stroke-width="1.7"/>')
            parts.append(_text(x, 129 + off, _clip_label(name, 15 if len(plan["repositories"]) > 5 else 19), "station", "middle"))
            parts.append('</g>')
        for kind_idx, (kind, code, label) in enumerate(KINDS):
            y = 155 + off + 37 * kind_idx
            colour = colours[kind_idx]
            subset = [ev for ev in plan["visible"] if ev["kind"] == kind and plan["positions"][ev["repo_full_name"]][1] == row]
            parts.append(f'<g class="line-{kind}">')
            parts.append(f'<rect x="45" y="{y-11}" width="9" height="17" rx="4.5" fill="{colour}"/>')
            parts.append(_text(66, y + 4, code, "line-name"))
            parts.append(f'<path d="M197 {y}H1141" fill="none" stroke="{rule}" stroke-width="9" stroke-linecap="round" opacity=".45"/>')
            parts.append(f'<path d="M197 {y}H1141" fill="none" stroke="{colour}" stroke-width="{6 if vintage else 4}" stroke-linecap="{"square" if vintage else "round"}" opacity="{.85 if subset else .25}"/>')
            if vintage:
                parts.append(f'<path d="M197 {y}H1141" fill="none" stroke="{surface}" stroke-width="1.2" opacity=".65"/>')
            if subset:
                groups = defaultdict(list)
                for ev in subset:
                    groups[ev["repo_full_name"]].append(ev)
                for full, evs in groups.items():
                    x = plan["positions"][full][0]
                    count = sum(ev["count"] for ev in evs)
                    title = f'{full} · {label}: ' + ', '.join(f'{ev["id"]} ({ev["when"].strftime("%d %b %Y %H:%M UTC")}, {ev["count"]} unit(s))' for ev in evs)
                    url = next((ev["url"] for ev in evs if ev["url"]), None)
                    attrs = f' class="stop" tabindex="0" aria-label="{e(title, quote=True)}"'
                    if browser_links and snapshot["source"] == "github" and url:
                        parts.append(f'<a xlink:href="{e(url,quote=True)}" target="_blank" rel="noopener noreferrer"{attrs}>')
                    else:
                        parts.append(f'<g{attrs}>')
                    parts.append(f'<title>{e(title)}</title>')
                    parts.append(f'<circle class="focus-ring" cx="{x:g}" cy="{y}" r="13" fill="none" stroke="{colour}" stroke-width="0" opacity=".85"/>')
                    if vintage:
                        parts.append(f'<rect x="{x-8:g}" y="{y-8}" width="16" height="16" fill="{surface}" stroke="{colour}" stroke-width="2.8" transform="rotate(45 {x:g} {y})"/>')
                    else:
                        parts.append(f'<circle cx="{x:g}" cy="{y}" r="9" fill="{surface}" stroke="{colour}" stroke-width="3"/>')
                    parts.append(f'<circle cx="{x:g}" cy="{y}" r="3.5" fill="{colour}"/>')
                    if count > 1:
                        parts.append(_text(x+13, y-9, str(count), "small"))
                    parts.append('</a>' if browser_links and snapshot["source"] == "github" and url else '</g>')
                if animated:
                    # The ordered points are recorded timestamps, not hypothetical repository links.
                    xs = [plan["positions"][ev["repo_full_name"]][0] for ev in subset]
                    path = f'M 197,{y} ' + ' '.join(f'L {x:g},{y}' for x in xs)
                    dur = max(9, len(xs) * 3)
                    total = sum(abs(xs[i] - (197 if i == 0 else xs[i-1])) for i in range(len(xs)))
                    covered, fractions = 0.0, [0.0]
                    for i, x in enumerate(xs):
                        covered += abs(x - (197 if i == 0 else xs[i-1]))
                        fractions.append(covered / total if total else 1.0)
                    fractions.append(1.0)
                    points = ';'.join(f'{p:.6f}' for p in fractions)
                    times = ';'.join(f'{i / (len(xs)+1):.6f}' for i in range(len(xs)+2))
                    parts.append(f'<g class="train" aria-hidden="true">')
                    parts.append(f'<rect x="-13" y="-8" width="26" height="16" rx="6" fill="{colour}" stroke="{ink}" stroke-opacity=".35" stroke-width="1"/>')
                    parts.append(f'<rect x="-7" y="-5" width="7" height="5" rx="1.5" fill="{bg}" opacity=".85"/>')
                    parts.append(f'<rect x="3" y="-5" width="5" height="5" rx="1.5" fill="{bg}" opacity=".85"/>')
                    parts.append(f'<animateMotion dur="{dur}s" repeatCount="indefinite" calcMode="linear" keyPoints="{points}" keyTimes="{times}" path="{path}"/>')
                    parts.append('</g>')
                    for index, ev in enumerate(subset):
                        x = xs[index]
                        begin = dur * (index + 1) / (len(xs) + 1)
                        parts.append(f'<circle class="pulse" cx="{x:g}" cy="{y}" r="17" fill="none" stroke="{colour}" stroke-width="2" opacity="0" aria-hidden="true">')
                        parts.append(f'<animate attributeName="opacity" values="0;.85;0" dur="1.1s" begin="{begin:g}s" repeatCount="indefinite"/>')
                        parts.append('</circle>')
            else:
                parts.append(_text(1117, y-7, "NO SERVICE", "small", "end"))
            parts.append('</g>')
    if not plan["visible"]:
        parts.append(_text(664, 330 + (plan["rows"]-1)*258, "NO RECORDED ACTIVITY IN THIS SNAPSHOT", "small", "middle"))
    footer_y = h-45
    parts.append(f'<path d="M43 {footer_y-14}H1156" stroke="{rule}" stroke-width="1"/>')
    parts.append(_text(54, footer_y+6, "LINES = EVENT TYPES   ·   TRAIN JOURNEYS = UTC-ORDERED REPLAYS   ·   STATIONS = REPOSITORIES", "small"))
    caption = "REPLAY  /  DEMO ONLY" if snapshot["source"] == "demo" else "REPLAY  /  PUBLIC EVENTS ONLY"
    if plan["omitted_repos"] or plan["omitted_events"]:
        caption += f'  /  OMITTED {plan["omitted_repos"]} REPOS + {plan["omitted_events"]} EVENTS'
    parts.append(_text(1140, footer_y+6, caption, "small", "end"))
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def stress_snapshot(snapshot: dict, count: int = 17) -> dict:
    """Generate a labelled synthetic scale test, never presented as actual activity."""
    if snapshot["source"] != "demo":
        raise ValueError("stress generation is for demo data only")
    source_repos = snapshot["repositories"]
    if not source_repos or not 1 <= count <= MAX_REPOS:
        raise ValueError("stress scenario needs 1-18 demo repositories")
    repos, events = [], []
    for i in range(count):
        original = source_repos[i % len(source_repos)]
        full = f'demo-network/{original["name"]}-{i+1:02}'
        repos.append({"full_name": full, "name": f'{original["name"]}-{i+1:02}', "url": "https://github.com/example"})
        # One known kind, deterministic order; no fabricated source-backed claims.
        original_events = [ev for ev in snapshot["events"] if ev["repo_full_name"] == original["full_name"]]
        for j, ev in enumerate(original_events[:2]):
            events.append({"id": f'stress-{i+1:02}-{j+1}', "kind": ev["kind"],
                           "repo_full_name": full, "occurred_at": ev["when"].isoformat(),
                           "url": "https://github.com/example", "count": ev["count"]})
    return normalise({"schema_version": "1", "source": "demo", "generated_at": "2026-11-16T00:00:00Z",
                      "user": {"login": "stress-demo"}, "repositories": repos, "activity": events})


def write_preview(destination: Path) -> None:
    markup = '''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Source Metro | Design laboratory</title>
<style>
:root{color-scheme:dark;font-family:system-ui,Segoe UI,sans-serif;background:#081521;color:#e9f4fa}
*{box-sizing:border-box}body{margin:0;padding:clamp(18px,4vw,55px)}main{max-width:1400px;margin:auto}
.eyebrow{color:#61deca;text-transform:uppercase;letter-spacing:.22em;font-size:.75rem;font-weight:800}
h1{font-size:clamp(2rem,5vw,3.8rem);letter-spacing:-.05em;margin:.3em 0}.lede{max-width:65ch;color:#a7bbc9;line-height:1.65}
.controls{display:flex;flex-wrap:wrap;gap:15px;margin:30px 0;align-items:end}label{display:grid;gap:7px;color:#a7bbc9;font-size:.78rem;text-transform:uppercase;letter-spacing:.13em}
select{background:#152838;color:#fff;padding:10px 28px 10px 12px;border:1px solid #3c5666;border-radius:8px;font:600 1rem system-ui}
.figure{padding:15px;border:1px solid #2b4152;border-radius:18px;background:#0e2030;box-shadow:0 20px 70px #0004}
object{width:100%;height:auto;aspect-ratio:1200/376;display:block}.figure.stress object{aspect-ratio:1200/892}
.caption{font-size:.84rem;color:#a7bbc9;margin:12px 4px 2px}p{line-height:1.6}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:24px 0}.tile{padding:18px;background:#102535;border:1px solid #2b4152;border-radius:12px}.tile strong{display:block;margin-bottom:5px}.tile span{color:#a7bbc9;font-size:.9rem}
a{color:#7de3d2}@media(max-width:700px){body{padding:14px}.figure{padding:2px}.figure object{min-width:0}}
</style></head><body><main><span class="eyebrow">Concept 04 · Demonstration data</span><h1>Open Source Metro</h1>
<p class="lede">Repositories become stations. Five event types have dedicated services. Trains replay the recorded event sequence on each service. Tracks imply <strong>shared event types only</strong>, never dependencies between repositories.</p>
<div class="controls"><label for="style">Visual language<select id="style"><option value="modern">Contemporary metro</option><option value="vintage">Vintage diagram</option></select></label><label for="scheme">Colour scheme<select id="scheme"><option value="dark">Night</option><option value="light">Day</option></select></label><label for="motion">Motion<select id="motion"><option value="animated">Animated replay</option><option value="still">Still / reduced motion</option></select></label><label for="scenario">Network<select id="scenario"><option value="normal">5 stations</option><option value="stress">17-station stress test</option></select></label></div>
<div class="figure" id="figure"><object id="map" type="image/svg+xml" data="modern-dark.svg" aria-label="Metro map generated from synthetic GitHub activity">Your browser cannot display SVG. Open the SVG file directly.</object><p class="caption" id="caption">Five synthetic repositories · hover or keyboard-focus stations for event details · playback is illustrative.</p></div>
<div class="tiles"><div class="tile"><strong>Routes are factual categories</strong><span>Commit, opened PR, merged PR, opened issue and release services remain distinct.</span></div><div class="tile"><strong>Replays are deterministic</strong><span>Events are ordered by UTC timestamp then stable ID. Multiple events may call at the same station.</span></div><div class="tile"><strong>Profile-safe fallback</strong><span>Still SVG is available for reduced-motion and GitHub renderers that do not animate inline SVGs.</span></div></div>
<p class="lede">This is a <strong>synthetic demonstration</strong>, not a record of the profile owner's actual contributions. No GitHub token, API request, external font or remote library is required.</p>
<script>
const style=document.getElementById('style'),scheme=document.getElementById('scheme'),motion=document.getElementById('motion'),scenario=document.getElementById('scenario'),map=document.getElementById('map'),figure=document.getElementById('figure'),caption=document.getElementById('caption');
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)motion.value='still';
function sync(){const stress=scenario.value==='stress';const name=stress?'stress-'+style.value+'-'+scheme.value+'-'+(motion.value==='still'?'still':'animated')+'.svg':style.value+'-'+scheme.value+(motion.value==='still'?'-still':'')+'.svg';map.data=name;map.style.aspectRatio=stress?'1200 / 892':'1200 / 376';figure.classList.toggle('stress',stress);caption.textContent=(stress?'17-station synthetic stress scenario':'5-station shared synthetic fixture')+' · hover or keyboard-focus platforms for source-event IDs · not real GitHub contributions.';}
[style,scheme,motion,scenario].forEach(el=>el.addEventListener('change',sync));sync();
</script></main></body></html>'''
    (destination / "preview.html").write_text(markup + "\n", encoding="utf-8")


def generate(fixture: Path, destination: Path) -> list[Path]:
    snapshot = load_snapshot(fixture)
    destination.mkdir(parents=True, exist_ok=True)
    outputs = []
    stress = stress_snapshot(snapshot)
    for style in ("modern", "vintage"):
        for scheme in ("dark", "light"):
            for sample, data in (("", snapshot), ("stress-", stress)):
                for animated in (True, False):
                    end = "animated" if sample else ""
                    end = ("-" + end if end else "") if animated else "-still"
                    path = destination / f'{sample}{style}-{scheme}{end}.svg'
                    path.write_text(render(data, style=style, scheme=scheme, animated=animated), encoding="utf-8")
                    outputs.append(path)
    write_preview(destination)
    outputs.append(destination / "preview.html")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate offline Open Source Metro SVGs and browser preview")
    parser.add_argument("--input", type=Path, default=Path(__file__).resolve().parents[2] / "shared/fixtures/demo-activity.json")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "exports")
    args = parser.parse_args()
    outputs = generate(args.input, args.output)
    print(f'Generated {len(outputs)} files in {args.output}')


if __name__ == "__main__":
    main()
