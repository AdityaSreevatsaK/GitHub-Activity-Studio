"""Checks committed calendar SVGs using Python's standard-library XML parser.

Run: python -m unittest discover -s concepts/code-factory/tests -v
"""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports"
NS = "{http://www.w3.org/2000/svg}"


class TestCalendarExports(unittest.TestCase):
    def test_complete_export_matrix(self):
        for layout in ("isometric", "pixel"):
            for theme in ("dark", "light"):
                for motion in ("", "-still"):
                    with self.subTest(layout=layout, theme=theme, motion=motion):
                        self.assertTrue((EXPORTS / f"{layout}-{theme}{motion}.svg").is_file())

    def test_valid_xml_and_profile_dimensions(self):
        names = (
            "isometric-dark.svg", "isometric-light.svg",
            "pixel-dark.svg", "pixel-light.svg",
            "isometric-dark-still.svg", "isometric-light-still.svg",
            "pixel-dark-still.svg", "pixel-light-still.svg",
            "isometric-light-release-week-still.svg",
            "pixel-dark-inspection-week-still.svg",
            "account-isometric-dark-still.svg",
            "account-isometric-light-still.svg",
            "account-pixel-dark-still.svg",
            "account-pixel-light-still.svg",
        )
        for name in names:
            with self.subTest(name=name):
                file = EXPORTS / name
                self.assertTrue(file.is_file(), name)
                root = ET.parse(file).getroot()
                self.assertEqual(root.tag, f"{NS}svg")
                self.assertEqual(root.attrib["viewBox"], "0 0 1200 430")
                self.assertEqual(root.attrib["role"], "img")
                self.assertIsNotNone(root.find(f"{NS}title"))
                self.assertIsNotNone(root.find(f"{NS}desc"))
                self.assertLess(file.stat().st_size, 150_000)
                self.assertFalse(list(root.iter(f"{NS}script")))
                self.assertFalse(list(root.iter(f"{NS}foreignObject")))
                content = file.read_text(encoding="utf-8")
                if name.startswith("account-"):
                    self.assertIn("PUBLIC GITHUB SNAPSHOT", content)
                    self.assertIn("@AdityaSreevatsaK", content)
                    self.assertNotIn("SYNTHETIC DEMO", content)
                else:
                    self.assertIn("SYNTHETIC DEMO", content)

    def test_personal_account_stills_have_source_backed_cargo(self):
        import json
        snapshot_path = ROOT / "fixtures" / "adityasreevatsak-public-activity.json"
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
        self.assertEqual(snapshot["source"], "github")
        self.assertEqual(snapshot["user"]["login"], "AdityaSreevatsaK")
        self.assertGreater(len(snapshot["activity"]), 100)
        for layout in ("isometric", "pixel"):
            for theme in ("dark", "light"):
                file = EXPORTS / f"account-{layout}-{theme}-still.svg"
                root = ET.parse(file).getroot()
                parcels = [el.attrib for el in root.iter() if "data-package" in el.attrib]
                self.assertGreater(len(parcels), 0)
                self.assertLessEqual(len(parcels), 14)
                self.assertTrue(all(item["data-repo"].count("/") == 1 for item in parcels))
                self.assertTrue(all(not item["data-repo"].startswith("sample-dev/") for item in parcels))

    def test_stills_are_motion_free(self):
        for file in EXPORTS.glob("*still.svg"):
            with self.subTest(name=file.name):
                text = file.read_text(encoding="utf-8")
                self.assertNotIn("animateMotion", text)
                self.assertNotIn("<style>", text)
                self.assertNotIn('class="travelling"', text)

    def test_latest_week_machines_match_shared_demo(self):
        svg = (EXPORTS / "isometric-dark-still.svg").read_text(encoding="utf-8")
        self.assertIn('data-repo="sample-dev/harbour"', svg)
        self.assertIn('data-repo="sample-dev/ember"', svg)
        self.assertIn('data-kind="commit"', svg)
        self.assertIn('data-kind="pr_opened"', svg)
        self.assertNotIn('data-repo="sample-dev/orbit"', svg)
        self.assertIn('data-week-index="51"', svg)

    def test_stills_have_source_linked_parcels_even_without_animation(self):
        for filename in ("isometric-dark-still.svg", "pixel-light-still.svg"):
            with self.subTest(filename=filename):
                root = ET.parse(EXPORTS / filename).getroot()
                parcels = [element.attrib for element in root.iter() if "data-package" in element.attrib]
                self.assertEqual(len(parcels), 2)
                self.assertEqual(
                    [(p["data-package"], p["data-day"], p["data-repo"], p["data-units"]) for p in parcels],
                    [
                        ("commit", "2026-11-09", "sample-dev/harbour", "4"),
                        ("pr_opened", "2026-11-13", "sample-dev/ember", "1"),
                    ],
                )

    def test_selected_calendar_week_keyboard_metadata(self):
        root = ET.parse(EXPORTS / "isometric-dark-still.svg").getroot()
        weeks = [el.attrib for el in root.iter() if "data-week-index" in el.attrib]
        self.assertEqual(len(weeks), 53)
        self.assertEqual(len([w for w in weeks if w.get("tabindex") == "0"]), 1)
        active = next(w for w in weeks if w.get("tabindex") == "0")
        self.assertEqual(active["data-week-index"], "51")
        self.assertEqual(active["aria-pressed"], "true")

    def test_historical_previews_use_only_corresponding_activity(self):
        release = (EXPORTS / "isometric-light-release-week-still.svg").read_text(encoding="utf-8")
        inspect = (EXPORTS / "pixel-dark-inspection-week-still.svg").read_text(encoding="utf-8")
        self.assertIn('data-kind="release"', release)
        self.assertIn('data-repo="sample-dev/aurora"', release)
        self.assertNotIn('data-kind="pr_opened"', release)
        self.assertIn('data-kind="issue_opened"', inspect)
        self.assertIn('data-repo="sample-dev/orbit"', inspect)
        self.assertNotIn('data-kind="release"', inspect)


if __name__ == "__main__":
    unittest.main()
