"""Calendar-first Open Source Metro.

The 53 x 7 lattice is an event calendar, *not* a complete GitHub Contributions
API graph. Every filled day, station marker and service route is justified by a
normalised source event. There is no external data access.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

SERVICES = (
    ("commit", "CODE", "Commit activity"),
    ("pr_opened", "PROPOSE", "Pull requests opened"),
    ("pr_merged", "MERGE", "Pull requests merged"),
    ("issue_opened", "DISCUSS", "Issues opened"),
    ("release", "SHIP", "Releases"),
)
SERVICE_COLOURS = {
    "modern": ("#47E0BA", "#F787AD", "#B29BFA", "#FFBD6E", "#77C8FF"),
    "vintage": ("#3C8572", "#B9676E", "#80629A", "#B0853F", "#527FAD"),
}
THEMES = {
    ("modern", "dark"): dict(bg="#08111D", paper="#101D2A", panel="#111F2C", ink="#E9F4FF", muted="#97ADC2", faint="#4E6880", rule="#263B4D", empty="#1A2A38", greens=("#204E4A", "#237B68", "#2AAA84", "#4DE7B2")),
    ("modern", "light"): dict(bg="#E7F0F5", paper="#FFFFFF", panel="#F8FCFF", ink="#123245", muted="#527184", faint="#7D9BAA", rule="#D2DFE7", empty="#E5EEF3", greens=("#C2EFDA", "#88DAB5", "#47B98E", "#17845F")),
    ("vintage", "light"): dict(bg="#E9DFCB", paper="#F7EEDC", panel="#FCF5E8", ink="#3A332F", muted="#73685B", faint="#9C8C78", rule="#CDBEA7", empty="#E6DCCC", greens=("#C5D5BE", "#96BD9E", "#679980", "#3C7368")),
    ("vintage", "dark"): dict(bg="#22292A", paper="#303638", panel="#343C3B", ink="#F1E8D4", muted="#B2AC9B", faint="#878D7B", rule="#606658", empty="#404B47", greens=("#496959", "#5A8672", "#77A487", "#B0CE9E")),
}
WEEKS = 53
COLS = WEEKS
ROWS = 7
MAX_REPOS = 18
MAX_EVENTS = 240
W, H = 1320, 540
SX, SY, STEP, CELL = 119, 174, 20.25, 16.3


def utc_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError("Timestamp must be an ISO 8601 UTC string")
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid UTC timestamp") from exc
    if stamp.tzinfo is None or stamp.utcoffset() != timedelta(0):
        raise ValueError("Only UTC timestamps are supported")
    return stamp.astimezone(timezone.utc)



def safe_label(value: object, limit: int) -> bool:
    """Accept printable Unicode identifiers safe in SVG text and attributes.

    XML escaping does not make NUL, isolated UTF-16 surrogates or XML
    noncharacters valid. Reject direction-override controls as they can make
    event IDs or station names visually impersonate different identifiers.
    """
    if not isinstance(value, str) or not 1 <= len(value) <= limit:
        return False
    for char in value:
        cp = ord(char)
        if (cp < 32 or 127 <= cp <= 159 or 0xD800 <= cp <= 0xDFFF
                or 0xFDD0 <= cp <= 0xFDEF or cp & 0xFFFE == 0xFFFE
                or 0x202A <= cp <= 0x202E or 0x2066 <= cp <= 0x2069):
            return False
    return True


def safe_url(value: object) -> str | None:
    if not safe_label(value, 2048):
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() == "https" and parsed.hostname == "github.com" and not parsed.username and not parsed.password and parsed.port in (None, 443) and not parsed.path.startswith("//"):
            return value
    except ValueError:
        pass
    return None


def normalise(source: object) -> dict:
    if not isinstance(source, dict) or source.get("schema_version") != "1" or source.get("source") not in ("demo", "github"):
        raise ValueError("Expected v1 demo or github snapshot")
    generated = utc_timestamp(source.get("generated_at"))
    user = source.get("user")
    if not isinstance(user, dict) or not safe_label(user.get("login"), 120):
        raise ValueError("Missing/invalid user.login")
    if not isinstance(source.get("repositories"), list) or not isinstance(source.get("activity"), list):
        raise ValueError("Expected repository and activity lists")
    repos: dict[str, dict] = {}
    for row in source["repositories"]:
        if not isinstance(row, dict):
            raise ValueError("Invalid repository row")
        full = row.get("full_name")
        if not safe_label(full, 200) or not re.fullmatch(r"[^/\s]+/[^/\s]+", full):
            raise ValueError("Invalid repository full_name")
        if full in repos:
            raise ValueError("Duplicate repository")
        name = row.get("name", full.split("/", 1)[1])
        if not safe_label(name, 200):
            raise ValueError("Invalid repository name")
        repos[full] = {"full_name": full, "name": name, "url": safe_url(row.get("url"))}
    events, seen = [], {}
    kinds = {x[0] for x in SERVICES}
    for row in source["activity"]:
        if not isinstance(row, dict) or not safe_label(row.get("id"), 160):
            raise ValueError("Invalid event ID")
        if row.get("kind") not in kinds or row.get("repo_full_name") not in repos:
            raise ValueError("Unsupported event type or unknown repository")
        count = row.get("count", 1)
        if type(count) is not int or not 1 <= count <= 100000:
            raise ValueError("Event count must be a positive integer")
        record = {"id": row["id"], "kind": row["kind"], "repo": row["repo_full_name"],
                  "date": utc_timestamp(row.get("occurred_at")), "count": count, "url": safe_url(row.get("url"))}
        # Identical duplicates are idempotent, but a conflicting duplicate ID
        # cannot silently change the meaning of a recorded event.
        if record["id"] in seen:
            if seen[record["id"]] != record:
                raise ValueError("Conflicting source records share an event ID")
            continue
        seen[record["id"]] = record
        events.append(record)
    events.sort(key=lambda x: (x["date"], x["id"]))
    # The chronological list is sorted already. This is O(events) rather than
    # scanning the event list separately for every repository.
    first = {}
    for event in events:
        first.setdefault(event["repo"], event["date"])
    ordered = sorted(repos.values(), key=lambda x: (
        first.get(x["full_name"], datetime.max.replace(tzinfo=timezone.utc)),
        x["full_name"],
    ))
    return {"generated": generated, "source": source["source"], "user": user["login"], "repos": ordered,
            "events": events, "repo_total": len(ordered), "event_total": len(events)}


def read(path: Path) -> dict:
    return normalise(json.loads(path.read_text(encoding="utf-8")))


def demo_stress(snapshot: dict, count: int = 17) -> dict:
    """Clearly labelled synthetic scale scenario derived from the shared demo fixture."""
    if snapshot["source"] != "demo" or not snapshot["repos"] or not 1 <= count <= MAX_REPOS:
        raise ValueError("Stress extension requires 1-18 demo stations")
    repos, events = [], []
    for i in range(count):
        original = snapshot["repos"][i % len(snapshot["repos"])]
        full = f'demo-network/{original["name"]}-{i+1:02d}'
        repos.append({"full_name": full, "name": f'{original["name"]}-{i+1:02d}'})
        for j, event in enumerate([x for x in snapshot["events"] if x["repo"] == original["full_name"]][:2]):
            events.append({"id": f'scale-{i+1:02d}-{j+1}', "repo_full_name": full, "kind": event["kind"],
                           "count": event["count"], "occurred_at": event["date"].isoformat()})
    return normalise({"schema_version": "1", "source": "demo", "generated_at": snapshot["generated"].isoformat(),
                      "user": {"login": "synthetic-scale"}, "repositories": repos, "activity": events})


def plan(snapshot: dict) -> dict:
    # Alignment follows GitHub's Sun-Sat contribution-calendar convention.
    today = snapshot["generated"].date()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    start = sunday - timedelta(weeks=WEEKS - 1)
    # Select stations with events in the displayed period before inactive ones.
    # A historical repository must not displace a recently active station merely
    # because it had an event years before this calendar window.
    eligible = [x for x in snapshot["events"]
                if start <= x["date"].date() <= today and x["date"] <= snapshot["generated"]]
    first_visible = {}
    for event in eligible:
        first_visible.setdefault(event["repo"], event["date"])
    # When capped, retain the repositories with the most recorded events in
    # the displayed period, then preserve the familiar first-visit station order.
    # Counts of unlike event types are NOT treated as commits or used as weights.
    eligible_count = Counter(event["repo"] for event in eligible)
    if len(snapshot["repos"]) > MAX_REPOS:
        candidates = sorted(snapshot["repos"], key=lambda r: (
            -eligible_count[r["full_name"]],
            first_visible.get(r["full_name"], datetime.max.replace(tzinfo=timezone.utc)),
            r["full_name"],
        ))[:MAX_REPOS]
    else:
        candidates = snapshot["repos"]
    repo_list = sorted(candidates, key=lambda r: (
        r["full_name"] not in first_visible,
        first_visible.get(r["full_name"], datetime.max.replace(tzinfo=timezone.utc)),
        r["full_name"],
    ))
    repo_names = {r["full_name"] for r in repo_list}
    # Retain recent source events if this snapshot exceeds the display cap.
    # Filtering by an exact instant also excludes events later on the snapshot day.
    selected = [x for x in eligible if x["repo"] in repo_names]
    visible = selected[-MAX_EVENTS:]
    by_day = defaultdict(list)
    for ev in visible:
        by_day[ev["date"].date()].append(ev)
    dates = [start + timedelta(days=i) for i in range(WEEKS * 7)]
    idx = {d: divmod(i, 7) for i, d in enumerate(dates)}
    # Source events after snapshot generation are never plotted as observed.
    return {"start": start, "end": today, "sunday": sunday, "days": dates, "positions": idx, "repos": repo_list,
            "events": visible, "by_day": by_day, "omitted_repos": snapshot["repo_total"] - len(repo_list),
            "omitted_events": snapshot["event_total"] - len(visible)}


def s(value: object) -> str:
    return escape(str(value), quote=True)


def label(x: float, y: float, value: object, style: str = "", anchor: str = "start") -> str:
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{style}" text-anchor="{anchor}">{s(value)}</text>'


def point(position: tuple[int, int]) -> tuple[float, float]:
    week, weekday = position
    return round(SX + week * STEP + CELL / 2, 2), round(SY + weekday * STEP + CELL / 2, 2)


def segments(points: list[tuple[float, float]]) -> str:
    if not points:
        return ""
    path = f'M {points[0][0]:.2f} {points[0][1]:.2f}'
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        dx, dy = x2 - x1, y2 - y1
        if dx >= abs(dy) + 20:
            first = x1 + max(14, (dx - abs(dy)) / 2)
            diagonal = first + abs(dy)
            path += f' H {first:.2f} L {diagonal:.2f} {y2:.2f} H {x2:.2f}'
        elif x1 == x2:
            path += f' V {y2:.2f}'
        else:
            # 90-degree corner when dates lie very close to each other.
            path += f' H {x2:.2f} V {y2:.2f}'
    return path


def density(units: int) -> int:
    return 0 if units == 0 else (1 if units <= 2 else 2 if units <= 4 else 3 if units <= 7 else 4)


def render(snapshot: dict, *, style: str = "modern", scheme: str = "dark", animated: bool = False, browser_links: bool = False) -> str:
    if (style, scheme) not in THEMES:
        raise ValueError("Unknown style or scheme")
    p = plan(snapshot)
    t = THEMES[style, scheme]
    colours = SERVICE_COLOURS[style]
    vintage = style == "vintage"
    demo = snapshot["source"] == "demo"
    events_by_kind = {kind: [ev for ev in p["events"] if ev["kind"] == kind] for kind, _, _ in SERVICES}
    n = len(p["repos"])
    repo_code = {repo["full_name"]: i + 1 for i, repo in enumerate(p["repos"])}
    two_row = n > 9
    height = H + (55 if two_row else 0)
    f = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {height}" width="{W}" height="{height}" role="img" aria-labelledby="title description">',
         f'<title id="title">Open Source Metro, {style} {scheme}: annual contribution-calendar-inspired event map</title>',
         f'<desc id="description">{"Synthetic demo" if demo else "Public GitHub snapshot"}. A fifty-three-week, seven-day contribution-style grid displays ONLY source-observed event units, not a complete GitHub contributions history. Five coloured metro services trace recorded event types in chronological UTC order. Repo station names appear below the map.</desc>',
         '<defs><style><![CDATA[',
         f'.mast{{font:800 35px {"Georgia,serif" if vintage else "system-ui,Segoe UI,sans-serif"};fill:{t["ink"]};letter-spacing:-.8px}}',
         f'.sub{{font:600 11px system-ui,sans-serif;fill:{t["muted"]};letter-spacing:1px}}',
         f'.micro{{font:700 9px system-ui,sans-serif;fill:{t["muted"]};letter-spacing:.6px}}',
         f'.month{{font:700 11px system-ui,sans-serif;fill:{t["muted"]}}}',
         f'.name{{font:700 13px {"Georgia,serif" if vintage else "system-ui,sans-serif"};fill:{t["ink"]}}}',
         f'.detail{{font:500 11px system-ui,sans-serif;fill:{t["muted"]}}}',
         '.day:focus .focus{stroke-width:3;opacity:1}.day:focus{outline:none}',
         '@media(prefers-reduced-motion:reduce){.train,.pulse{display:none!important}}',
         ']]></style></defs>',
         f'<rect width="{W}" height="{height}" fill="{t["bg"]}"/>',
         f'<rect x="18" y="16" width="1284" height="{height-32}" rx="{9 if vintage else 23}" fill="{t["paper"]}" stroke="{t["rule"]}" stroke-width="{2 if vintage else 1}"/>']
    if vintage:
        f += [f'<rect x="28" y="26" width="1264" height="{height-52}" rx="3" fill="none" stroke="{t["rule"]}" stroke-width="1.1"/>',
              f'<path d="M43 111H1277 M43 {height-52}H1277" stroke="{t["rule"]}" stroke-width="2"/>',
              f'<text x="1230" y="64" font-size="29" font-family="Georgia,serif" fill="{t["muted"]}" text-anchor="end" opacity=".3">M</text>']
    else:
        f += [f'<path d="M49 49V97" stroke="{colours[0]}" stroke-width="6" stroke-linecap="round"/>',
              f'<circle cx="1255" cy="65" r="18" fill="none" stroke="{colours[0]}" stroke-width="2"/><circle cx="1255" cy="65" r="6" fill="{colours[0]}"/>']
    f += [label(67, 69, "OPEN SOURCE METRO", "mast"),
          label(69, 89, "A CONTRIBUTION CALENDAR REIMAGINED AS A TRANSIT NETWORK", "sub"),
          label(1174, 54, "SYNTHETIC DEMONSTRATION" if demo else "SUPPLIED PUBLIC EVENTS", "micro", "end"),
          label(1174, 75, f'{len(p["events"])} observed events   /   {n} repository stations', "detail", "end"),
          f'<rect x="77" y="117" width="1167" height="256" rx="{5 if vintage else 13}" fill="{t["panel"]}" stroke="{t["rule"]}" stroke-width="1.2"/>',
          label(100, 137, "53-WEEK EVENT CALENDAR", "micro"),
          label(1219, 137, "UTC  •  SUN → SAT  •  SNAPSHOT EVENTS ONLY", "micro", "end")]
    # Month labels use the first Sunday-aligned column where a month begins.
    prior = None
    for week in range(WEEKS):
        for row in range(7):
            d = p["days"][week * 7 + row]
            if d > p["end"]:
                break
            if prior != (d.year, d.month):
                if week > 0 or row == 0:
                    f.append(label(SX + week * STEP, SY - 15, d.strftime('%b').upper(), "month"))
                prior = (d.year, d.month)
    for i, text in ((1,"Mon"),(3,"Wed"),(5,"Fri")):
        f.append(label(105, SY + i * STEP + 11, text, "micro", "end"))
    # Stable rails: segments pass BEHIND the contribution squares, so the weekly
    # grid remains the dominant graphical structure rather than a separate map.
    for kind_index, (kind, code, desc) in enumerate(SERVICES):
        events = events_by_kind[kind]
        if not events:
            continue
        route = []
        for ev in events:
            xy = point(p["positions"][ev["date"].date()])
            if not route or xy != route[-1]:
                route.append(xy)
        path = segments(route)
        colour = colours[kind_index]
        f.append(f'<g class="line-{kind}"><title>{s(desc)} service; {len(events)} recorded events</title>')
        if len(route) > 1:
            f.append(f'<path d="{path}" fill="none" stroke="{t["paper"]}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>')
            f.append(f'<path d="{path}" fill="none" stroke="{colour}" stroke-width="{3.3 if vintage else 3.9}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>')
            if vintage:
                f.append(f'<path d="{path}" fill="none" stroke="{t["paper"]}" stroke-width=".75" stroke-dasharray="2 3" opacity=".65"/>')
            if animated:
                duration = max(16, len(route) * 3.2)
                f.append(f'<g class="train" aria-hidden="true"><circle r="6.5" fill="{colour}" stroke="{t["ink"]}" stroke-width="1.4"/><circle r="2" fill="{t["paper"]}"/><animateMotion dur="{duration:.1f}s" repeatCount="indefinite" path="{path}"/></g>')
        f.append('</g>')
    # Core square lattice. Blank squares represent unavailable observations,
    # NEVER a verified zero contribution count for the owner's GitHub profile.
    for date_value in p["days"]:
        if date_value > p["end"]:
            continue  # no future cells
        week, weekday = p["positions"][date_value]
        x, y = SX + week * STEP, SY + weekday * STEP
        events = p["by_day"].get(date_value, [])
        total = sum(e["count"] for e in events)
        level = density(total)
        fill = t["greens"][level - 1] if level else t["empty"]
        if vintage and not level and (week + weekday) % 5 == 0:
            fill = t["panel"]  # deterministic paper halftone; still an unobserved cell
        if not events:
            # Unobserved days carry no invented per-day source metadata, and do
            # not need a full interactive group, which keeps the SVG compact.
            f.append(f'<rect class="day-empty" data-date="{date_value.isoformat()}" x="{x:.2f}" y="{y:.2f}" width="{CELL}" height="{CELL}" rx="{1.4 if vintage else 3.4}" fill="{fill}"/>')
            continue
        tooltip = f'{date_value.isoformat()}: ' + ('; '.join(f'{ev["id"]} / {ev["repo"]} / {ev["kind"]} / {ev["count"]} source units' for ev in events) if events else 'no events in supplied snapshot; GitHub coverage not established')
        safe_date = date_value.isoformat()
        target = next((ev["url"] for ev in events if ev["url"]), None)
        linked = bool(browser_links and not demo and target)
        if linked:
            f.append(f'<a xlink:href="{s(target)}" target="_blank" rel="noopener noreferrer">')
        f.append(f'<g class="day" data-date="{safe_date}" data-units="{total}" tabindex="0" role="group" aria-label="{s(tooltip)}">')
        f.append(f'<title>{s(tooltip)}</title>')
        f.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{CELL}" height="{CELL}" rx="{1.4 if vintage else 3.4}" fill="{fill}" stroke="{t["paper"]}" stroke-width=".65"/>')
        if events:
            f.append(f'<rect class="focus" x="{x-1:.2f}" y="{y-1:.2f}" width="{CELL+2:.2f}" height="{CELL+2:.2f}" rx="{2 if vintage else 4}" fill="none" stroke="{t["ink"]}" stroke-width="1.6" opacity=".4"/>')
            # Active calendar days are metro platforms. The tiny roundel number
            # refers directly to a repository in the station directory. A day
            # shared by several repos is represented as an interchange.
            repo_set = {ev["repo"] for ev in events}
            kinds = sorted({ev["kind"] for ev in events}, key=lambda k: [z[0] for z in SERVICES].index(k))
            centre_x, centre_y = x + CELL / 2, y + CELL / 2
            if len(repo_set) == 1:
                code = repo_code[next(iter(repo_set))]
                colour = colours[[z[0] for z in SERVICES].index(events[0]["kind"])]
                f.append(f'<circle cx="{centre_x:.2f}" cy="{centre_y:.2f}" r="7" fill="{t["paper"]}" stroke="{colour}" stroke-width="1.25"/>')
                f.append(f'<text x="{centre_x:.2f}" y="{centre_y+2.4:.2f}" text-anchor="middle" fill="{t["ink"]}" font-family="system-ui,sans-serif" font-size="6.6" font-weight="800">{code:02d}</text>')
            else:
                # An interchange is a dated calendar cell shared by multiple
                # repositories, NOT evidence of a dependency between them.
                f.append(f'<circle cx="{centre_x:.2f}" cy="{centre_y:.2f}" r="6.4" fill="{t["paper"]}" stroke="{colours[0]}" stroke-width="1.25"/>')
                f.append(f'<text x="{centre_x:.2f}" y="{centre_y+2.1:.2f}" text-anchor="middle" fill="{t["ink"]}" font-family="system-ui,sans-serif" font-size="7" font-weight="800">{len(repo_set)}</text>')
            # All five source event types must remain visible at an interchange.
            # Fit five narrow service stripes inside the original 16.3px cell.
            for k, kind in enumerate(kinds):
                index = [z[0] for z in SERVICES].index(kind)
                f.append(f'<rect x="{x+1.05+k*3.1:.2f}" y="{y+CELL-2.25:.2f}" width="2.5" height="1.9" fill="{colours[index]}"/>')
            if animated:
                f.append(f'<rect class="pulse" x="{x-1:.2f}" y="{y-1:.2f}" width="{CELL+2}" height="{CELL+2}" rx="3" fill="none" stroke="{colours[[z[0] for z in SERVICES].index(events[0]["kind"])]}" opacity="0" aria-hidden="true"><animate attributeName="opacity" values="0;0.9;0" dur="1.4s" begin="{(week % 8)*.35:.2f}s" repeatCount="indefinite"/></rect>')
        f.append('</g>')
        if linked:
            f.append('</a>')
    # A second key belongs to the calendar, distinct from the metro-services key.
    f.append(label(99, 333, "CALENDAR = OBSERVED SOURCE UNITS  /  BLANK ≠ VERIFIED ZERO", "micro"))
    f.append(label(1069, 333, "LESS", "micro", "end"))
    for i in range(5):
        f.append(f'<rect x="{1078+i*23}" y="324" width="13" height="13" rx="{1 if vintage else 3}" fill="{t["empty"] if i==0 else t["greens"][i-1]}"/>')
    f.append(label(1212, 334, "MORE", "micro", "end"))
    f.append(f'<path d="M92 342H1228" stroke="{t["rule"]}" stroke-width="1"/>')
    # Five explicit event categories, styled as a real metro legend.
    for i, (_, code, _) in enumerate(SERVICES):
        x = 108 + i * 230
        fill = colours[i]
        if vintage:
            f.append(f'<rect x="{x-7}" y="351" width="14" height="14" transform="rotate(45 {x} 358)" fill="{t["paper"]}" stroke="{fill}" stroke-width="2.4"/>')
        else:
            f.append(f'<circle cx="{x}" cy="357" r="8.5" fill="{t["paper"]}" stroke="{fill}" stroke-width="3"/><circle cx="{x}" cy="357" r="2.3" fill="{fill}"/>')
        f.append(label(x+18, 361, code, "micro"))
    f += [label(91, 401, "STATION DIRECTORY  /  REPOSITORIES", "micro"),
          label(1226, 400, "MARKERS = RECORDED EVENTS   •   ROUTES = EVENT TYPES", "micro", "end")]
    per_row = 9 if n > 9 else max(1, n)
    card_gap = 6
    left, avail = 90, 1138
    card_width = (avail - card_gap * (per_row - 1)) / per_row
    by_repo = defaultdict(list)
    for ev in p["events"]:
        by_repo[ev["repo"]].append(ev)
    for i, repo in enumerate(p["repos"]):
        row, col = divmod(i, per_row)
        x = left + col * (card_width + card_gap)
        y = 412 + row * 56
        full = repo["full_name"]
        hits = by_repo[full]
        f.append(f'<g class="repository" data-repository="{s(full)}"><title>{s(full)}: {len(hits)} recorded events</title>')
        f.append(f'<rect x="{x:.2f}" y="{y}" width="{card_width:.2f}" height="48" rx="{3 if vintage else 9}" fill="{t["panel"]}" stroke="{t["rule"]}" stroke-width=".9"/>')
        if vintage:
            f.append(f'<rect x="{x+7:.2f}" y="{y+8}" width="25" height="25" rx="2" fill="{t["paper"]}" stroke="{t["muted"]}" stroke-width="1.4"/>')
        else:
            f.append(f'<circle cx="{x+20:.2f}" cy="{y+20}" r="14" fill="{t["paper"]}" stroke="{colours[i%len(colours)]}" stroke-width="2.4"/>')
        f.append(label(x+20,y+24,f'{i+1:02d}',"micro","middle"))
        limit = 23 if per_row<=5 else 11
        short = repo["name"] if len(repo["name"]) <= limit else repo["name"][:limit-1]+"…"
        f.append(label(x+42,y+20,short,"name"))
        f.append(label(x+42,y+35,f'{len(hits)} events  ·  {sum(ev["count"] for ev in hits)} units',"detail"))
        f.append('</g>')
    bottom = height - 32
    suffix = f'OMITTED: {p["omitted_repos"]} REPOS / {p["omitted_events"]} EVENTS' if p["omitted_repos"] or p["omitted_events"] else 'ALL SUPPLIED EVENTS IN VIEW'
    f += [f'<path d="M91 {bottom-17}H1229" stroke="{t["rule"]}" stroke-width=".8"/>',
          label(93,bottom-3,'DEMO • NOT AN ACTUAL GITHUB CONTRIBUTION GRAPH' if demo else 'SUPPLIED SNAPSHOT • NOT A COMPLETE GITHUB CONTRIBUTION GRAPH',"micro"),
          label(1227,bottom-3,suffix,"micro","end"), '</svg>']
    return '\n'.join(f)+'\n'


def event_ledger(snapshot: dict | None) -> str:
    """Accessible, escaped provenance for exactly the events visible on this map."""
    if snapshot is None:
        return '<p class="small">Generate this preview from a normalised snapshot to see its source events.</p>'
    p = plan(snapshot)
    rows = []
    for event in p["events"]:
        when = event["date"].strftime("%d %b %Y %H:%M UTC")
        rows.append(
            '<tr><td><time>' + s(when) + '</time></td><td>' + s(event["id"]) +
            '</td><td>' + s(event["repo"]) + '</td><td>' + s(event["kind"]) +
            '</td><td>' + str(event["count"]) + '</td></tr>'
        )
    if not rows:
        rows.append('<tr><td colspan="5">No recorded events in the displayed calendar.</td></tr>')
    heading = f'{len(p["events"])} included source events; {p["omitted_events"]} outside the selected view'
    return (
        '<details class="ledger"><summary>' + s(heading) + '</summary>'
        '<div class="table-scroll"><table><caption>UTC event provenance from the supplied snapshot, not a complete GitHub contributions graph</caption>'
        '<thead><tr><th scope="col">UTC date</th><th scope="col">Event ID</th><th scope="col">Repository</th><th scope="col">Type</th><th scope="col">Units</th></tr></thead>'
        '<tbody>' + ''.join(rows) + '</tbody></table></div></details>'
    )


def preview_html(snapshot: dict | None = None) -> str:
    markup = '''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Source Metro | Calendar + Transit Studio</title>
<style>
:root{color-scheme:dark;background:#08111d;color:#ecf5fc;font:16px system-ui,Segoe UI,sans-serif}
*{box-sizing:border-box}body{margin:0;padding:clamp(15px,3vw,42px)}main{max-width:1450px;margin:auto}
h1{font-weight:800;letter-spacing:-.045em;font-size:clamp(2rem,4.5vw,4rem);margin:4px 0 8px}
.eyebrow{color:#48dfbc;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800}
.lede{max-width:72ch;color:#b0c2d0;line-height:1.55}
.controls{display:flex;gap:15px;flex-wrap:wrap;margin:24px 0}
label{display:grid;gap:6px;font-size:.78rem;letter-spacing:.1em;font-weight:700;text-transform:uppercase;color:#abc5d7}
select{padding:10px 15px;border-radius:8px;border:1px solid #3c5e73;background:#142b3c;color:#fff;font:600 1rem system-ui}
.figure{border:1px solid #2c4558;background:#0d1c29;border-radius:20px;padding:13px;box-shadow:0 20px 70px #0005}
object{width:100%;display:block;aspect-ratio:1320/540}
.figure.stress object{aspect-ratio:1320/595}
.map-viewport{max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scrollbar-gutter:stable;scrollbar-color:#56869a #112736;touch-action:pan-x pan-y}
.map-viewport:focus-visible{outline:2px solid #48dfbc;outline-offset:2px}
.mobile-hint{display:none}
.small{color:#acc1d0;font-size:.86rem;line-height:1.65;margin:15px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:22px 0}
.tile{background:#112736;border:1px solid #2c4558;padding:20px;border-radius:12px}
.tile b{display:block;margin-bottom:7px}.tile p{color:#afc2d0;line-height:1.5;font-size:.9rem;margin:0}
a{color:#84e9d1}

.audit{margin:22px 0;padding:18px;background:#112736;border:1px solid #2c4558;border-radius:12px}
.audit h2{font-size:1.12rem;margin:0 0 12px;letter-spacing:-.015em}
.ledger summary{cursor:pointer;font-weight:700;color:#b9e8e1;padding:7px 0}
.ledger summary:focus-visible{outline:2px solid #84e9d1;outline-offset:3px}
.table-scroll{max-width:100%;overflow-x:auto;margin-top:10px}
.audit table{border-collapse:collapse;width:100%;min-width:650px;text-align:left;font-size:.85rem;font-variant-numeric:tabular-nums}
.audit caption{font-size:.78rem;color:#acc1d0;text-align:left;padding-bottom:10px}
.audit th,.audit td{padding:9px 10px;border-bottom:1px solid #2c4558}
.audit th{color:#84e9d1}.audit td{color:#d8e8f0}
@media(max-width:700px){body{padding:12px}.figure{padding:2px}select{max-width:100%}.map-viewport object{min-width:1050px}.mobile-hint{display:block}}
</style></head><body><main>
<div class="eyebrow">Concept 04 / Synthetic demo / Offline</div><h1>Open Source Metro</h1>
<p class="lede">The GitHub-style <strong>53-week by 7-day contribution grid is the foundation</strong>. Metro services weave through actual recorded days; repository stations are indexed below. The supplied fixture is intentionally sparse. Empty days are <em>not evidence</em> of zero GitHub contributions.</p>
<div class="controls"><label for="style">Art direction<select id="style"><option value="modern">Metropolitan</option><option value="vintage">Vintage transport</option></select></label>
<label for="scheme">Canvas<select id="scheme"><option value="dark">Night</option><option value="light">Day</option></select></label>
<label for="motion">Replay<select id="motion"><option value="still">Still (GitHub-friendly)</option><option value="animated">Animated</option></select></label>
<label for="scenario">Dataset<select id="scenario"><option value="normal">Shared fixture: 5 stations</option><option value="stress">Synthetic 17-station stress test</option></select></label></div>
<div class="figure" id="figure"><div class="map-viewport" tabindex="0" role="region" aria-label="Contribution calendar metro map, scroll horizontally on small screens"><object id="map" data="modern-dark-still.svg" type="image/svg+xml" aria-label="GitHub-style contribution calendar crossed by source-backed metro routes">Open the SVG export directly if your browser does not display it.</object></div></div>
<p class="small mobile-hint">Swipe sideways to inspect the complete 53-week map. The map scrolls inside this panel, not across the whole page.</p>
<p class="small" id="caption">Illustration from the shared synthetic fixture, not the owner's actual GitHub contributions.</p>
<p class="small" id="asset-note" role="status" aria-live="polite">All alternative palettes can be generated locally with Python 3.11+. The included README SVGs work without any setup.</p>
<div class="tiles"><div class="tile"><b>The grid is the canvas</b><p>53 Sunday-to-Saturday columns, weekdays, month labels and observed-event density. No fabricated history.</p></div>
<div class="tile"><b>Transit routes are factual</b><p>Five event-type services call only at dated source events. Trains, when enabled, traverse those routes.</p></div>
<div class="tile"><b>Stations are real identifiers</b><p>Named repositories, exact event IDs and UTC dates are disclosed in calendar-cell tooltips and accessible labels.</p></div></div>
<section class="audit" aria-labelledby="events-heading"><h2 id="events-heading">Recorded source events</h2><!--EVENT_LEDGER--></section>
<p class="small">No token, external API, JavaScript library, external fonts or paid service required. Animated SVG playback in GitHub README previews is not guaranteed.</p>
<script>
const style=document.getElementById('style'),scheme=document.getElementById('scheme'),motion=document.getElementById('motion'),scenario=document.getElementById('scenario'),map=document.getElementById('map'),fig=document.getElementById('figure'),caption=document.getElementById('caption');
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)motion.value='still';
const assetNote=document.getElementById('asset-note');
const bundled=new Set(['modern-dark-still.svg','modern-dark.svg','vintage-light-still.svg','vintage-light.svg','stress-modern-dark-still.svg']);
const aliases={'modern-dark-animated.svg':'modern-dark.svg','vintage-light-animated.svg':'vintage-light.svg'};
let selection=0;
function refresh(){
  const stress=scenario.value==='stress';
  const stem=(stress?'stress-':'')+style.value+'-'+scheme.value+(motion.value==='still'?'-still':'-animated')+'.svg';
  const candidate=aliases[stem]||stem;
  const fallback=stress?'stress-modern-dark-still.svg':(style.value==='vintage'?'vintage-light-still.svg':'modern-dark-still.svg');
  const token=++selection;
  fig.classList.toggle('stress',stress);
  map.style.aspectRatio=stress?'1320/595':'1320/540';
  caption.textContent=(stress?'17-station synthetic scale scenario':'Five repositories from the shared synthetic fixture')+' / source-observed events only / not a complete GitHub contributions history.';
  if(bundled.has(candidate)){
    map.data=candidate;
    assetNote.textContent='Showing a checked-in sample export. Generate all combinations locally to explore additional themes and stress variants.';
    return;
  }
  const probe=new Image();
  probe.onload=()=>{if(token!==selection)return;map.data=candidate;assetNote.textContent='Showing the locally generated variant: '+candidate;};
  probe.onerror=()=>{if(token!==selection)return;map.data=fallback;assetNote.textContent='The selected variant has not been generated yet. Showing '+fallback+' instead. Run the Python generator to create every combination.';};
  probe.src=candidate;
}
style.addEventListener('change',()=>{scheme.value=style.value==='vintage'?'light':'dark';refresh();});
for(const select of [scheme,motion,scenario])select.addEventListener('change',refresh);
refresh();
</script></main></body></html>
'''
    return markup.replace('<!--EVENT_LEDGER-->', event_ledger(snapshot))


def generate(source: Path, destination: Path) -> list[Path]:
    snap = read(source)
    stress = demo_stress(snap) if snap["source"] == "demo" and snap["repos"] else None
    destination.mkdir(parents=True,exist_ok=True)
    outputs=[]
    for family in ("modern","vintage"):
        for scheme in ("dark","light"):
            for prefix,data in (("",snap),("stress-",stress)):
                if data is None:
                    continue
                for animated in (False,True):
                    stem=f'{prefix}{family}-{scheme}-'+('animated' if animated else 'still')
                    dest=destination/(stem+'.svg')
                    dest.write_text(render(data,style=family,scheme=scheme,animated=animated),encoding='utf-8')
                    outputs.append(dest)
    # Historic simple names remain as aliases for the original draft links.
    for family,scheme in (("modern","dark"),("vintage","light")):
        for suffix,animated in (("",True),("-still",False)):
            dest=destination/f'{family}-{scheme}{suffix}.svg'
            dest.write_text(render(snap,style=family,scheme=scheme,animated=animated),encoding='utf-8')
            outputs.append(dest)
    if stress:
        dest=destination/'stress-modern-dark-still.svg'
        dest.write_text(render(stress),encoding='utf-8')
        outputs.append(dest)
    dest=destination/'preview.html'
    dest.write_text(preview_html(snap),encoding='utf-8')
    outputs.append(dest)
    return outputs


def main() -> None:
    parser=argparse.ArgumentParser(description='Render calendar-first Open Source Metro from a normalised public snapshot')
    parser.add_argument('--input',type=Path,default=Path(__file__).resolve().parents[2]/'shared/fixtures/demo-activity.json')
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'exports')
    args=parser.parse_args()
    outputs=generate(args.input,args.output)
    print(f'Open Source Metro: wrote {len(outputs)} files to {args.output}')

if __name__=='__main__':
    main()