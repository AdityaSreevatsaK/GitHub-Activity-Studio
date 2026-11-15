# GitHub Constellation

**Status:** concept prototype, not published on a profile. Example data is **synthetic demonstration data**, not actual contributions.

A quiet, animated atlas of public GitHub work. Each star is a repository, its size reflects its *reported GitHub star count*, each ring represents an individual sourced event, and every connecting arc means **shared primary programming language only**. For crowded datasets, one deterministic neighbour chain per language prevents a complete network of distracting lines. A travelling light marks an event on a connected repository, never a claim of collaboration.

## Requirements

- Windows 10/11 with Python **3.11 or later** (`py -3 --version`)
- A cloned copy of this repository
- No dependencies, tokens, accounts or network access required for the shared demo

## Windows PowerShell: copy and paste

Open **PowerShell** in the GitHub-Activity-Studio repository folder.

**1. Render eight self-contained exports** (two layouts × two themes × animated/still):

```powershell
py -3 concepts/constellation/constellation.py
```

**2. Open the interactive browser preview:**

```powershell
py -3 -m http.server 8000
```

Open <http://localhost:8000/concepts/constellation/preview.html> in your browser. Switch composition/theme, compare both layouts, pause motion, hover or Tab through stars to see counts. Press `Ctrl+C` in PowerShell to stop the server.

**3. Run the offline automated tests:**

```powershell
py -3 -m unittest discover -s concepts/constellation/tests -v
```

**4. Render your own *normalised public* snapshot** (contract described in `docs/DATA_CONTRACT.md`):

```powershell
py -3 concepts/constellation/constellation.py --input "C:\path\to\public-activity.json" --out "concepts/constellation/assets"
```

Only public GitHub URLs are accepted. There is no automatic collector; a future shared collector can produce contract-v1 JSON. Existing assets are synthetic demos until you replace them. Never commit private account information or tokens.

## Outputs

Generated files are in `concepts/constellation/assets/`:

| Composition | Night sky | Paper chart |
| --- | --- | --- |
| Orbital | `radial-night-animated.svg` | `radial-paper-animated.svg` |
| Language clusters | `clustered-night-animated.svg` | `clustered-paper-animated.svg` |

Each animated file has a matching `*-still.svg` fallback. Outputs are 1200 × 375 (16:5), self-contained SVG, designed for a GitHub README image embed:

```md
![Animated GitHub Constellation: star sizes show repository stars, arcs show shared languages, pulses replay recorded activity.](https://raw.githubusercontent.com/OWNER/REPO/BRANCH/concepts/constellation/assets/radial-night-animated.svg)
```

**GitHub rendering status:** Files are valid standalone SVG and intended for Markdown image embedding. Animation support through GitHub image proxy, screen-reader accessibility and automatic dark/light asset selection **have not been verified in an actual GitHub profile README**. The static `*-still.svg` is the reliable fallback. HTML/JavaScript preview **cannot** be embedded in GitHub READMEs. No changes to any live profile have been made.

## Design decision

- **Orbital (recommended for a README):** narrative, memorable, legible for the five-repository fixture, with meaningful negative space and an editorial legend.
- **Language clusters:** immediately communicates why stars connect; scales more naturally as language groups grow. For 5+ distinct languages or over nine radial stars, a stable staggered grid protects labels.
- **Night sky:** restrained celestial light and fine grain. **Paper chart:** cartographic grid, vellum and ink, not merely recolouring.
- Each of the **150 most recent unique events** at most emits one pulse in source timestamp order across a 16-second loop. If the snapshot contains more, the export explicitly labels the replay limit; all event units remain included in totals. `count` changes the ring size but does not imply additional events. Travelling glints only follow explicitly justified same-language connections.
- At most 15 repositories are shown, chosen by recorded activity units then full name. The export states how many were omitted. Name order fixes positions within the displayed set; a changed top-15 selection can alter placement. All source times must be UTC, and duplicate event IDs are counted only once.

## Accessibility and limitations

- Generated SVGs provide `<title>`, `<desc>`, per-repository link titles and keyboard-focusable anchors. Browser preview has a focus inspector and resizes without horizontal scrolling.
- `prefers-reduced-motion: reduce` disables CSS pulses and travelling particles; manual pause is available in the preview. Static exports have no animation elements or animated star styles.
- Event types include commits, PR openings, PR merges, issue openings and releases. Aggregating **activity units** is not aggregating commits; PR opened and merged remain distinct. These are snapshot events, not a complete GitHub contribution graph.
- This renderer does not use GitHub APIs, pagination, private repositories, secrets or paid services. An upstream collector will need documented visibility/recency/pagination limits, ownership checks and API caching.
- Browser preview uses generated demo SVGs; refresh the exports after changing input. Static SVGs will not auto-update. Busy (>15) datasets require an explicitly filtered view.
- SVG motion via SMIL is supported in modern standalone browsers, but animation inside a GitHub profile image proxy remains **unverified**. Browsers without SVG motion support show a useful still chart.

## Development checks

Tests cover schema validation, invalid UTC offsets/URLs/counts, malicious labels, duplicate IDs, empty/single/crowded views, stable rendering, factual language links, static fallback and all eight XML exports. Uses Python standard library only.