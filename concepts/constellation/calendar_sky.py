"""Calendar-first GitHub Constellation; offline, deterministic, Python 3.11+.

The snapshot is *not* the full GitHub contributions API: recorded source events are
placed on their UTC calendar dates, and empty cells mean 'no event in snapshot'.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from html import escape
import json
from math import sqrt, sin, pi
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEMO = ROOT / "shared" / "fixtures" / "demo-activity.json"
KINDS = {"commit", "pr_opened", "pr_merged", "issue_opened", "release"}
REPO_COLOURS = ("#71ded3", "#f6bb6b", "#c2a3ff", "#f18fa6", "#95b8ff", "#b6d27c", "#e3b0e5")
PALETTES = {
    "night": {"bg":"#050a1b", "bg2":"#181c41", "ink":"#f6f5ff", "muted":"#a5b6d1", "hair":"#435377", "cell":"#1a2541", "cell_border":"#405474", "panel":"#101d35", "accent":"#8ff5e5", "spark":"#fff8d9", "grid":"#384b69"},
    "paper": {"bg":"#fbf7e9", "bg2":"#e8ecdf", "ink":"#23374c", "muted":"#627787", "hair":"#b8c9c6", "cell":"#e4eae1", "cell_border":"#b7c7bf", "panel":"#fcfbf4", "accent":"#1a8084", "spark":"#fffdf3", "grid":"#bdc9bc"},
}
X0, Y0, STEP_X, STEP_Y, N_COLS, N_ROWS, CELL = 298, 116, 15.1, 20.6, 53, 7, 12.8


def validated_string(value: object, name: str, max_length: int = 180) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > max_length:
        raise ValueError(f"Invalid {name}")
    return value.strip()


def github_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 500:
        raise ValueError("Invalid GitHub URL")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.hostname != "github.com" or parsed.username or parsed.password or parsed.port:
        raise ValueError("Only public https://github.com/ URLs are allowed")
    return value


def utc_timestamp(value: object) -> datetime:
    raw = validated_string(value, "UTC timestamp", 40)
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid UTC timestamp") from exc
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise ValueError("Timestamp must use UTC")
    return dt.astimezone(timezone.utc)


def normalise(payload: object) -> dict:
    if not isinstance(payload, dict) or payload.get("schema_version") != "1" or payload.get("source") not in ("demo", "github"):
        raise ValueError("Expected contract-v1 demo/github snapshot")
    generated = utc_timestamp(payload.get("generated_at"))
    user = payload.get("user")
    if not isinstance(user, dict):
        raise ValueError("Missing user")
    login = validated_string(user.get("login"), "user.login")
    github_url(user.get("url"))
    repositories, activity = payload.get("repositories"), payload.get("activity")
    if not isinstance(repositories, list) or not isinstance(activity, list) or len(repositories) > 500 or len(activity) > 10000:
        raise ValueError("Invalid/oversized repository or activity arrays")
    repos = {}
    for r in repositories:
        if not isinstance(r, dict):
            raise ValueError("Invalid repository")
        full = validated_string(r.get("full_name"), "repository.full_name")
        if full in repos or "/" not in full:
            raise ValueError("Duplicate/invalid repository name")
        stars = r.get("stars", 0)
        if type(stars) is not int or not (0 <= stars <= 100000000):
            raise ValueError("Invalid stars metadata")
        repos[full] = {"full_name":full, "name":validated_string(r.get("name",full.split('/')[-1]),"repository.name"), "language":validated_string(r.get("language") or "Unspecified","repository.language"), "url":github_url(r.get("url")), "stars":stars}
    seen = {}
    for e in activity:
        if not isinstance(e, dict):
            raise ValueError("Invalid event")
        event_id = validated_string(e.get("id"), "event.id")
        if event_id in seen:
            continue
        kind = e.get("kind")
        full = validated_string(e.get("repo_full_name"), "event.repo_full_name")
        count = e.get("count", 1)
        when = utc_timestamp(e.get("occurred_at"))
        if kind not in KINDS or full not in repos or type(count) is not int or not (1 <= count <= 1000000) or when > generated:
            raise ValueError("Invalid event kind/repository/count or timestamp after snapshot")
        seen[event_id] = {"id":event_id,"kind":kind,"repo_full_name":full,"count":count,"when":when,"url":github_url(e.get("url"))}
    events = sorted(seen.values(), key=lambda e: (e["when"],e["id"]))
    return {"source":payload["source"],"generated":generated,"login":login,"repos":repos,"events":events}


def calendar_span(generated: datetime) -> tuple[date, date]:
    # 53 Sunday-first weeks. Future cells of the current week are explicitly marked.
    current_sunday = generated.date() - timedelta(days=(generated.weekday() + 1) % 7)
    start = current_sunday - timedelta(weeks=52)
    return start, start + timedelta(days=N_COLS * N_ROWS - 1)


def activity_calendar(model: dict) -> dict:
    start, end = calendar_span(model["generated"])
    daily = defaultdict(list)
    for e in model["events"]:
        if start <= e["when"].date() <= model["generated"].date():
            daily[e["when"].date()].append(e)
    repo_counts = Counter()
    for e in model["events"]:
        if e["when"].date() in daily:
            repo_counts[e["repo_full_name"]] += e["count"]
    # Colours stable by alphabetic full name, independent of activity/popularity.
    names = sorted({e["repo_full_name"] for entries in daily.values() for e in entries})
    colour = {name:REPO_COLOURS[i % len(REPO_COLOURS)] for i,name in enumerate(names)}
    return {"start":start,"end":end,"days":daily,"repo_counts":repo_counts,"colours":colour}


def xy(day: date, start: date) -> tuple[float, float, int, int]:
    diff = (day - start).days
    col, row = divmod(diff, N_ROWS)
    return (X0 + col*STEP_X, Y0 + row*STEP_Y, col, row)


def intensity(units: int) -> int:
    return 0 if units <= 0 else 1 if units == 1 else 2 if units <= 3 else 3 if units <= 6 else 4


def e(value: object) -> str:
    return escape(str(value), quote=True)


def short(value: str, limit: int = 15) -> str:
    return value if len(value) <= limit else value[:limit-1] + '…'


def render(model: dict, layout: str = 'atlas', theme: str = 'night', *, animated: bool = True) -> str:
    if layout not in ('atlas','trails') or theme not in PALETTES:
        raise ValueError('Unsupported calendar layout/theme')
    p = PALETTES[theme]
    cal = activity_calendar(model)
    start, end, daily = cal['start'],cal['end'],cal['days']
    active_days = sorted(daily)
    in_view_events = [ev for day in active_days for ev in daily[day]]
    # Static derived fill levels deliberately use only provided source activity.
    bins = {1:('#356480' if theme=='night' else '#b5dfd6'),2:('#358a9f' if theme=='night' else '#81c5bf'),3:('#32b8c3' if theme=='night' else '#40a5a3'),4:('#94f1de' if theme=='night' else '#198587')}
    label = 'SYNTHETIC DEMO · NOT REAL CONTRIBUTIONS' if model['source']=='demo' else 'PUBLIC SNAPSHOT · NOT FULL GITHUB CONTRIBUTIONS'
    intro = f'{"Synthetic demo" if model["source"]=="demo" else "Public event snapshot"} for {model["login"]}; calendar shows 53 weeks, with {len(active_days)} days containing {len(in_view_events)} sourced events. Empty cells mean no recorded event, not a verified zero. Connected dates belong to the same repository.'
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 425" width="1200" height="425" role="img" aria-labelledby="sky-title sky-desc" data-source="{model["source"]}" data-layout="{layout}" data-theme="{theme}" data-weeks="53" data-days="371" data-active-days="{len(active_days)}" data-events="{len(in_view_events)}">',
        f'<title id="sky-title">Activity Constellation · {e(layout)} · {e(theme)}</title>',
        f'<desc id="sky-desc">{e(intro)}</desc>',
        '<defs>',f'<linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{p["bg"]}"/><stop offset=".57" stop-color="{p["bg2"]}"/><stop offset="1" stop-color="{p["bg"]}"/></linearGradient>',
        f'<radialGradient id="halo"><stop stop-color="{p["accent"]}" stop-opacity=".68"/><stop offset=".34" stop-color="{p["accent"]}" stop-opacity=".24"/><stop offset="1" stop-color="{p["accent"]}" stop-opacity="0"/></radialGradient>',
        '<radialGradient id="aurora-violet"><stop stop-color="#8c6af7" stop-opacity=".62"/><stop offset=".52" stop-color="#6258e3" stop-opacity=".22"/><stop offset="1" stop-color="#33359a" stop-opacity="0"/></radialGradient>',
        '<radialGradient id="aurora-teal"><stop stop-color="#1ccfbf" stop-opacity=".53"/><stop offset=".58" stop-color="#1a9eaa" stop-opacity=".15"/><stop offset="1" stop-color="#1a9eaa" stop-opacity="0"/></radialGradient>',
        '<radialGradient id="aurora-amber"><stop stop-color="#ffc589" stop-opacity=".40"/><stop offset="1" stop-color="#ffc589" stop-opacity="0"/></radialGradient>',
        '<linearGradient id="wave" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#849ffa" stop-opacity="0"/><stop offset=".3" stop-color="#74f3e2" stop-opacity=".45"/><stop offset=".65" stop-color="#9a83ff" stop-opacity=".25"/><stop offset="1" stop-color="#fcd2a1" stop-opacity="0"/></linearGradient>',
        '<filter id="light-glow" x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="3.5"/></filter>',
        '<style><![CDATA[',
        'text{font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",sans-serif} .day-link{cursor:pointer}.day-link:hover .cell-frame,.day-link:focus .cell-frame{stroke-width:2.5;stroke-opacity:1}.echo{opacity:0;animation:pulse 16s ease-out infinite;transform-box:fill-box;transform-origin:center}.flicker{animation:twinkle 6s ease-in-out infinite}.nebula-breath{animation:breath 16s ease-in-out infinite}.data-trail{animation:trail-light 16s ease-in-out infinite}@keyframes pulse{0%,8%,100%{opacity:0;transform:scale(.65)}11%{opacity:.95;transform:scale(1.2)}19%{opacity:0;transform:scale(3.1)}}@keyframes twinkle{0%,100%{opacity:.84}50%{opacity:1}}@keyframes breath{0%,100%{opacity:.8}50%{opacity:1}}@keyframes trail-light{0%,100%{stroke-opacity:.48}50%{stroke-opacity:.82}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}.tracer{display:none!important}}',
        ']]></style></defs>',
        '<rect width="1200" height="425" rx="19" fill="url(#background)"/>',
        f'<rect x="10" y="10" width="1180" height="405" rx="13" fill="none" stroke="{p["hair"]}" stroke-opacity=".75"/>',
        # Atmosphere has no stars posing as contributions. The nebula is tied to the
        # centre of mass of actual recorded days. An empty snapshot has no bloom.
        *([f'<ellipse class="nebula-breath" cx="{sum(xy(d,start)[0] for d in active_days)/len(active_days):.1f}" cy="190" rx="250" ry="170" fill="url(#aurora-violet)" opacity=".75"/>',
           f'<ellipse class="nebula-breath" cx="{sum(xy(d,start)[0] for d in active_days)/len(active_days)+60:.1f}" cy="247" rx="225" ry="116" fill="url(#aurora-teal)" opacity=".62"/>'] if theme=='night' and active_days else []),
        *([f'<ellipse cx="{sum(xy(d,start)[0] for d in active_days)/len(active_days):.1f}" cy="208" rx="305" ry="174" fill="url(#aurora-teal)" opacity=".17"/>'] if theme=='paper' and active_days else []),
        *([f'<path d="M283 {y} C478 {y-48}, 695 {y+45}, 1171 {y-11}" stroke="url(#wave)" stroke-width="{w}" opacity="{o}" fill="none"/>' for y,w,o in [(90,1,.7),(320,.7,.65)]] if theme=='night' else []),
        f'<path d="M265 32 V386" stroke="{p["hair"]}" stroke-width="1" opacity=".65"/>',
        f'<path d="M39 39 L45 53 L52 39 L45 25 Z" fill="{p["accent"]}" opacity=".95"/>',
        f'<text x="62" y="44" font-size="9" font-weight="750" letter-spacing="2.0" fill="{p["accent"]}">GITHUB / THE CELESTIAL ATLAS</text>',
        f'<text x="38" y="96" font-size="35" font-family="Georgia,serif" letter-spacing="-1.4" fill="{p["ink"]}">Constellation</text>',
        f'<text x="39" y="121" font-size="12" letter-spacing=".35" fill="{p["muted"]}">A year of code, written in light.</text>',
        f'<path d="M39 144 H236" stroke="{p["hair"]}"/>',
        f'<text x="39" y="174" font-size="10" letter-spacing="1.5" fill="{p["muted"]}">{e(short(model["login"].upper(),28))}</text>',
        f'<text x="37" y="219" font-size="47" font-weight="250" letter-spacing="-2" fill="{p["ink"]}">{len(active_days):02d}</text>',
        f'<text x="113" y="204" font-size="10" font-weight="650" letter-spacing="1.1" fill="{p["accent"]}">ILLUMINATED</text>',
        f'<text x="113" y="220" font-size="10" letter-spacing="1.1" fill="{p["muted"]}">RECORDED DAYS</text>',
        f'<text x="39" y="246" font-size="11" fill="{p["muted"]}">{len(in_view_events)} events / {sum(x["count"] for x in in_view_events)} activity units</text>',
        f'<path d="M39 261 H236" stroke="{p["hair"]}" opacity=".6"/>',
        f'<text x="39" y="282" font-size="10" fill="{p["muted"]}"><tspan fill="{p["accent"]}">01</tspan>    BRIGHT DAY / RECORDED EVENT</text>',
        f'<text x="39" y="302" font-size="10" fill="{p["muted"]}"><tspan fill="{p["accent"]}">02</tspan>    TRAIL / SAME REPOSITORY</text>',
        f'<text x="298" y="52" font-size="14" font-family="Georgia,serif" fill="{p["ink"]}">THE CONTRIBUTION SKY</text>',
        f'<text x="1102" y="53" text-anchor="end" font-size="10" letter-spacing="1" fill="{p["muted"]}">53 WEEKS / SEVEN DAYS / UTC</text>',
    ]
    if theme=='night':
        # These tiny pinpricks are explicitly atmospheric dust and never appear
        # inside any calendar cell or in its data-date metadata.
        for i in range(115):
            h=sha256(f'constellation-sky-background-{i}'.encode()).digest()
            x=299+h[0]/255*800; y=58+h[1]/255*255
            r=.3+(h[2]/255)*.78
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="{p["accent"]}" opacity="{.05+h[3]/255*.18:.2f}"/>')
    else:
        for week in range(N_COLS):
            if week%4==0:
                x=X0+week*STEP_X-3
                parts.append(f'<path d="M{x:.1f} 106 V265" stroke="{p["grid"]}" opacity=".26"/>')
    # Month headings: first week whose Sunday-first span intersects month start.
    months = set()
    for col in range(N_COLS):
        sunday=start+timedelta(days=col*7)
        for d in (sunday+timedelta(days=i) for i in range(7)):
            key=(d.year,d.month)
            if key not in months and d.day <= 7:
                months.add(key)
                if col < 51:
                    x=X0+col*STEP_X
                    parts.append(f'<text x="{x:.1f}" y="96" font-size="10" font-weight="500" fill="{p["muted"]}">{e(d.strftime("%b"))}</text>')
    for row,label_day in ((1,'Mon'),(3,'Wed'),(5,'Fri')):
        parts.append(f'<text x="287" y="{Y0+row*STEP_Y+9:.1f}" font-size="10" text-anchor="end" fill="{p["muted"]}">{label_day}</text>')
    # Paths follow consecutive dated events *in the same repository* only.
    by_repo=defaultdict(set)
    for day,entries in daily.items():
        for ev in entries:by_repo[ev['repo_full_name']].add(day)
    connections=[]
    for repo in sorted(by_repo):
        days=sorted(by_repo[repo])
        for a,b in zip(days,days[1:]):
            x1,y1,_,_=xy(a,start);x2,y2,_,_=xy(b,start)
            x1+=CELL/2;y1+=CELL/2;x2+=CELL/2;y2+=CELL/2
            if layout=='atlas':
                midx=(x1+x2)/2; control_y=max(64, min(y1,y2)-23-abs(x2-x1)*.09)
                path=f'M{x1:.1f} {y1:.1f} Q{midx:.1f} {control_y:.1f} {x2:.1f} {y2:.1f}'
            else:
                path=f'M{x1:.1f} {y1:.1f} C{x1+max(24,(x2-x1)*.35):.1f} {y1-30:.1f} {x2-max(24,(x2-x1)*.35):.1f} {y2+30:.1f} {x2:.1f} {y2:.1f}'
            connections.append((repo,a,b,path))
    # Explicit cap prevents a dense dataset from obliterating the calendar.
    rendered_paths=connections[-100:]
    for repo,a,b,path in rendered_paths:
        colour=cal['colours'][repo]
        dash='3 5' if layout=='atlas' else '1 4'
        if theme == 'night':
            parts.append(f'<path class="trail-halo" d="{path}" fill="none" stroke="{colour}" stroke-width="7" stroke-opacity=".21" filter="url(#light-glow)"/>')
        parts.append(f'<path class="data-trail" d="{path}" fill="none" stroke="{colour}" stroke-width="{1.65 if layout=="atlas" else 2.0}" stroke-opacity="{.68 if theme=="night" else .60}" stroke-dasharray="{dash if layout=="atlas" else "none"}" stroke-linecap="round" data-relation="same-repository" data-repository="{e(repo)}"><title>{e(repo)}: {a.isoformat()} to {b.isoformat()}</title></path>')
    for col in range(N_COLS):
        for row in range(N_ROWS):
            day=start+timedelta(days=col*7+row)
            x,y,_,_=xy(day,start)
            entries=daily.get(day,[])
            future=day>model['generated'].date()
            units=sum(v['count'] for v in entries)
            tier=intensity(units)
            colour=bins[tier] if tier else p['cell']
            if future:colour=p['bg2']
            if units and theme=='night':
                parts.append(f'<circle cx="{x+CELL/2:.1f}" cy="{y+CELL/2:.1f}" r="19" fill="{cal["colours"][sorted(entries,key=lambda ev:(-ev["count"],ev["repo_full_name"]))[0]["repo_full_name"]]}" opacity=".32" filter="url(#light-glow)"/>')
            if layout=='atlas':
                parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{CELL:.1f}" height="{CELL:.1f}" rx="2.5" fill="{colour}" fill-opacity="{.82 if units else .55}" stroke="{p["cell_border"]}" stroke-width="{.85 if units else .35}" stroke-opacity="{.85 if units else .32 if not future else .15}" data-date="{day.isoformat()}" data-units="{units}" data-future="{str(future).lower()}"/>')
            else:
                # A visible 53×7 lattice persists, but uses tiny diamonds/celestial marks.
                parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{CELL:.1f}" height="{CELL:.1f}" rx="3" fill="{p["cell"]}" fill-opacity=".57" stroke="{p["cell_border"]}" stroke-opacity=".3" data-date="{day.isoformat()}" data-units="{units}" data-future="{str(future).lower()}"/>')
                if not future:
                    cx=x+CELL/2;cy=y+CELL/2
                    size=2.8 if not units else 4.0+min(2,tier*.45)
                    parts.append(f'<path d="M{cx:.1f} {cy-size:.1f} L{cx+size*.54:.1f} {cy:.1f} L{cx:.1f} {cy+size:.1f} L{cx-size*.54:.1f} {cy:.1f} Z" fill="{colour}" fill-opacity="{.42 if not units else 1}"/>')
            if entries:
                cx=x+CELL/2;cy=y+CELL/2
                primary=sorted(entries,key=lambda ev:(-ev['count'],ev['repo_full_name']))[0]
                link=primary['url'];names=sorted({v['repo_full_name'] for v in entries})
                kinds=','.join(sorted({v['kind'] for v in entries}))
                details=f'{day.isoformat()}: {len(entries)} recorded events, {units} activity units, {", ".join(names)}'
                # Focusable transparent hit target does not erase the calendar cell beneath it.
                parts.append(f'<a class="day-link" href="{e(link)}" target="_blank" rel="noopener noreferrer" tabindex="0" aria-label="{e(details)}" data-day="{day.isoformat()}" data-units="{units}" data-repos="{e(", ".join(names))}" data-repo-ids="{e(json.dumps(names,ensure_ascii=True))}" data-kinds="{e(kinds)}" data-detail="{e(details)}">')
                if layout=='atlas':
                    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{2.7+min(2.0,sqrt(units)*.8):.1f}" fill="{cal["colours"][primary["repo_full_name"]]}"/>')
                    parts.append(f'<path d="M{cx:.1f} {cy-4.5:.1f} V{cy+4.5:.1f} M{cx-4.5:.1f} {cy:.1f} H{cx+4.5:.1f}" stroke="{p["spark"]}" stroke-width=".7" stroke-opacity=".9"/>')
                else:
                    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5.6" fill="{cal["colours"][primary["repo_full_name"]]}" fill-opacity=".95"/>')
                    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="1.8" fill="{p["spark"]}"/>')
                parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{10+tier*.9:.1f}" fill="none" stroke="{cal["colours"][primary["repo_full_name"]]}" stroke-opacity="{.48 if theme=="night" else .52}" stroke-width=".8" stroke-dasharray="1.5 4.5"/>')
                parts.append(f'<path d="M{cx-10:.1f} {cy:.1f} H{cx-6.5:.1f} M{cx+6.5:.1f} {cy:.1f} H{cx+10:.1f} M{cx:.1f} {cy-10:.1f} V{cy-6.5:.1f} M{cx:.1f} {cy+6.5:.1f} V{cy+10:.1f}" stroke="{cal["colours"][primary["repo_full_name"]]}" stroke-width=".9" opacity=".88"/>')
                parts.append(f'<rect class="cell-frame" x="{x-.6:.1f}" y="{y-.6:.1f}" width="{CELL+1.2:.1f}" height="{CELL+1.2:.1f}" rx="3" fill="transparent" stroke="{p["spark"]}" stroke-opacity=".25"/>')
                parts.append(f'<title>{e(details)}</title></a>')
    if animated and in_view_events:
        latest=in_view_events[-150:]
        for idx,ev in enumerate(latest):
            day=ev['when'].date();x,y,_,_=xy(day,start);cx=x+CELL/2;cy=y+CELL/2
            # Delays are fixed to snapshot ordering; no wall-clock animation dependency.
            offset=-16*(idx/len(latest))
            parts.append(f'<circle class="echo" cx="{cx:.1f}" cy="{cy:.1f}" r="{5+min(4,sqrt(ev["count"])*1.3):.1f}" fill="none" stroke="{cal["colours"][ev["repo_full_name"]]}" stroke-width="1.3" style="animation-delay:{offset:.3f}s" data-event="{e(ev["id"])}"><title>{e(ev["kind"])} · {ev["count"]} units</title></circle>')
        for idx,(repo,a,b,path) in enumerate(rendered_paths[-35:]):
            offset=.03+.9*idx/max(1,min(35,len(rendered_paths)))
            finish=min(.985,offset+.045)
            parts.append(f'<circle class="tracer" r="2.4" fill="{cal["colours"][repo]}" opacity="0"><animateMotion path="{path}" dur="16s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;{offset:.3f};{finish:.3f};1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;{offset:.3f};{(offset+finish)/2:.3f};{finish:.3f};1"/></circle>')
    # Small but semantic repository star index. Display at most five, explicitly named.
    if cal['colours']:
        latest = max(daily)
        latest_entry = sorted(daily[latest],key=lambda ev:(-ev['count'],ev['repo_full_name']))[0]
        parts.append(f'<text x="298" y="271" font-size="10" font-weight="700" letter-spacing="1.2" fill="{p["accent"]}">REPOSITORY SIGNATURES / {min(5,len(cal["colours"]))} OF {len(cal["colours"])}</text>')
        parts.append(f'<text x="1156" y="270" text-anchor="end" font-size="10" fill="{p["muted"]}">LATEST SIGNAL  /  {e(latest.strftime("%d %b %Y").upper())}</text>')
        for i,name in enumerate(sorted(cal['colours'])[:5]):
            x=300+(i%5)*158;y=289
            parts.append(f'<circle cx="{x:.1f}" cy="{y-4}" r="6.4" fill="{cal["colours"][name]}" opacity=".24"/>')
            parts.append(f'<circle cx="{x:.1f}" cy="{y-4}" r="3.8" fill="{cal["colours"][name]}"/>')
            parts.append(f'<text x="{x+10:.1f}" y="{y:.1f}" font-size="10.5" fill="{p["ink"]}">{e(short(name.split("/")[-1],16))}</text>')
    else:
        parts.append(f'<text x="690" y="288" text-anchor="middle" font-size="12" fill="{p["muted"]}">No recorded activity in this snapshot window</text>')
    # Magnified, capped same-data view: one glyph per repository/date, even if
    # that date contains many events. No extra or inferred contribution days.
    if in_view_events:
        grouped=defaultdict(list)
        for event in in_view_events:
            grouped[(event['when'].date(),event['repo_full_name'])].append(event)
        all_signals=sorted(grouped)
        shown=all_signals[-80:]
        # Rank by source-backed units; never silently lose dense-lens repositories.
        repo_total=Counter()
        for day,name in shown:
            repo_total[name]+=sum(event['count'] for event in grouped[(day,name)])
        lens_names=sorted(repo_total,key=lambda name:(-repo_total[name],name))[:7]
        visible_signals=[(day,name) for day,name in shown if name in lens_names]
        lo,hi=shown[0][0],shown[-1][0]
        span=max(1,(hi-lo).days)
        lanes={name:328 + j*10.7 for j,name in enumerate(lens_names)}
        def lens_x(day):return 325+(day-lo).days/span*825
        parts.append(f'<path d="M287 305 H1168" stroke="{p["hair"]}" stroke-opacity=".55"/>')
        notice=f'LAST {len(shown)}/{len(all_signals)} REPO-DAYS' if len(shown)<len(all_signals) else 'SOURCE-BACKED REPO-DAYS'
        parts.append(f'<text x="298" y="318" font-size="10" font-weight="700" letter-spacing="1.0" fill="{p["accent"]}">THE SIGNAL LENS  /  {notice}</text>')
        omission=f' · {len(repo_total)-len(lens_names)} REPOS HIDDEN' if len(repo_total)>len(lens_names) else ''
        parts.append(f'<text x="1155" y="318" text-anchor="end" font-size="10" fill="{p["muted"]}">{e(lo.strftime("%d %b %Y").upper())} — {e(hi.strftime("%d %b %Y").upper())}{omission}</text>')
        for j,name in enumerate(lens_names):
            y=lanes[name];colour=cal['colours'][name]
            parts.append(f'<path d="M300 {y:.1f} H1156" stroke="{p["hair"]}" stroke-opacity=".17" stroke-width=".7"/>')
            parts.append(f'<circle cx="301" cy="{y:.1f}" r="2.3" fill="{colour}"/>')
            days=[day for day,repo in visible_signals if repo==name]
            for before,after in zip(days,days[1:]):
                x1,x2=lens_x(before),lens_x(after)
                bend=-11 if j%2==0 else 10
                path=f'M{x1:.1f} {y:.1f} Q{(x1+x2)/2:.1f} {y+bend:.1f} {x2:.1f} {y:.1f}'
                if theme=='night':parts.append(f'<path class="trail-halo" data-repository="{e(name)}" d="{path}" fill="none" stroke="{colour}" stroke-width="5" stroke-opacity=".2" filter="url(#light-glow)"/>')
                parts.append(f'<path class="data-trail" data-repository="{e(name)}" d="{path}" fill="none" stroke="{colour}" stroke-opacity=".67" stroke-width="1.5"/>')
            for day in days:
                entries=grouped[(day,name)];units=sum(ev['count'] for ev in entries)
                kinds=', '.join(sorted({ev['kind'] for ev in entries}))
                x=lens_x(day);size=2.8+min(2.4,sqrt(units)*.7)
                details=f'{len(entries)} recorded events / {units} activity units'
                link=entries[0]['url']
                parts.append(f'<a class="lens-link" href="{e(link)}" target="_blank" rel="noopener noreferrer" tabindex="0" aria-label="{day.isoformat()}: {e(name)} {e(details)}" data-day="{day.isoformat()}" data-units="{units}" data-repos="{e(name)}" data-repo-ids="{e(json.dumps([name],ensure_ascii=True))}" data-kinds="{e(kinds)}" data-detail="{e(name)}: {e(details)}">')
                if theme=='night':parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="{colour}" opacity=".26" filter="url(#light-glow)"/>')
                parts.append(f'<circle class="lens-core" cx="{x:.1f}" cy="{y:.1f}" r="{size:.1f}" fill="{colour}" stroke="{p["spark"]}" stroke-width=".7"/>')
                parts.append(f'<path d="M{x-6:.1f} {y:.1f} H{x+6:.1f} M{x:.1f} {y-6:.1f} V{y+6:.1f}" stroke="{p["spark"]}" stroke-width=".6" opacity=".78"/>')
                parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="transparent"/>')
                parts.append(f'<title>{e(name)} · {day.isoformat()} · {e(kinds)} · {e(details)}</title></a>')
    else:
        parts.append(f'<text x="298" y="340" font-size="12" fill="{p["muted"]}">No recorded activity in the signal lens</text>')
    parts += [
        f'<text x="39" y="349" font-size="10" font-weight="700" letter-spacing="1.0" fill="{p["accent"]}">NO INFERRED DAYS</text>',
        f'<text x="39" y="370" font-size="10" fill="{p["muted"]}">Only sourced dates glow.</text>',
        f'<path d="M30 390 H1170" stroke="{p["hair"]}" opacity=".75"/>',
        f'<text x="39" y="410" font-size="10" font-weight="700" letter-spacing=".8" fill="{p["accent"]}">{e(label)}</text>',
        f'<text x="1157" y="410" text-anchor="end" font-size="10" fill="{p["muted"]}">{e(layout.upper())} · 53 × 7 · {e(start.isoformat())} → {e(end.isoformat())} · empty ≠ verified zero</text>',
        '</svg>']
    return '\n'.join(parts)+'\n'


def build(input_file: Path=DEMO, output: Path=HERE/'assets') -> list[Path]:
    model=normalise(json.loads(input_file.read_text(encoding='utf-8')))
    output.mkdir(parents=True,exist_ok=True)
    results=[]
    for layout in ('atlas','trails'):
        for theme in ('night','paper'):
            for animated,label in ((True,'animated'),(False,'still')):
                filename=output/f'calendar-{layout}-{theme}-{label}.svg'
                filename.write_text(render(model,layout,theme,animated=animated),encoding='utf-8')
                results.append(filename)
    return results


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Render data-backed, 53-week GitHub Constellation')
    parser.add_argument('--input',type=Path,default=DEMO)
    parser.add_argument('--out',type=Path,default=HERE/'assets')
    args=parser.parse_args()
    for asset in build(args.input,args.out):print(asset)