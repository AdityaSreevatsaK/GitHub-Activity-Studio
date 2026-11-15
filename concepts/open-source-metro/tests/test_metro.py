"""Offline regression tests: python -m unittest discover -s tests -v"""
import copy
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from metro import MAX_REPOS, generate, layout, normalise, render, safe_url, stress_snapshot


def fixture():
    names = ("aurora", "atlas", "ember", "orbit", "harbour")
    events = (
        ("commit", "aurora", 3), ("pr_opened", "atlas", 1),
        ("commit", "ember", 2), ("pr_merged", "atlas", 1),
        ("issue_opened", "orbit", 1), ("commit", "orbit", 5),
        ("release", "aurora", 1), ("pr_merged", "harbour", 1),
        ("commit", "harbour", 4), ("pr_opened", "ember", 1),
    )
    return {"schema_version": "1", "source": "demo", "generated_at": "2026-11-16T00:00:00Z",
            "user": {"login": "sample-dev", "url": "https://github.com/example"},
            "repositories": [{"full_name": f"sample-dev/{name}", "name": name, "url": "https://github.com/example"} for name in names],
            "activity": [{"id": f"demo-{i:03}", "kind": kind, "repo_full_name": f"sample-dev/{repo}",
                          "occurred_at": f"2026-{8+i//4:02d}-{2+i%4:02d}T10:00:00Z", "count": count,
                          "url": "https://github.com/example"} for i, (kind, repo, count) in enumerate(events, 1)]}


class ContractTests(unittest.TestCase):
    def test_default_demo(self):
        snap = normalise(fixture())
        self.assertEqual((snap["repo_total"], snap["event_total"]), (5, 10))
        self.assertEqual(len(layout(snap)["positions"]), 5)

    def test_duplicate_events_deduplicated_by_id(self):
        data = fixture()
        data["activity"].append(copy.deepcopy(data["activity"][0]))
        self.assertEqual(normalise(data)["event_total"], 10)

    def test_events_sorted_by_utc_then_id(self):
        data = fixture()
        data["activity"] = list(reversed(data["activity"]))
        ordered = normalise(data)["events"]
        self.assertEqual(ordered, sorted(ordered, key=lambda e: (e["when"], e["id"])))

    def test_tie_break_is_deterministic(self):
        data = fixture()
        data["activity"][1]["occurred_at"] = data["activity"][0]["occurred_at"]
        data["activity"].reverse()
        self.assertEqual([e["id"] for e in normalise(data)["events"]][:2], ["demo-001", "demo-002"])

    def test_malformed_schema_and_kind(self):
        data = fixture()
        data["schema_version"] = "2"
        with self.assertRaises(ValueError): normalise(data)
        data = fixture()
        data["activity"][0]["kind"] = "review"
        with self.assertRaises(ValueError): normalise(data)

    def test_reject_unknown_repo_and_negative_count(self):
        for key, value in (("repo_full_name", "evil/unknown"), ("count", -2), ("count", True)):
            data = fixture()
            data["activity"][0][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): normalise(data)

    def test_utc_only_and_missing_timestamp(self):
        for date in ("2026-01-01T12:00:00+05:30", "2026-01-01T12:00:00", "yesterday", None):
            data = fixture()
            data["activity"][0]["occurred_at"] = date
            with self.subTest(date=date), self.assertRaises(ValueError): normalise(data)

    def test_url_restrictions(self):
        for url in ("javascript:alert(1)", "https://github.com.evil.test/", "http://github.com/a", "https://evil.com/a", "https://github.com:444/a", "https://github.com/a\nbar"):
            self.assertIsNone(safe_url(url), url)
        self.assertEqual(safe_url("https://github.com/example"), "https://github.com/example")

    def test_duplicate_repository_rejected(self):
        data = fixture()
        data["repositories"].append(data["repositories"][0])
        with self.assertRaises(ValueError): normalise(data)

    def test_empty_and_single_repo(self):
        data = fixture()
        data["repositories"] = []
        data["activity"] = []
        svg = render(normalise(data))
        self.assertIn("NO RECORDED ACTIVITY", svg)
        ET.fromstring(svg)
        data = fixture()
        data["repositories"] = data["repositories"][:1]
        data["activity"] = []
        self.assertEqual(len(layout(normalise(data))["positions"]), 1)


