"""Metro Atlas: contribution-calendar-first, offline design gallery.

The activity fixture is sparse: its truthful display is retained. A separate
explicitly synthetic showcase demonstrates higher activity density without
presenting invented events as somebody's GitHub history.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from html import escape
import json
from pathlib import Path
import random
import re

SERVICE = (
    ('commit', 'CODE', '#4CE0B3'),
    ('pr_opened', 'PROPOSE', '#FF9E85'),
    ('pr_merged', 'MERGE', '#A792FD'),
    ('issue_opened', 'DISCUSS', '#FFD174'),
    ('release', 'SHIP', '#76BEFF'),
)
COLORS = {
    'midnight': dict(bg='#080E18', paper='#101C2B', tile='#142536', panel='#0B1724',
        ink='#F2F8FE', muted='#A9BED0', faint='#718DA3', line='#294255',
        blank='#1A2B3B', intensity=('#27574F','#237B63','#2BAA7F','#69E6B1')),
    'parchment': dict(bg='#E7DFCF',paper='#F9F2E4',tile='#F4ECDD',panel='#F3EADA',
        ink='#343C3A',muted='#5A635E',faint='#77796F',line='#C8BDAB',
        blank='#E5DCCA',intensity=('#C2D3BA','#95B89A','#628F74','#326F5D')),
}
KINDS = {kind: idx for idx,(kind,_,_) in enumerate(SERVICE)}
WIDTH, HEIGHT = 1440, 602
GX, GY, GAP, CELL = 170, 195, 21, 15.5


def text(x: float, y: float, content: object, klass: str = '', anchor: str = 'start') -> str:
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{klass}" text-anchor="{anchor}">{escape(str(content))}</text>'


def tint(kind: str, vintage: bool) -> str:
    if not vintage:
        return SERVICE[KINDS[kind]][2]
    return ('#34866B','#B56D56','#7F6BBA','#A57637','#467FAF')[KINDS[kind]]


def date_utc(value: str) -> datetime:
    if not isinstance(value,str) or len(value)>40:
        raise ValueError('Invalid date')
    d = datetime.fromisoformat(value.replace('Z','+00:00'))
    if not d.tzinfo or d.utcoffset() != timedelta(0):
        raise ValueError('Expected UTC timestamp')
    return d.astimezone(timezone.utc)


def validated(snapshot: dict) -> dict:
    """Reuse the canonical normaliser's safety checks when present."""
    from calendar_metro import normalise
    return normalise(snapshot)


