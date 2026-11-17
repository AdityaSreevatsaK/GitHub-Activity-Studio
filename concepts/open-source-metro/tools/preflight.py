"""One-command, offline quality gate for Open Source Metro.

Usage on Windows:
  py -3 concepts\open-source-metro\tools\preflight.py

Runs every concept test and validates GitHub README exports. Never rewrites
checked-in assets and never accesses GitHub, credentials or external services.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sys
import unittest

# Direct invocation puts tools/ on sys.path; test-module loading may not.
TOOLS_DIR = str(Path(__file__).resolve().parent)
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)
from verify_readme_exports import validate_gallery, validate_reproducibility


def discover_tests(concept: Path) -> unittest.TestSuite:
    """Discover all concept-owned regression tests from any working directory."""
    return unittest.defaultTestLoader.discover(
        start_dir=str(concept / "tests"), pattern="test_*.py"
    )


def run_checks(concept: Path, *, stream=None) -> int:
    """Return exit status 0 only when tests and checked-in exports all pass."""
    if sys.version_info < (3, 11):
        print("Open Source Metro requires Python 3.11 or newer", file=sys.stderr)
        return 1
    if not (concept / "calendar_metro.py").is_file():
        print(f"Missing metro renderer: {concept / 'calendar_metro.py'}", file=sys.stderr)
        return 1
    if not (concept / "tests").is_dir():
        print(f"Missing test directory: {concept / 'tests'}", file=sys.stderr)
        return 1
    try:
        suite = discover_tests(concept)
        if suite.countTestCases() == 0:
            print("No tests discovered, refusing to report success", file=sys.stderr)
            return 1
        result = unittest.TextTestRunner(verbosity=2, stream=stream or sys.stderr).run(suite)
    except (OSError, ImportError, ValueError) as exc:
        print(f"Unable to run Metro tests: {exc}", file=sys.stderr)
        return 1

    print(f"Open Source Metro: {result.testsRun} tests run", file=stream or sys.stderr)
    if not result.wasSuccessful():
        return 1
    problems = validate_gallery(concept) + validate_reproducibility(concept)
    if problems:
        for issue in problems:
            print(f"FAIL: {issue}", file=stream or sys.stderr)
        return 1
    print("PASS: tests and 3 source-reproducible README exports", file=stream or sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run all offline Open Source Metro checks")
    parser.add_argument("--concept", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    return run_checks(args.concept.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