class RenderingTests(unittest.TestCase):
    def setUp(self):
        self.snap = normalise(fixture())

    def test_all_four_palettes_are_parseable(self):
        for style in ("modern", "vintage"):
            for scheme in ("light", "dark"):
                with self.subTest(style=style, scheme=scheme):
                    ET.fromstring(render(self.snap, style=style, scheme=scheme))

    def test_stable_and_deduplicated_svg(self):
        self.assertEqual(render(self.snap), render(self.snap))
        data = fixture()
        data["activity"].append(data["activity"][0])
        self.assertEqual(render(normalise(data)), render(self.snap))

    def test_station_names_and_kind_routes(self):
        svg = render(self.snap)
        self.assertIn("aurora", svg)
        for kind in ("commit", "pr_opened", "pr_merged", "issue_opened", "release"):
            self.assertIn(f'class="line-{kind}"', svg)
        self.assertIn("LINES = EVENT TYPES", svg)

    def test_motion_still_and_reduced_motion(self):
        active = render(self.snap)
        still = render(self.snap, animated=False)
        self.assertIn("animateMotion", active)
        self.assertIn('prefers-reduced-motion:reduce', active)
        self.assertIn('keyTimes=', active)
        self.assertNotIn("animateMotion", still)
        self.assertNotIn('class="train"', still)

    def test_escaped_names_and_event_ids(self):
        data = fixture()
        data["repositories"][0]["name"] = '<script>alert(1)</script>'
        data["activity"][0]["id"] = '<img src=x onerror=alert(1)>'
        svg = render(normalise(data), animated=False)
        ET.fromstring(svg)
        self.assertNotIn("<script>", svg)
        self.assertIn("&lt;img", svg)

    def test_no_demo_click_targets(self):
        self.assertNotIn("xlink:href", render(self.snap, browser_links=True))

    def test_safe_github_preview_link_only(self):
        data = fixture()
        data["source"] = "github"
        data["activity"][0]["url"] = "javascript:alert(1)"
        self.assertNotIn("javascript:", render(normalise(data), browser_links=True))
        self.assertIn("xlink:href", render(normalise(data), browser_links=True))
        self.assertNotIn("xlink:href", render(normalise(data), browser_links=False))

    def test_17_station_stress_has_three_rows(self):
        stress = stress_snapshot(self.snap)
        self.assertEqual(stress["repo_total"], 17)
        self.assertEqual(layout(stress)["rows"], 3)
        self.assertEqual(len(layout(stress)["positions"]), 17)
        self.assertIn('viewBox="0 0 1200 892"', render(stress))

    def test_long_repo_names_truncated_and_disclosed(self):
        data = fixture()
        data["repositories"][0]["name"] = "a-very-very-long-repository-name-that-needs-to-be-truncated"
        svg = render(normalise(data))
        self.assertIn("a-very-very-long-r…", svg)
        self.assertIn("<title>sample-dev/aurora</title>", svg)

    def test_explicit_caps_and_counts(self):
        data = fixture()
        for i in range(25):
            data["repositories"].append({"name": f"r-{i}", "full_name": f"demo/r-{i}"})
        snap = normalise(data)
        self.assertEqual(len(layout(snap)["positions"]), MAX_REPOS)
        self.assertIn("OMITTED 12 REPOS", render(snap))

    def test_generated_assets_and_browser_controls(self):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            fixture_path = d / "fixture.json"
            fixture_path.write_text(json.dumps(fixture()), encoding="utf-8")
            outputs = generate(fixture_path, d / "exports")
            self.assertEqual(len(outputs), 17)
            self.assertTrue(all(p.exists() for p in outputs))
            html = (d / "exports" / "preview.html").read_text(encoding="utf-8")
            for identifier in ("style", "scheme", "motion", "scenario"):
                self.assertIn(f'id="{identifier}"', html)
            self.assertIn("prefers-reduced-motion", html)


if __name__ == "__main__":
    unittest.main()