def expand_showcase(snapshot: dict) -> dict:
    """Add deterministic, loudly labelled artificial events only for design review."""
    if snapshot.get('source') != 'demo':
        raise ValueError('Design showcase is allowed for synthetic demo data only')
    base = json.loads(json.dumps(snapshot))
    end = date_utc(base['generated_at']).date()
    rng = random.Random(9407)
    repo_names = [r['full_name'] for r in base['repositories']]
    if not repo_names:
        return base
    events = list(base['activity'])
    for offset in range(365, 0, -1):
        when = end-timedelta(days=offset)
        if rng.random() > .46:
            continue
        week = (365-offset)//7
        streak = 2 if week in (8,9,10,24,25,38,39,48) else 0
        repo = repo_names[(week//5 + offset//11 + rng.randrange(len(repo_names))) % len(repo_names)]
        kind = ('commit','commit','pr_opened','pr_merged','issue_opened','release')[rng.randrange(6)]
        units = 1 + rng.randrange(1,5) if kind=='commit' else 1
        events.append({'id':f'illustrative-{offset:03d}-a','repo_full_name':repo,
            'kind':kind,'count':units + streak if kind=='commit' else units,
            'occurred_at':when.isoformat()+'T12:00:00Z'})
        if rng.random() < .13:
            second = repo_names[(repo_names.index(repo)+2)%len(repo_names)]
            events.append({'id':f'illustrative-{offset:03d}-b',
                'repo_full_name':second, 'kind':'commit',
                'count':1+rng.randrange(3), 'occurred_at':when.isoformat()+'T14:00:00Z'})
    base['activity'] = events
    base['_showcase'] = True
    base['_illustrative_count'] = len(events)-len(snapshot['activity'])
    return base


def _route(events, points):
    seq=[]
    for ev in events:
        xy=points.get(ev['date'].date())
        if xy and (not seq or xy!=seq[-1]):
            seq.append(xy)
    if len(seq)<2:
        return ''
    out=[f'M{seq[0][0]:.1f} {seq[0][1]:.1f}']
    for (x,y),(xx,yy) in zip(seq,seq[1:]):
        if xx>x+2:
            bend=min((xx-x)/2,abs(yy-y)/2+7)
            out.extend([f'H{x+bend:.1f}',f'L{xx-bend:.1f} {yy:.1f}',f'H{xx:.1f}'])
        else:
            out.extend([f'H{xx:.1f}',f'V{yy:.1f}'])
    return ' '.join(out)


def render(data: dict, theme: str='midnight') -> str:
    if theme not in COLORS:
        raise ValueError('Unknown theme')
    snap = validated(data)
    t = COLORS[theme]
    vintage=theme=='parchment'
    today=snap['generated'].date()
    sunday=today-timedelta(days=(today.weekday()+1)%7)
    start=sunday-timedelta(weeks=52)
    dates=[start+timedelta(days=i) for i in range(371)]
    dates=[d for d in dates if d<=today]
    positions={d:(i//7,i%7) for i,d in enumerate(dates)}
    points={d:(GX+week*GAP+CELL/2,GY+day*GAP+CELL/2) for d,(week,day) in positions.items()}
    featured = {repo['full_name'] for repo in data['repositories'][:5]}
    omitted_repositories = max(0, len(data['repositories']) - len(featured))
    events=[ev for ev in snap['events'] if ev['repo'] in featured and ev['date']<=snap['generated'] and ev['date'].date() in positions]
    if len(events)>240:
        events=events[-240:]
    daily=defaultdict(list)
    for ev in events:
        daily[ev['date'].date()].append(ev)
    repo_counts=Counter(ev['repo'] for ev in events)
    totals=Counter({d:sum(e['count'] for e in evs) for d,evs in daily.items()})
    repo_idx={r['full_name']:i+1 for i,r in enumerate(data['repositories'][:5])}
    show=bool(data.get('_showcase'))
    mark=('SYNTHETIC DENSITY SHOWCASE' if show else
          'SHARED SYNTHETIC FIXTURE' if data['source']=='demo' else 'PUBLIC EVENT SNAPSHOT')
    note=(f'{data.get("_illustrative_count",0)} invented design-only events + {len(snap["events"])-data.get("_illustrative_count",0)} fixture events' if show else
          f'{len(events)} recorded fixture events • No invented contributions' if data["source"]=="demo" else
          f'{len(events)} observed public events • incomplete GitHub coverage')
    titlefont='Georgia,serif' if vintage else 'system-ui,Segoe UI,sans-serif'
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" role="img" aria-labelledby="title description">',
        f'<title id="title">Open Source Metro: {theme} GitHub-style contribution calendar</title>',
        f'<desc id="description">{escape(mark)}. Calendar tiles show synthetic source event units, coloured lines show five event kinds, roundels mark repo stations. Blank days do not prove zero actual GitHub contributions.</desc>',
        '<defs><style><![CDATA[',
        f'.mast{{font:800 36px {titlefont};letter-spacing:-1px;fill:{t["ink"]}}}',
        f'.sub{{font:600 12px system-ui,sans-serif;letter-spacing:1.4px;fill:{t["muted"]}}}',
        f'.tag{{font:800 10px system-ui,sans-serif;letter-spacing:1.55px;fill:{t["muted"]}}}',
        f'.month{{font:800 12px system-ui,sans-serif;letter-spacing:.65px;fill:{t["muted"]}}}',
        f'.legend{{font:800 12px system-ui,sans-serif;letter-spacing:1px;fill:{t["ink"]}}}',
        f'.detail{{font:500 12px system-ui,sans-serif;fill:{t["muted"]}}}',
        f'.repo{{font:700 15px {titlefont};fill:{t["ink"]}}}',
        f'.tile-cell{{width:{CELL}px;height:{CELL}px;rx:{2 if vintage else 4}px}}',
        *[f'.f{i}{{fill:{col}}}' for i,col in enumerate([t['blank'],*t['intensity']])],
        '.cell:focus .focus{stroke-width:2.4;opacity:1}',
        '@media(prefers-reduced-motion:reduce){.train{display:none}}',
        ']]></style></defs>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{t["bg"]}"/>',
        f'<rect x="16" y="15" width="1408" height="572" rx="{4 if vintage else 22}" fill="{t["paper"]}" stroke="{t["line"]}" stroke-width="1"/>']
    if vintage:
        svg.extend([f'<rect x="24" y="23" width="1392" height="556" fill="none" stroke="{t["line"]}" stroke-width="1"/>',
            f'<path d="M49 122H1390 M49 553H1390" stroke="{t["line"]}" stroke-width="1.3"/>'])
    else:
        svg.extend([f'<path d="M58 45V96" stroke="{SERVICE[0][2]}" stroke-width="6" stroke-linecap="round"/>',
                    f'<circle cx="1359" cy="79" r="21" fill="none" stroke="#4CE0B3" stroke-width="1.6"/><circle cx="1359" cy="79" r="5" fill="#4CE0B3"/>'])
    svg.extend([text(79,70,'OPEN SOURCE METRO','mast'),
      text(80,94,'GITHUB CONTRIBUTION CALENDAR × TRANSIT MAP','sub'),
      text(1250,53,mark,'tag','end'),
      text(1250,77,f'{len(events)} EVENTS   /   {len(daily)} ACTIVE DAYS   /   {len(repo_idx)} STATIONS','detail','end'),
      f'<rect x="76" y="127" width="1288" height="247" rx="{2 if vintage else 13}" fill="{t["panel"]}" stroke="{t["line"]}" stroke-width="1"/>',
      text(101,147,'01 / THE CALENDAR','tag'),
      text(1332,147,'A SQUARE IS A DAY.  THE BRIGHTER IT IS, THE MORE OBSERVED UNITS.','tag','end')])
    # Quiet alternating monthly city districts keep the chart readable.
    for week in range(53):
        if week%4==0:
            x=GX+week*GAP-5
            svg.append(f'<rect x="{x}" y="182" width="{GAP*4-5}" height="164" rx="2" fill="{t["tile"]}" opacity=".35"/>')
    old_month=None
    for week in range(53):
        d=start+timedelta(weeks=week)
        if d.month!=old_month and d<=today:
            svg.append(text(GX+week*GAP,177,d.strftime('%b').upper(),'month'))
        old_month=d.month
    for r,day in ((1,'MON'),(3,'WED'),(5,'FRI')):
        svg.append(text(151,GY+r*GAP+11,day,'tag','end'))
    # Squares, the recognisable GitHub calendar structure.
    for d in dates:
        week,day=positions[d];x,y=GX+week*GAP,GY+day*GAP
        units=totals.get(d,0)
        k=0 if units==0 else (1 if units<3 else 2 if units<6 else 3 if units<10 else 4)
        fill=t['blank'] if not k else t['intensity'][k-1]
        opacity=1 if units else .78
        tooltip=f'{d.isoformat()} : {units} observed demo units' + ('; '+', '.join(ev['id'] for ev in daily[d]) if daily[d] else ' (unobserved)')
        if not units:
            svg.append(f'<rect class="tile-cell f0" x="{x:.1f}" y="{y:.1f}" opacity=".78"/>')
        else:
            svg.append(f'<g class="cell" data-date="{d.isoformat()}" data-units="{units}" tabindex="0" aria-label="{escape(tooltip,quote=True)}">')
            svg.append(f'<title>{escape(tooltip)}</title>')
            svg.append(f'<rect class="tile-cell f{k}" x="{x:.1f}" y="{y:.1f}"/>')
            svg.append(f'<rect class="focus" x="{x-1:.1f}" y="{y-1:.1f}" width="{CELL+2}" height="{CELL+2}" rx="4" fill="none" stroke="{t["ink"]}" opacity="0"/>')
            svg.append('</g>')
    # Five source-grounded route services, thinned to legible milestone stops.
    selected=[]
    for kind,code,_ in SERVICE:
        all_events=[ev for ev in events if ev['kind']==kind]
        unique=[];seen=set()
        for ev in all_events:
            if ev['date'].date() not in seen:
                unique.append(ev);seen.add(ev['date'].date())
        if len(unique)>6:
            picks=sorted({round(i*(len(unique)-1)/5) for i in range(6)})
            unique=[unique[i] for i in picks]
        selected.append(unique)
    for (kind,code,_),route in zip(SERVICE,selected):
        path=_route(route,points)
        if path:
            col=tint(kind,vintage)
            svg.append(f'<g class="route route-{kind}"><title>{escape(code)} service links recorded {escape(kind)} milestones by date, not repository dependencies</title>')
            svg.append(f'<path d="{path}" fill="none" stroke="{t["panel"]}" stroke-width="7.4" stroke-linejoin="round" stroke-linecap="round"/>')
            svg.append(f'<path d="{path}" fill="none" stroke="{col}" stroke-width="{2.6 if vintage else 3.1}" stroke-linejoin="round" stroke-linecap="round" opacity=".86"/>')
            if vintage:svg.append(f'<path d="{path}" fill="none" stroke="{t["panel"]}" stroke-width=".75" stroke-dasharray="3 4"/>')
            svg.append('</g>')
    # Repeated per-day stop dots connect each coloured route to the calendar.
    anchor_by_repo={}
    for (kind,_,_),route in zip(SERVICE,selected):
        col=tint(kind,vintage)
        for ev in route:
            x,y=points[ev['date'].date()]
            rid=repo_idx.get(ev['repo'])
            if rid:
                priority={'release':4,'pr_merged':3,'commit':2,'pr_opened':1,'issue_opened':0}[kind]
                prior=anchor_by_repo.get(rid)
                if prior is None or (priority,ev['date'])>(prior[0],prior[1]['date']):
                    anchor_by_repo[rid]=(priority,ev)
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5.3" fill="{t["paper"]}" stroke="{col}" stroke-width="2.1"><title>{escape(ev["repo"])}: {escape(kind)}, {ev["date"].date()}</title></circle>')
    # Numbered terminal stop per repository, cross-referenced to its index.
    for rid,(_,ev) in anchor_by_repo.items():
        x,y=points[ev['date'].date()]
        col=tint(ev['kind'],vintage)
        svg.append(f'<g class="terminal" data-repo="{escape(ev["repo"],quote=True)}">')
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="{t["paper"]}" stroke="{col}" stroke-width="3"/>')
        svg.append(f'<text x="{x:.1f}" y="{y+3.4:.1f}" text-anchor="middle" font-size="10" font-weight="800" font-family="system-ui,sans-serif" fill="{t["ink"]}">{rid:02d}</text>')
        svg.append(f'<title>Station {rid:02d}: {escape(ev["repo"])}; {escape(ev["kind"])} on {ev["date"].date()}</title></g>')
    svg.extend([text(101,365,'CALENDAR DENSITY:   NONE / NO OBSERVATION','tag'),text(1210,365,'LOW','tag','end')])
    for idx in range(5):
        fill=t['blank'] if idx==0 else t['intensity'][idx-1]
        svg.append(f'<rect x="{1222+idx*20}" y="354" width="12" height="12" rx="3" fill="{fill}"/>')
    svg.append(text(1353,365,'HIGH','tag','end'))
    svg.extend([text(81,408,'02 / THE FIVE TRANSIT SERVICES','tag'),
        text(1359,408,'TRACKS LINK EVENTS OF THE SAME TYPE, IN CHRONOLOGICAL ORDER','tag','end')])
    for i,(kind,code,_) in enumerate(SERVICE):
        x=94+i*265;col=tint(kind,vintage)
        svg.append(f'<path d="M{x} 433H{x+33}" stroke="{col}" stroke-width="5" stroke-linecap="round"/>')
        svg.append(f'<circle cx="{x+15}" cy="433" r="8" fill="{t["paper"]}" stroke="{col}" stroke-width="3"/>')
        svg.append(text(x+47,438,code,'legend'))
        svg.append(text(x+48,449,f'{len([e for e in events if e["kind"]==kind])} EVENTS','tag'))
    svg.append(f'<path d="M81 453H1360" stroke="{t["line"]}"/>')
    svg.extend([text(81,475,'03 / REPOSITORY TERMINALS','tag'),
      text(1359,475,'THE NUMBER ON A MAP STOP IDENTIFIES A REPOSITORY BELOW','tag','end')])
    stations=data['repositories'][:5]
    for i,repo in enumerate(stations):
        x=82+i*265; cnt=repo_counts[repo['full_name']]; rid=i+1
        svg.append(f'<rect x="{x}" y="486" width="251" height="61" rx="{2 if vintage else 11}" fill="{t["tile"]}" stroke="{t["line"]}" stroke-width="1"/>')
        col=tint(SERVICE[i%5][0],vintage)
        svg.append(f'<circle cx="{x+23}" cy="517" r="15" fill="{t["paper"]}" stroke="{col}" stroke-width="3"/>')
        svg.append(text(x+23,521,f'{rid:02d}','legend','middle'))
        svg.append(text(x+47,510,repo.get('name',repo['full_name'].split('/')[-1])[:20],'repo'))
        svg.append(text(x+47,528,f'{cnt} recorded events  /  {repo["full_name"].split("/")[0]}','detail'))
        svg.append(f'<rect x="{x+48}" y="537" width="{min(171, 20+cnt*2.0):.1f}" height="2.7" fill="{col}" opacity=".75"/>')
    svg.append(f'<path d="M81 558H1360" stroke="{t["line"]}" stroke-width=".8"/>')
    svg.append(text(82,574,f'{mark}  /  {note}','tag'))
    svg.append(text(1358,574,
       (f'ONLY 5 OF {len(data["repositories"])} REPOSITORIES SHOWN / ' if omitted_repositories else '') +
       'NOT A COMPLETE GITHUB CONTRIBUTION HISTORY','tag','end'))
    svg.append('</svg>')
    return '\n'.join(svg)+'\n'


def generate(fixture: Path, output: Path) -> list[Path]:
    raw=json.loads(fixture.read_text(encoding='utf-8'))
    output.mkdir(parents=True,exist_ok=True)
    variants=(('midnight','fixture',raw), ('midnight','showcase',expand_showcase(raw)),
              ('parchment','showcase',expand_showcase(raw)))
    paths=[]
    for theme,mode,data in variants:
        target=output/f'atlas-{theme}-{mode}.svg'
        target.write_text(render(data,theme),encoding='utf-8');paths.append(target)
    return paths


def main():
    parser=argparse.ArgumentParser(description='Original, offline GitHub-calendar Metro Atlas')
    parser.add_argument('--input',type=Path,default=Path(__file__).resolve().parents[2]/'shared/fixtures/demo-activity.json')
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'exports')
    args=parser.parse_args()
    files=generate(args.input,args.output)
    for file in files:print(file)


if __name__=='__main__':
    main()
