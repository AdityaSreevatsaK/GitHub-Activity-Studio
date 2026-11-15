"""Offline contract and rendering regression tests; no API or token required."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DIR))
from factory import KINDS, export, normalise, render  # noqa: E402


class FactoryTest(unittest.TestCase):
    def setUp(self):
        self.data = {
            "schema_version": "1", "source": "demo", "generated_at": "2026-11-16T00:00:00Z",
            "repositories": [{"full_name": "alice/one", "name": "one"}, {"full_name": "bob/one", "name": "one"}],
            "activity": [{"id": "a", "kind": "commit", "repo_full_name": "alice/one", "count": 3, "occurred_at": "2026-11-01T00:00:00Z"},
                         {"id": "b", "kind": "pr_merged", "repo_full_name": "bob/one", "count": 1, "occurred_at": "2026-11-02T00:00:00Z"}],
        }

    def test_all_layout_theme_and_motion_combinations_are_xml(self):
        for layout in ("isometric", "pixel"):
            for theme in ("dark", "light"):
                for animated in (True, False):
                    with self.subTest(layout=layout, theme=theme, animated=animated):
                        svg = render(self.data, layout, theme, animated)
                        root = ET.fromstring(svg)
                        self.assertTrue(root.tag.endswith("svg"))
                        self.assertIn("SYNTHETIC DEMO", svg)
                        self.assertIn("METAPHOR ONLY", svg)
                        self.assertEqual("animateMotion" in svg, animated)

    def test_fixture_from_common_contract(self):
        path = DIR.parents[1] / "shared/fixtures/demo-activity.json"
        if path.is_file():
            scene = normalise(json.loads(path.read_text(encoding="utf-8")))
            self.assertEqual(scene["total_repos"], 5)
            self.assertEqual(scene["total_events"], 10)
            self.assertEqual(scene["counts"]["commit"], 14)
            self.assertEqual(scene["counts"]["pr_merged"], 2)

    def test_duplicate_identical_event_deduplicated(self):
        self.data["activity"].append(copy.deepcopy(self.data["activity"][0]))
        result = normalise(self.data)
        self.assertEqual(result["total_events"], 2)
        self.assertEqual(result["counts"]["commit"], 3)

    def test_duplicate_conflict_rejected(self):
        other = copy.deepcopy(self.data["activity"][0])
        other["count"] = 4
        self.data["activity"].append(other)
        with self.assertRaises(ValueError):
            normalise(self.data)

    def test_untrusted_svg_text_is_escaped(self):
        self.data["repositories"][0]["name"] = '<script>alert("x")</script>'
        svg = render(self.data)
        ET.fromstring(svg)
        self.assertNotIn("<script>alert", svg)
        self.assertNotIn("javascript:", svg)

    def test_empty_snapshot_has_idle_state(self):
        self.data["activity"] = []
        self.assertIn("IDLE SHIFT", render(self.data))
        self.assertNotIn("animateMotion", render(self.data))
        self.data["repositories"] = []
        self.assertIn("IDLE SHIFT", render(self.data, "pixel", "light", False))

    def test_one_repo_many_events_truncation_is_disclosed(self):
        self.data["repositories"] = self.data["repositories"][:1]
        self.data["activity"] = [dict(self.data["activity"][0], id=str(i), occurred_at=f"2026-11-{i+1:02d}T00:00:00Z") for i in range(20)]
        svg = render(self.data)
        self.assertIn("15/20 EVENTS", svg)
        self.assertEqual(svg.count("animateMotion"), 15)

    def test_many_repos_show_top_five(self):
        self.data["repositories"] = [{"full_name": f"org/r{i}", "name": f"r{i}"} for i in range(11)]
        self.data["activity"] = [dict(self.data["activity"][0], id=f"e{i}", repo_full_name=f"org/r{i}", count=i+1) for i in range(11)]
        scene = normalise(self.data)
        self.assertEqual(len(scene["stations"]), 5)
        self.assertEqual(scene["stations"][0]["full_name"], "org/r10")
        self.assertIn("5/11 REPOS", render(self.data))

    def test_packages_start_at_their_own_station(self):
        svg = render(self.data, "isometric", "dark", True)
        self.assertIn('path="M110,224 L965,224"', svg)
        self.assertIn('path="M277,224 L965,224"', svg)

    def test_same_name_different_owners_keep_identity(self):
        self.assertEqual(len(normalise(self.data)["stations"]), 2)

    def test_stable_output_and_exports(self):
        first = render(self.data)
        self.assertEqual(first, render(copy.deepcopy(self.data)))
        with tempfile.TemporaryDirectory() as directory:
            paths = export(self.data, Path(directory))
            self.assertEqual(len(paths), 8)
            for path in paths:
                self.assertTrue(path.is_file())
                ET.parse(path)

    def test_invalid_inputs(self):
        mutations = [
            lambda x: x.update(schema_version="2"),
            lambda x: x.update(source="private"),
            lambda x: x.update(generated_at="2026-11-16T00:00:00+05:30"),
            lambda x: x.update(activity="oops"),
            lambda x: x["activity"][0].update(kind="deployment"),
            lambda x: x["activity"][0].update(count=0),
            lambda x: x["activity"][0].update(count=True),
            lambda x: x["activity"][0].update(count=100001),
            lambda x: x["activity"][0].update(repo_full_name="missing/x"),
            lambda x: x["activity"][0].update(occurred_at="2026-02-30T00:00:00Z"),
            lambda x: x["activity"][0].update(kind=[]),
            lambda x: x["repositories"][0].update(full_name="bad"),
            lambda x: x["repositories"].append(copy.deepcopy(x["repositories"][0])),
        ]
        for i, mutate in enumerate(mutations):
            with self.subTest(i=i):
                data = copy.deepcopy(self.data)
                mutate(data)
                with self.assertRaises(ValueError):
                    normalise(data)

    def test_event_kind_is_preserved(self):
        scene = normalise(self.data)
        self.assertEqual([e["kind"] for e in scene["events"]], ["commit", "pr_merged"])
        self.assertEqual(set(scene["counts"]), set(KINDS))


if __name__ == "__main__":
    unittest.main()
