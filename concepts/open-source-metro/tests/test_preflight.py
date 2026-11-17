"""Tests for the offline Windows-ready Metro preflight."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

CONCEPT = Path(__file__).resolve().parents[1]
SCRIPT = CONCEPT / "tools" / "preflight.py"
spec = importlib.util.spec_from_file_location("_metro_preflight", SCRIPT)
assert spec and spec.loader
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class PreflightTests(unittest.TestCase):
    def test_discovery_runs_concept_tests(self):
        suite = preflight.discover_tests(CONCEPT)
        self.assertGreaterEqual(suite.countTestCases(), 67)

    def test_missing_renderer_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            self.assertEqual(preflight.run_checks(Path(temp)), 1)

    def test_tests_directory_required(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "calendar_metro.py").write_text("", encoding="utf-8")
            self.assertEqual(preflight.run_checks(root), 1)


if __name__ == "__main__":
    unittest.main()
