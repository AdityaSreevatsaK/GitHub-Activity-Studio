"""Calendar-first Open Source Metro, offline and deterministic contract tests."""
from __future__ import annotations
import copy
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from datetime import timedelta
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from calendar_metro import MAX_EVENTS, MAX_REPOS, WEEKS, density, demo_stress, generate, normalise, plan, point, preview_html, render, safe_url, segments

DEMO = Path(__file__).resolve().parents[3]/'shared/fixtures/demo-activity.json'


def raw():
    return json.loads(DEMO.read_text(encoding='utf-8'))


class CalendarContract(unittest.TestCase):
    def setUp(self):
        self.snap = normalise(raw())

    def test_exact_shared_fixture_counts(self):
        self.assertEqual((self.snap['repo_total'],self.snap['event_total']), (5,10))
        self.assertEqual(sum(e['count'] for e in self.snap['events']), 20)

    def test_deterministic_order_even_when_input_reversed(self):
        data = raw()
        data['activity'].reverse()
        self.assertEqual(normalise(data)['events'],self.snap['events'])

    def test_duplicate_events_ignored(self):
        data = raw()
        data['activity'].append(copy.deepcopy(data['activity'][0]))
        self.assertEqual(normalise(data)['events'],self.snap['events'])

    def test_conflicting_duplicate_event_ids_rejected(self):
        data = raw()
        conflict = copy.deepcopy(data['activity'][0])
        conflict['count'] += 1
        data['activity'].append(conflict)
        with self.assertRaisesRegex(ValueError, 'Conflicting source records'):
            normalise(data)

    def test_conflicting_duplicate_ids_rejected_independent_of_input_order(self):
        data = raw()
        conflict = copy.deepcopy(data['activity'][0])
        conflict['repo_full_name'] = data['repositories'][1]['full_name']
        data['activity'].append(conflict)
        with self.assertRaises(ValueError):
            normalise(data)
        data['activity'].reverse()
        with self.assertRaises(ValueError):
            normalise(data)

    def test_duplicate_ids_with_identical_values_remain_idempotent(self):
        data = raw()
        data['activity'].insert(0, copy.deepcopy(data['activity'][0]))
        self.assertEqual(normalise(data)['events'], self.snap['events'])

    def test_rejects_malformed_and_unknown_events(self):
        for key,value in [('kind','unreviewed'),('repo_full_name','other/repository'),('count',False),('count',0),('count',-7),('occurred_at','yesterday'),('occurred_at','2026-05-01T10:00:00+05:30')]:
            data=raw();data['activity'][0][key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):normalise(data)

    def test_rejects_malformed_snapshot_and_repo(self):
        for key,value in [('schema_version','2'),('source','unknown'),('generated_at','2026-11-16')]:
            data=raw();data[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):normalise(data)
        data=raw();data['repositories'].append(copy.deepcopy(data['repositories'][0]))
        with self.assertRaises(ValueError):normalise(data)

    def test_sanitised_browser_links(self):
        for bad in ('javascript:alert(1)','https://github.com.evil/a','http://github.com/a','https://github.com:555/a','https://attacker.test/','https://github.com/a\nInjected'):
            self.assertIsNone(safe_url(bad))
        self.assertEqual(safe_url('https://github.com/owner/repo'),'https://github.com/owner/repo')

    def test_calendar_is_53_sunday_aligned_weeks(self):
        p=plan(self.snap)
        self.assertEqual(len(p['days']),WEEKS*7)
        self.assertEqual(p['start'].weekday(),6)
        self.assertEqual(p['end'].isoformat(),'2026-11-16')
        self.assertEqual(p['positions'][p['start']],(0,0))
        self.assertEqual(p['positions'][p['days'][-1]],(52,6))

    def test_no_future_events_or_historical_out_of_window_events(self):
        data=raw()
        data['activity'].append({**data['activity'][0], 'id':'future','occurred_at':'2026-11-20T12:00:00Z'})
        data['activity'].append({**data['activity'][0], 'id':'old','occurred_at':'2020-11-20T12:00:00Z'})
        p=plan(normalise(data))
        self.assertEqual(len(p['events']),10)
        self.assertEqual(p['omitted_events'],2)
        self.assertNotIn('2026-11-20',render(normalise(data)))

    def test_aggregated_units_and_kind_identity_not_conflated(self):
        p=plan(self.snap)
        actual=p['by_day'][self.snap['events'][0]['date'].date()]
        self.assertEqual((len(actual),sum(x['count'] for x in actual)),(1,3))
        self.assertEqual([density(x) for x in (0,1,2,3,5,8)],[0,1,1,2,3,4])
        data=raw()
        data['activity'][1]['occurred_at']=data['activity'][0]['occurred_at']
        mapped=plan(normalise(data))
        self.assertEqual(len(mapped['by_day'][self.snap['events'][0]['date'].date()]),2)

    def test_empty_and_single_repo_cases(self):
        data=raw();data['repositories']=[];data['activity']=[]
        svg=render(normalise(data));ET.fromstring(svg)
        self.assertIn('0 observed events',svg)
        data=raw();data['repositories']=data['repositories'][:1];data['activity']=data['activity'][:1]
        p=plan(normalise(data))
        self.assertEqual(len(p['repos']),1)
        ET.fromstring(render(normalise(data)))

    def test_17_station_synthetic_stress(self):
        stress=demo_stress(self.snap)
        self.assertEqual((len(plan(stress)['repos']),stress['event_total']),(17,34))
        self.assertIn('viewBox="0 0 1320 595"',render(stress))

    def test_today_after_snapshot_time_not_reported_as_observed(self):
        data = raw()
        # Generated 16 Nov at 00:00 UTC: events from later that day are not observed.
        data["activity"].append({**data["activity"][0], "id": "later-same-day",
                                 "occurred_at": "2026-11-16T16:00:00Z"})
        result = plan(normalise(data))
        self.assertEqual(len(result["events"]), 10)
        self.assertEqual(result["omitted_events"], 1)
        self.assertNotIn("later-same-day", render(normalise(data)))

    def test_in_window_repositories_prioritised_over_old_inactive_repos(self):
        data = raw()
        for i in range(30):
            full = f"historic/archive-{i:02d}"
            data["repositories"].append({"full_name": full, "name": f"archive-{i:02d}"})
            data["activity"].append({"id": f"historic-{i:02d}", "repo_full_name": full,
                                     "kind": "commit", "occurred_at": "2020-01-01T10:00:00Z", "count": 1})
        result = plan(normalise(data))
        self.assertEqual(len(result["repos"]), MAX_REPOS)
        self.assertTrue(all(f"sample-dev/{name}" in {r["full_name"] for r in result["repos"]}
                            for name in ("aurora", "atlas", "ember", "orbit", "harbour")))
        self.assertEqual(len(result["events"]), 10)
        self.assertEqual(result["omitted_repos"], 17)

    def test_high_volume_prefers_recent_events_and_reports_cap(self):
        data = raw()
        data["activity"] = [
            {"id": f"bulk-{i:03d}", "repo_full_name": "sample-dev/aurora", "kind": "commit",
             "occurred_at": f"2026-10-{(i // 15) + 1:02d}T{(i % 15):02d}:00:00Z", "count": 1}
            for i in range(300)
        ]
        result = plan(normalise(data))
        self.assertEqual(len(result["events"]), MAX_EVENTS)
        self.assertEqual(result["events"][0]["id"], "bulk-060")
        self.assertEqual(result["events"][-1]["id"], "bulk-299")
        self.assertEqual(result["omitted_events"], 60)

    def test_empty_user_login_rejected(self):
        data = raw()
        data["user"]["login"] = ""
        with self.assertRaises(ValueError): normalise(data)

    def test_limits_disclosed(self):
        data=raw()
        data['repositories'].extend({'full_name':f'other/repo-{i:02}', 'name':f'repo-{i:02}'} for i in range(25))
        snap=normalise(data)
        self.assertEqual(len(plan(snap)['repos']),MAX_REPOS)
        self.assertIn('OMITTED: 12 REPOS',render(snap))
        self.assertEqual(MAX_EVENTS,240)


