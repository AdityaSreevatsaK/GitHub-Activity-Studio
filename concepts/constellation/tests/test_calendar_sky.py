"""Calendar-first Constellation regression tests, standard library only."""
import copy
from datetime import timedelta
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('calendar_sky',HERE/'calendar_sky.py')
sky=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sky)
FIXTURE=json.loads((HERE.parents[1]/'shared/fixtures/demo-activity.json').read_text(encoding='utf-8'))

class CalendarSkyTests(unittest.TestCase):
    def test_fixture_and_53_week_calendar(self):
        m=sky.normalise(FIXTURE)
        self.assertEqual((len(m['repos']),len(m['events'])),(5,10))
        a,b=sky.calendar_span(m['generated'])
        self.assertEqual((b-a).days,370)
        self.assertEqual(a.weekday(),6)
        self.assertEqual(len(sky.activity_calendar(m)['days']),10)
        self.assertEqual(sum(x['count'] for x in m['events']),20)
    def test_all_layouts_themes_static_and_animated(self):
        model=sky.normalise(FIXTURE)
        for layout in ('atlas','trails'):
            for theme in ('night','paper'):
                for moving in (True,False):
                    s=sky.render(model,layout,theme,animated=moving)
                    root=ET.fromstring(s)
                    self.assertEqual(root.attrib['viewBox'],'0 0 1200 425')
                    self.assertEqual((root.attrib['data-weeks'],root.attrib['data-days']),('53','371'))
                    self.assertIn('SYNTHETIC DEMO',s)
                    self.assertEqual(s.count('data-date='),371)
                    self.assertEqual(s.count('class="day-link"'),10)
                    self.assertEqual(s.count('class="lens-link"'),10)
                    self.assertIn('THE SIGNAL LENS',s)
                    self.assertIn('data-repo-ids=',s)
                    self.assertEqual(s.count('data-relation="same-repository"'),5)
                    self.assertEqual(s.count('class="echo"'),10 if moving else 0)
                    self.assertEqual(s.count('class="tracer"'),5 if moving else 0)
    def test_blank_days_are_not_claimed_zero(self):
        s=sky.render(sky.normalise(FIXTURE))
        self.assertIn('empty ≠ verified zero',s)
        self.assertIn('No recorded event, not a verified zero',s.replace('no recorded event, not a verified zero','No recorded event, not a verified zero'))
    def test_chronology_dedup_and_determinism(self):
        payload=copy.deepcopy(FIXTURE)
        payload['activity']+=payload['activity'][:2]
        model=sky.normalise(payload)
        self.assertEqual(len(model['events']),10)
        a=sky.render(model,layout='trails',theme='paper')
        self.assertEqual(a,sky.render(model,layout='trails',theme='paper'))
    def test_empty_and_single_event(self):
        payload=copy.deepcopy(FIXTURE);payload['activity']=[]
        svg=sky.render(sky.normalise(payload))
        ET.fromstring(svg)
        self.assertIn('No recorded activity',svg)
        self.assertEqual(svg.count('class="lens-link"'),0)
        payload['activity']=[FIXTURE['activity'][0]]
        self.assertEqual(sky.render(sky.normalise(payload)).count('class="day-link"'),1)
    def test_same_day_multiple_repos_aggregate_and_escape(self):
        payload=copy.deepcopy(FIXTURE)
        payload['repositories'][0]['full_name']='sample-dev/<bad & name>'
        for item in payload['activity']:
            if item['repo_full_name']=='sample-dev/aurora':
                item['repo_full_name']='sample-dev/<bad & name>'
        payload['activity'][1]['occurred_at']=payload['activity'][0]['occurred_at']
        svg=sky.render(sky.normalise(payload))
        self.assertEqual(svg.count('class="day-link"'),9)
        self.assertIn('2 recorded events, 4 activity units',svg)
        self.assertNotIn('<bad',svg)
        self.assertIn('&lt;bad &amp; name&gt;',svg)
        ET.fromstring(svg)
    def test_invalid_fields_rejected(self):
        edits=[lambda p:p.update(schema_version='2'),lambda p:p['activity'][0].update(count=0),lambda p:p['activity'][0].update(count=True),lambda p:p['activity'][0].update(kind='stars'),lambda p:p['activity'][0].update(repo_full_name='unknown'),lambda p:p['activity'][0].update(occurred_at='2026-08-03T10:20:00+05:30'),lambda p:p['activity'][0].update(occurred_at='2027-08-03T10:20:00Z'),lambda p:p['repositories'][0].update(url='javascript:alert(1)')]
        for edit in edits:
            p=copy.deepcopy(FIXTURE);edit(p)
            with self.assertRaises(ValueError):sky.normalise(p)
    def test_future_days_are_marked(self):
        m=sky.normalise(FIXTURE)
        s=sky.render(m)
        self.assertEqual(s.count('data-future="true"'),5)
        self.assertEqual(s.count('data-future="false"'),366)
    def test_more_than_150_events_are_bounded(self):
        p=copy.deepcopy(FIXTURE)
        template=p['activity'][0]
        p['activity']=[dict(template,id=f'ev-{i:03d}') for i in range(170)]
        s=sky.render(sky.normalise(p))
        self.assertEqual(s.count('class="echo"'),150)
        self.assertEqual(s.count('class="day-link"'),1)
        self.assertEqual(s.count('class="lens-link"'),1)
        self.assertIn('170 recorded events',s)
    def test_signal_lens_groups_same_day_repo_and_preserves_units(self):
        payload=copy.deepcopy(FIXTURE)
        payload['activity'].append(dict(payload['activity'][0],id='same-day-extra',count=7))
        svg=sky.render(sky.normalise(payload),animated=False)
        self.assertEqual(svg.count('class="lens-link"'),10)
        self.assertIn('2 recorded events / 10 activity units',svg)
        root=ET.fromstring(svg)
        nodes=[a for a in root.iter() if a.attrib.get('class')=='lens-link']
        self.assertEqual(sum(int(a.attrib['data-units']) for a in nodes),27)
        self.assertEqual(len(nodes),10)

    def test_lens_capped_without_invented_dates(self):
        payload=copy.deepcopy(FIXTURE)
        original=payload['activity'][0]
        # Distinct repo-days spanning the calendar, with no fabricated dates.
        origin=sky.utc_timestamp('2026-03-01T12:00:00Z')
        payload['activity']=[dict(original,id=f'cap-{i}',occurred_at=(origin+timedelta(days=i)).strftime('%Y-%m-%dT%H:%M:%SZ')) for i in range(120)]
        svg=sky.render(sky.normalise(payload),animated=False)
        self.assertEqual(svg.count('class="lens-link"'),80)
        self.assertIn('LAST 80/120 REPO-DAYS',svg)
        self.assertEqual(svg.count('class="day-link"'),120)
        self.assertEqual(svg.count('data-date='),371)

    def test_build_eight_svg_exports(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'fixture.json'
            path.write_text(json.dumps(FIXTURE),encoding='utf-8')
            assets=sky.build(path,Path(temp)/'exports')
            self.assertEqual(len(assets),8)
            for asset in assets:
                self.assertGreater(asset.stat().st_size,8000)
                ET.parse(asset)
if __name__=='__main__':unittest.main()