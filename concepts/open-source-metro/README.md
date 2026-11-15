# Open Source Metro

A deterministic, offline **metro map for public GitHub activity**. Repositories are named station columns; the five colour-coded services correspond to source event kinds. Tiny trains replay source events in UTC timestamp order. Sharing a service does **not** imply repositories depend upon or collaborate with one another.

All checked-in examples use the repository's **synthetic demo fixture**, not anyone's actual GitHub activity.

## Design gallery

**Contemporary metropolitan map, night (primary profile candidate)**

![Synthetic demo, contemporary metro design with event routes and station names](exports/modern-dark-still.svg)

**Vintage transport diagram, day**

![Synthetic demo, paper-coloured vintage transport diagram](exports/vintage-light-still.svg)

**17-station stress test (synthetic extensions of the shared fixture)**

![Synthetic demonstration with 17 repository stations across three districts](exports/stress-modern-dark-still.svg)

Animated versions: [contemporary metro](exports/modern-dark.svg) · [vintage transport diagram](exports/vintage-light.svg). The static exports are the reliable fallback for GitHub READMEs. Whether GitHub actually plays SMIL animation in its image proxy has **not** been independently verified; do not promise animation on a live profile until tested in a temporary README.

## Windows: run from a fresh clone

**Prerequisites:** Windows PowerShell, Git, Python 3.11+ (`py -3 --version`), and a browser. No `pip install`, account, token, API request or paid service is required.

Open **PowerShell**, then paste:

```powershell
git clone https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio.git
cd GitHub-Activity-Studio
git switch concept/open-source-metro
py -3 .\concepts\open-source-metro\metro.py
Start-Process .\concepts\open-source-metro\exports\preview.html
```

In the browser preview choose a **design**, **day/night scheme**, **animation/still**, and **5-station/17-station network**. Hover or keyboard-focus a platform to inspect source event IDs, dates and counts. The preview automatically starts with motion disabled when your system requests reduced motion.

To run automated tests:

```powershell
py -3 -m unittest discover -s .\concepts\open-source-metro\tests -v
```

To export your own **normalised, public-only** snapshot:

```powershell
py -3 .\concepts\open-source-metro\metro.py --input C:\path\to\activity.json --output .\concepts\open-source-metro\exports
```

The snapshot must follow [`docs/DATA_CONTRACT.md`](../../docs/DATA_CONTRACT.md). This concept does **not** fetch GitHub data; an API collector requires separate review. Do not supply private repository data.

## Design semantics

| Service | Source event | Visual consequence |
| --- | --- | --- |
| **CODE** | `commit` | Teal/green train visits recorded commit platforms |
| **PROPOSE** | `pr_opened` | Coral train visits opened-PR platforms |
| **MERGE** | `pr_merged` | Violet train visits merged-PR platforms |
| **DISCUSS** | `issue_opened` | Gold train visits issue platforms |
| **SHIP** | `release` | Blue train visits release platforms |

The station columns are ordered by **first recorded event**, then repository full name. Each line is its own dedicated service. A platform appears only if that repo has an event of the service's kind. Each train's path goes through its service's events in `(occurred_at UTC, id)` order, including revisits. The train returns to the start at the loop boundary, marking a replay restart, **not** a new contribution. A number beside a platform is the sum of `count` units for that type and repo, never a claim about commits for unrelated event types.

Modern uses luminous roundels, softened rails and a compact sans-serif hierarchy. Vintage uses double-keyline rails, diamond platforms, ink typography and a restrained paper palette. Both support day/night colour schemes, static fallbacks, keyboard-focusable SVG platform details and SVG reduced-motion media queries.

## Validation and limitations

- Stdlib-only Python source and 21 offline unit tests for schema validation, duplicate event IDs, sort stability, URL sanitisation, XSS-safe labels, four palettes, empty/single/long-name cases, 17 stations, explicit caps, and reproducible exports.
- Browser preview is a local HTML page. SVG motion uses SMIL; the browser must support `<animateMotion>`. No embedded JavaScript is required in the SVG export.
- First **18** repositories and first **240** events among them are rendered; omissions are declared in the image. For dense activity, the map is a curated view, not a complete contributions graph. The full 17-station stress output is intentionally **not** profile-wide in aspect ratio.
- Source `github` means a supplied normalised snapshot, not independently audited provenance. Only valid HTTPS github.com event links can be enabled for interactive source-`github` rendering via `render(..., browser_links=True)`; demo previews intentionally have no clickable links. A local export remains non-clickable.
- SMIL support in the GitHub README image proxy remains unverified. Prefer [the still profile candidate](exports/modern-dark-still.svg) unless a real GitHub README render confirms animation. No production data collector, automatic refresh, GIF export or GitHub Actions integration is included.
- All assets use system fonts. Appearance can vary by operating system, especially the vintage serif. A real-device mobile, screen-reader and GitHub proxy review should precede adoption.

**Scope:** this entire prototype lives under `concepts/open-source-metro/`; no shared/root files, releases, profile README or other concept branches are changed.