class CalendarRendering(unittest.TestCase):
    def setUp(self):
        self.snap=normalise(raw())

    def test_four_style_palettes_are_well_formed(self):
        for style in ('modern','vintage'):
            for scheme in ('light','dark'):
                with self.subTest(style=style,scheme=scheme):
                    root=ET.fromstring(render(self.snap,style=style,scheme=scheme))
                    self.assertTrue(root.tag.endswith('svg'))

    def test_calendar_cells_are_weekday_aligned_and_bounded(self):
        svg=render(self.snap)
        self.assertEqual(svg.count('class="day"'),10)  # ten observed event days
        self.assertEqual(svg.count('class="day-empty"'),356) # remaining 53-week days
        self.assertIn('data-date="2026-08-03" data-units="3"',svg)
        self.assertIn('data-date="2026-10-17" data-units="5"',svg)
        self.assertNotIn('data-date="2026-11-17"',svg)
        self.assertIn('53-WEEK EVENT CALENDAR',svg)

    def test_known_repo_platforms_and_event_ids(self):
        svg=render(self.snap)
        for item in ('sample-dev/aurora','demo-001','demo-010','2026-09-12','station directory'):
            self.assertIn(item.lower(),svg.lower())
        self.assertEqual(svg.count('class="repository"'),5)
        self.assertIn('BLANK ≠ VERIFIED ZERO',svg)

    def test_route_count_kind_separation_and_date_order(self):
        svg=render(self.snap,animated=True)
        for kind in ('commit','pr_opened','pr_merged','issue_opened','release'):
            self.assertIn(f'class="line-{kind}"',svg)
        code_points=[point(plan(self.snap)['positions'][ev['date'].date()]) for ev in self.snap['events'] if ev['kind']=='commit']
        self.assertIn(segments(code_points),svg)
        self.assertEqual(svg.count('<animateMotion'),3) # CODE, PROPOSE, MERGE only have repeated events

    def test_still_no_animation_and_reduced_motion_support(self):
        still=render(self.snap,animated=False)
        active=render(self.snap,animated=True)
        self.assertNotIn('<animateMotion',still)
        self.assertIn('prefers-reduced-motion:reduce',active)
        self.assertIn('class="train"',active)

    def test_same_day_interchange_and_script_escaping(self):
        data=raw()
        data['activity'][1]['occurred_at']=data['activity'][0]['occurred_at']
        data['repositories'][0]['name']='<script>alert(1)</script>'
        data['activity'][0]['id']='<img onerror=alert(1)>'
        svg=render(normalise(data))
        ET.fromstring(svg)
        self.assertNotIn('<script>',svg)
        self.assertIn('&lt;img',svg)
        self.assertIn('data-units="4"',svg)

    def test_no_fake_urls_embedded_in_demo(self):
        svg=render(self.snap,browser_links=True)
        self.assertNotIn('xlink:href',svg)
        self.assertIn('SYNTHETIC DEMONSTRATION',svg)

    def test_public_only_browser_links_are_opt_in(self):
        data=raw()
        data['source']='github'
        snap=normalise(data)
        self.assertNotIn('xlink:href',render(snap,browser_links=False))
        self.assertIn('xlink:href="https://github.com/example"',render(snap,browser_links=True))
        data['activity'][0]['url']='javascript:alert(1)'
        self.assertNotIn('javascript:',render(normalise(data),browser_links=True))

    def test_exact_reproducibility(self):
        self.assertEqual(render(self.snap),render(self.snap))
        data=raw();data['activity'].reverse()
        self.assertEqual(render(normalise(data)),render(self.snap))

    def test_generated_outputs_include_every_browser_selectable_combo(self):
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)
            outputs=generate(DEMO,out)
            self.assertEqual(len(outputs),22)
            self.assertTrue(all(x.exists() for x in outputs))
            for style in ('modern','vintage'):
                for scheme in ('light','dark'):
                    for prefix in ('','stress-'):
                        for suffix in ('still','animated'):
                            self.assertTrue((out/f'{prefix}{style}-{scheme}-{suffix}.svg').exists())
            html=(out/'preview.html').read_text(encoding='utf-8')
            for field in ('style','scheme','motion','scenario'):
                self.assertIn(f'id="{field}"',html)
            self.assertIn('prefers-reduced-motion',html)
            self.assertIn('53-week',html.lower())


if __name__=='__main__':unittest.main()