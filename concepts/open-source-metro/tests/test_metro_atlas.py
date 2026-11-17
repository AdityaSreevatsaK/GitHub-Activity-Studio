"""Original Open Source Metro Atlas offline data, structure and provenance checks."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

CONCEPT=Path(__file__).resolve().parents[1]
ROOT=CONCEPT.parents[1]
sys.path.insert(0,str(CONCEPT))
from metro_atlas import COLORS, SERVICE, expand_showcase, generate, render

FIXTURE=ROOT/'shared'/'fixtures'/'demo-activity.json'

def raw():
    return json.loads(FIXTURE.read_text(encoding='utf-8'))

class AtlasTests(unittest.TestCase):
    def test_both_art_directions_are_valid_accessible_svg(self):
        data=expand_showcase(raw())
        for theme in COLORS:
            with self.subTest(theme=theme):
                svg=render(data,theme)
                root=ET.fromstring(svg)
                self.assertTrue(root.tag.endswith('svg'))
                self.assertTrue(root.find('{http://www.w3.org/2000/svg}title') is not None)
                self.assertTrue(root.find('{http://www.w3.org/2000/svg}desc') is not None)
                self.assertIn('SYNTHETIC DENSITY SHOWCASE',svg)
                self.assertIn('NOT A COMPLETE GITHUB CONTRIBUTION HISTORY',svg)
                self.assertEqual(svg.count('class="terminal"'),5)

    def test_raw_fixture_is_not_augmented_without_showcase(self):
        original=raw();svg=render(original)
        self.assertIn('10 EVENTS',svg)
        self.assertNotIn('illustrative-',svg)
        self.assertIn('SHARED SYNTHETIC FIXTURE',svg)

    def test_demo_expansion_is_deterministic_and_does_not_mutate_input(self):
        input_data=raw();before=copy.deepcopy(input_data)
        first=expand_showcase(input_data);second=expand_showcase(input_data)
        self.assertEqual(input_data,before)
        self.assertEqual(first,second)
        self.assertGreater(first['_illustrative_count'],100)
        self.assertTrue(all(ev['id'].startswith('illustrative-') for ev in first['activity'][10:]))
        self.assertEqual(first['activity'][:10],input_data['activity'])
        self.assertEqual(render(first),render(second))

    def test_showcase_requires_synthetic_source(self):
        source=raw();source['source']='github'
        with self.assertRaises(ValueError):expand_showcase(source)

    def test_five_routes_and_calendar_tiles_are_present(self):
        svg=render(expand_showcase(raw()))
        root=ET.fromstring(svg)
        for kind,code,_ in SERVICE:
            self.assertIn('route-'+kind,svg)
            self.assertIn(code,svg)
        self.assertIn('class="tile-cell f0"',svg)
        self.assertIn('data-units=',svg)
        self.assertIn('CALENDAR DENSITY',svg)
        self.assertGreater(len([e for e in root.iter() if e.get('class','').startswith('tile-cell')]),150)

    def test_escaped_event_identifiers_do_not_inject_markup(self):
        data=raw();data['activity'][0]['id']='<img src=x onerror=alert(1)>'
        svg=render(data)
        ET.fromstring(svg)
        self.assertNotIn('<img src=x',svg)
        self.assertIn('&lt;img',svg)

    def test_empty_and_single_repository_are_supported(self):
        data=raw();data['repositories']=[];data['activity']=[]
        ET.fromstring(render(data));ET.fromstring(render(expand_showcase(data)))
        data=raw();data['repositories']=data['repositories'][:1]
        data['activity']=[x for x in data['activity'] if x['repo_full_name']==data['repositories'][0]['full_name']]
        ET.fromstring(render(data))

    def test_exports_match_local_renderer(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)
            result=generate(FIXTURE,out)
            self.assertEqual(len(result),3)
            for path in result:
                self.assertEqual(path.read_text(encoding='utf-8'),(CONCEPT/'exports'/path.name).read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
