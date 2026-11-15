"""Offline contract, geometry and SVG regression tests. Run with unittest discover."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("constellation", BASE / "constellation.py")
constellation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(constellation)
FIXTURE = json.loads((BASE.parents[1] / "shared/fixtures/demo-activity.json").read_text(encoding="utf-8"))


class ConstellationTests(unittest.TestCase):
    def test_shared_fixture_and_svg_xml(self):
        data = constellation.normalise(FIXTURE)
        self.assertEqual((len(data["repositories"]), len(data["events"])), (5, 10))
        for layout in ("radial", "clustered"):
            for theme in ("paper", "night"):
                svg = constellation.render(data, layout, theme)
                root = ET.fromstring(svg)
                self.assertEqual(root.attrib["viewBox"], "0 0 1200 375")
                self.assertEqual(root.attrib["data-source"], "demo")
                self.assertEqual(root.attrib["data-events"], "10")
                self.assertIn("SYNTHETIC DEMO", svg)
                self.assertIn('data-relation="shared-language"', svg)
                self.assertIn('class="traveller"', svg)
                self.assertEqual(svg.count('class="pulse"'), 10)

    def test_deterministic_and_no_mutation(self):
        payload = copy.deepcopy(FIXTURE)
        before = json.dumps(payload, sort_keys=True)
        a = constellation.render(constellation.normalise(payload), "radial", "night")
        b = constellation.render(constellation.normalise(payload), "radial", "night")
        self.assertEqual(a, b)
        self.assertEqual(before, json.dumps(payload, sort_keys=True))

    def test_duplicate_event_id_does_not_double_count(self):
        payload = copy.deepcopy(FIXTURE)
        payload["activity"].append(dict(payload["activity"][0]))
        data = constellation.normalise(payload)
        self.assertEqual(len(data["events"]), 10)
        self.assertIn("10 distinct events", constellation.render(data))

    def test_empty_and_one_repository(self):
        payload = copy.deepcopy(FIXTURE)
        payload["repositories"] = []
        payload["activity"] = []
        sky = constellation.render(constellation.normalise(payload))
        self.assertIn("The sky is quiet", sky)
        ET.fromstring(sky)
        payload["repositories"] = [FIXTURE["repositories"][0]]
        self.assertEqual(len(constellation.positions(constellation.normalise(payload)["repositories"], "clustered")), 1)
        ET.fromstring(constellation.render(constellation.normalise(payload), "clustered", "paper"))

    def test_crowding_cap_and_long_label(self):
        payload = copy.deepcopy(FIXTURE)
        payload["repositories"] = [{"full_name": f"sample-dev/repository-{i:02d}", "name": "A very long repository display name " + str(i), "url": "https://github.com/example", "language": "Python" if i % 2 else "Go"} for i in range(20)]
        payload["activity"] = []
        data = constellation.normalise(payload)
        self.assertEqual(len(data["repositories"]), 15)
        self.assertIn("5 repos omitted", constellation.render(data, "radial"))
        self.assertIn("…", constellation.render(data, "clustered", "paper"))
        self.assertLessEqual(constellation.render(data).count('data-relation="shared-language"'), 14)
        for layout in ("radial", "clustered"):
            coords = list(constellation.positions(data["repositories"], layout).values())
            self.assertEqual(len(set(coords)), 15)
            # Labels are at most 131px wide in crowded layouts. No same-row collision.
            for i, (x, y) in enumerate(coords):
                for x2, y2 in coords[i+1:]:
                    self.assertTrue(abs(y-y2) > 45 or abs(x-x2) >= 130)
            self.assertTrue(all(330 <= x <= 1190 and 50 <= y <= 335 for x, y in coords))

    def test_unsafe_text_is_escaped_and_urls_rejected(self):
        payload = copy.deepcopy(FIXTURE)
        payload["repositories"][0]["name"] = '<script>alert("oops")</script>'
        svg = constellation.render(constellation.normalise(payload))
        self.assertNotIn("<script>", svg)
        self.assertIn("&lt;script&gt;", svg)
        ET.fromstring(svg)
        payload["repositories"][0]["url"] = "javascript:alert(1)"
        with self.assertRaises(ValueError):
            constellation.normalise(payload)

    def test_invalid_schema_timestamps_and_counts(self):
        for edit in (lambda p: p.update(schema_version="2"), lambda p: p["activity"][0].update(occurred_at="2026-01-01T10:00:00+05:30"), lambda p: p["activity"][0].update(count=0), lambda p: p["activity"][0].update(kind="unknown"), lambda p: p["activity"][0].update(repo_full_name="unknown"), lambda p: p["repositories"][0].update(stars=True)):
            payload = copy.deepcopy(FIXTURE)
            edit(payload)
            with self.assertRaises(ValueError):
                constellation.normalise(payload)

    def test_factual_links_and_still_animation_absent(self):
        data = constellation.normalise(FIXTURE)
        svg = constellation.render(data, animated=False)
        self.assertEqual(svg.count('data-relation="shared-language"'), 1)
        self.assertNotIn('class="pulse"', svg)
        self.assertNotIn('class="traveller"', svg)
        self.assertNotIn('class="twinkle"', svg)
        self.assertIn("pr merged", constellation.render(data))

    def test_many_events_replay_is_recent_and_explicitly_bounded(self):
        payload = copy.deepcopy(FIXTURE)
        template = dict(payload["activity"][0])
        payload["activity"] = [dict(template, id=f"event-{i:03d}") for i in range(200)]
        model = constellation.normalise(payload)
        svg = constellation.render(model)
        self.assertEqual(svg.count('class="pulse"'), 150)
        self.assertIn('latest 150/200 events', svg)
        self.assertNotIn('data-event="event-000"', svg)
        self.assertIn('data-event="event-199"', svg)

    def test_build_eight_exports_offline(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "input.json"
            path.write_text(json.dumps(FIXTURE), encoding="utf-8")
            exports = constellation.build(path, Path(tmp) / "export")
            self.assertEqual(len(exports), 8)
            for svg in exports:
                self.assertGreater(svg.stat().st_size, 2000)
                ET.parse(svg)


if __name__ == "__main__":
    unittest.main()