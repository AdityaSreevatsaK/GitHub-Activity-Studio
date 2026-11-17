"""WCAG AA text contrast regression for the four Open Source Metro palettes."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from calendar_metro import THEMES


def relative_luminance(hex_color: str) -> float:
    text = hex_color.lstrip("#")
    if len(text) != 6:
        raise ValueError("Colours must be six-digit RGB values")
    values = [int(text[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    channels = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
    return sum(a * b for a, b in zip((0.2126, 0.7152, 0.0722), channels))


def contrast_ratio(foreground: str, background: str) -> float:
    first, second = sorted((relative_luminance(foreground), relative_luminance(background)))
    return (second + 0.05) / (first + 0.05)


class ThemeContrastTests(unittest.TestCase):
    def test_all_palette_text_meets_normal_text_aa(self):
        for (style, scheme), colours in THEMES.items():
            for foreground in ("ink", "muted"):
                for background in ("paper", "panel"):
                    with self.subTest(style=style, scheme=scheme,
                                      foreground=foreground, background=background):
                        self.assertGreaterEqual(
                            contrast_ratio(colours[foreground], colours[background]),
                            4.5,
                        )

    def test_vintage_secondary_text_has_headroom(self):
        colours = THEMES["vintage", "light"]
        self.assertGreater(contrast_ratio(colours["muted"], colours["paper"]), 4.6)


if __name__ == "__main__":
    unittest.main()
