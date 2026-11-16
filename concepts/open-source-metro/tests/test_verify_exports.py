"""Offline regression tests for the README SVG safety and reproducibility gate."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

TOOL = Path(__file__).resolve().parents[1] / "tools" / "verify_readme_exports.py"
spec = importlib.util.spec_from_file_location("verify_readme_exports", TOOL)
assert spec and spec.loader
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

SAMPLE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 540">
<title>Open Source Metro</title><desc>synthetic demo activity</desc>
<rect data-date="2026-11-01"/><g class="repository"/></svg>'''


class ExportGateTests(unittest.TestCase):
    def test_valid_export(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.svg"
            path.write_text(SAMPLE, encoding="utf-8")
            self.assertEqual(verify.validate_export(path), [])

    def test_missing_export(self):
        with tempfile.TemporaryDirectory() as temp:
            self.assertIn("Missing README preview", verify.validate_export(Path(temp) / "missing.svg")[0])

    def test_invalid_xml(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.svg"
            path.write_text("<svg><g></svg>", encoding="utf-8")
            self.assertTrue(any("invalid SVG XML" in issue for issue in verify.validate_export(path)))

    def test_script_and_external_links_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.svg"
            injection = '''<script xmlns="http://www.w3.org/2000/svg">alert(1)</script>
<a xmlns="http://www.w3.org/2000/svg" href="https://example.org"/>'''
            path.write_text(SAMPLE.replace("</svg>", injection + "</svg>"), encoding="utf-8")
            errors = verify.validate_export(path)
            self.assertTrue(any("forbidden embedded content" in error for error in errors), errors)
            self.assertTrue(any("external link" in error for error in errors), errors)

    def test_missing_accessibility_and_provenance(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.svg"
            path.write_text(SAMPLE.replace("<desc>synthetic demo activity</desc>", ""), encoding="utf-8")
            errors = verify.validate_export(path)
            self.assertTrue(any("accessible desc" in issue for issue in errors), errors)
            self.assertTrue(any("source provenance" in issue for issue in errors), errors)

    def test_missing_readme_reference_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "README.md").write_text("Synthetic examples only", encoding="utf-8")
            (root / "exports").mkdir()
            for asset in verify.PRIMARY:
                (root / "exports" / asset).write_text(SAMPLE, encoding="utf-8")
            issues = verify.validate_gallery(root)
            self.assertEqual(sum("does not embed" in issue for issue in issues), 3)

    def test_checked_in_previews(self):
        root = Path(__file__).resolve().parents[1]
        self.assertEqual(verify.validate_gallery(root), [])


if __name__ == "__main__":
    unittest.main()
