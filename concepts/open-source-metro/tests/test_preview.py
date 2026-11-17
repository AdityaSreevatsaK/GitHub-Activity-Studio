"""Accessible browser preview and fixture-ledger regression checks (offline)."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest

CONCEPT = Path(__file__).resolve().parents[1]
ROOT = CONCEPT.parents[1]
sys.path.insert(0, str(CONCEPT))
from calendar_metro import normalise, preview_html  # noqa: E402

FIXTURE = ROOT / "shared" / "fixtures" / "demo-activity.json"


def sample() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class BrowserPreviewTests(unittest.TestCase):
    def test_calendar_preview_is_scrollable_only_within_mobile_panel(self):
        html = preview_html()
        for item in ('class="map-viewport"', 'role="region"', 'overflow-x:auto',
                     'min-width:1050px', 'Swipe sideways'):
            with self.subTest(item=item):
                self.assertIn(item, html)

    def test_missing_variants_gracefully_fallback(self):
        html = preview_html()
        for item in ("const bundled=new Set", "const aliases=", "probe.onerror",
                     "role=\"status\"", "aria-live=\"polite\"", "locally generated variant"):
            with self.subTest(item=item):
                self.assertIn(item, html)

    def test_provenance_ledger_matches_shared_fixture(self):
        html = preview_html(normalise(sample()))
        for event_id in ("demo-001", "demo-005", "demo-010"):
            self.assertIn(event_id, html)
        self.assertIn("10 included source events; 0 outside the selected view", html)
        self.assertIn("UTC event provenance", html)
        self.assertEqual(html.count("<tr>"), 11)  # 10 event rows plus table heading
        self.assertNotIn("xlink:href", html)

    def test_user_supplied_event_ids_are_html_escaped(self):
        raw = sample()
        raw["activity"][0]["id"] = '<img src=x onerror=alert(1)>'
        html = preview_html(normalise(raw))
        self.assertIn("&lt;img src=x onerror=alert(1)&gt;", html)
        self.assertNotIn("<img src=x onerror=alert(1)>", html)

    def test_checked_in_browser_preview_matches_generator(self):
        html = preview_html(normalise(sample()))
        checked = (CONCEPT / "exports" / "preview.html").read_text(encoding="utf-8")
        self.assertEqual(checked.rstrip(), html.rstrip())

    def test_source_metadata_not_present_for_empty_demo(self):
        raw = sample()
        raw["repositories"] = []
        raw["activity"] = []
        html = preview_html(normalise(raw))
        self.assertIn("No recorded events in the displayed calendar.", html)
        self.assertNotIn("demo-001", html)


if __name__ == "__main__":
    unittest.main()
