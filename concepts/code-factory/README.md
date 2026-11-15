# Code Factory

Two tiny, original, procedurally illustrated GitHub activity factories. **Prototype using synthetic demonstration data**, not a live contribution history. **Not deployed to any GitHub profile.**

| Isometric workshop (primary) | Side-scrolling pixel works |
| --- | --- |
| ![Demo isometric factory, dark theme](exports/isometric-dark-still.svg) | ![Demo pixel factory, light theme](exports/pixel-light-still.svg) |

**Animated exports:** [Isometric, dark](exports/isometric-dark.svg) · [Isometric, light](exports/isometric-light.svg) · [Pixel, dark](exports/pixel-dark.svg) · [Pixel, light](exports/pixel-light.svg)

## Windows PowerShell quick start

Requires **Python 3.11+** and a local checkout. No API tokens, paid services, external JavaScript libraries or Python packages are needed.

```powershell
git clone https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio.git
cd GitHub-Activity-Studio
git switch concept/code-factory
python concepts/code-factory/factory.py
python -m unittest discover -s concepts/code-factory/tests -v
python -m http.server 8000
```

Open **http://localhost:8000/concepts/code-factory/preview.html** in your browser. Press **Ctrl+C** to stop the server. The preview has layout, theme, motion and replay controls. Your browser's reduced-motion preference starts in still mode.

To render your **own public-source normalised snapshot** (same [shared contract](../../docs/DATA_CONTRACT.md)):

```powershell
python concepts/code-factory/factory.py --input "C:\path\to\snapshot.json"
```

Supported options: `--layout isometric|pixel|both`, `--theme dark|light|both`, `--output PATH`. Files are deterministically regenerated and include 4 animated SVGs plus 4 still SVGs. **No GitHub collection or token access is implemented** in this concept.

## What moves, and why

- **Repository → station.** Five busiest repositories are shown. Ranking uses summed event units for visual selection only, never labelled as commit count.
- **Commit → mint parts** (teal), **PR opened → assemble** (blue), **PR merged → sealed crate** (amber), **issue opened → inspection ticket** (coral), **release → dispatch package** (violet). These are *metaphors*. A merge is never described as a deployment, nor an issue as a confirmed bug.
- Every displayed event gets exactly one moving package, with a **×N** badge for source `count`. Original timestamps determine ordering; playback compresses event time into a 12-second ambient loop. The loop does **not** claim real-time spacing or a CI pipeline.
- Legend counts use all unique, valid events, split by kind. Duplicate identical event IDs are ignored; conflicting IDs raise an error. This avoids double-counting.
- Overflow is **explicit**: at most five busiest repository stations and fifteen latest qualifying event records are drawn; the image announces how many records are shown. The legend still counts all valid event units.
- All activity is rendered offline from the snapshot; links and arbitrary HTML are never embedded from input.

## Profile integration and limitations

- Primary: `exports/isometric-dark.svg`, a standalone 1000 × 310 animated SVG, with `exports/isometric-dark-still.svg` as the motion-free fallback. Light-theme and pixel variants are included. All eight SVGs can be used as Markdown images with informative alt text.
- **GitHub README animation has not yet been visually verified on GitHub.** SVG animation support can vary with GitHub image delivery, browser and motion settings. Test a temporary README in a separate sandbox before selecting a design. If animation fails, use the shipped still SVG. Avoid implying a static SVG is animated on GitHub.
- Browser preview's JavaScript is **not** embedded in the SVG. GitHub does not execute it in a README. Pure SVG exports use SVG animation and CSS only. No hover interaction is required. Browser preview provides native controls and readable explanations.
- Preview scene is 1000 × 310 and responsively scales down. On very narrow screens, individual repository names may be hard to read; use the accessible description and preview for detail.
- The output mirrors only the event types present in the input. It cannot infer complete GitHub contribution history, build health, CI runs, deployments, commits from unobserved sources or missing API pages.
- Original assets are drawn with SVG primitives, without third-party sprites, fonts or dependencies. No private repo data or API credentials are bundled.

## Follow-up before public release

Verify animated SVG delivery in a rendered GitHub README, compare both themes at mobile width, consider an optional GIF renderer for environments that strip SVG motion, and evaluate multi-repository name collisions at tiny scale. Keep the prototype separate from the live profile until explicitly approved.
