# Open Source Metro

**A GitHub-style contribution calendar turned into a metro network.** The familiar **53-week × 7-day grid** remains the centrepiece, while dated public activity becomes brightly marked stations and five coloured transit services.

The checked-in previews use the shared **synthetic demonstration fixture**, **not** the account owner's actual contributions. Only observed events from the supplied snapshot are plotted. A blank cell does **not** prove zero GitHub contributions.

## See both designs, rendered in this README

**Metropolitan, midnight (primary profile-size candidate)**

![Synthetic demonstration of a 53-week GitHub-style contribution calendar with green activity squares, numbered repository stops, and five coloured metro routes on a midnight background.](exports/modern-dark-still.svg)

**Vintage transport diagram, parchment**

![Synthetic demonstration of a vintage paper-coloured 53-week contribution-style calendar with diamond metro line markers, numbered repository stops, and fine cartographic rules.](exports/vintage-light-still.svg)

**Extended scale test: 17 synthetic repositories**

![Seventeen synthetic repository stations referenced beneath a 53-week source-activity calendar; dense same-day events are interchanges.](exports/stress-modern-dark-still.svg)

The still SVGs above are the intended GitHub README embeds. [Animated metropolitan SVG](exports/modern-dark.svg) · [Animated vintage SVG](exports/vintage-light.svg) · [Browser preview](exports/preview.html). GitHub's image proxy may not play SVG animations, so the still versions are the safe default.

## Reading the map

- **The calendar remains primary.** Columns represent 53 Sunday-to-Saturday weeks; rows represent days. Month headings, weekday labels and a green event-unit intensity key keep the familiar GitHub chart language.
- **Event units, not complete GitHub contributions.** Cells only count the source-backed `count` values in the normalised snapshot, even when they represent different event types. A filled cell indicates recorded activity; blank cells mean no event appears in this supplied snapshot. This is not a live API contribution graph.
- **Repository stations.** An active cell contains a small roundel numbered to match a repository in the station directory. If several repositories have activity on the same date, the calendar cell becomes an interchange and its numeral shows how many distinct repositories are present. Event IDs, source units and UTC dates are in accessible SVG titles.
- **Five meaningful metro services.** `CODE` = commits, `PROPOSE` = PRs opened, `MERGE` = PRs merged, `DISCUSS` = issues opened, `SHIP` = releases. Each line connects only chronological event stops **of its own type**. The diagram does not claim any relationship between repositories, nor does it treat a PR opened as a PR merged.
- **Two art directions.** Metropolitan uses luminous transit roundels and a restrained midnight palette. Vintage uses paper-coloured cells, double outlines, serif signage and diamond-line medallions. Both also offer light/dark variants.

## Windows PowerShell: generate and view

Requires **Python 3.11+** and Git. Everything runs offline after cloning. No `pip install`, API token, external font, hosted assets or paid service.

```powershell
git clone https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio.git
cd GitHub-Activity-Studio
git switch concept/open-source-metro
py -3 .\concepts\open-source-metro\calendar_metro.py
Start-Process .\concepts\open-source-metro\exports\preview.html
```

Browser controls select **design, colour scheme, still/animated replay and a 5- or 17-station scenario**. All combinations are included as generated SVGs when running the command above. For automated tests:

```powershell
py -3 -m unittest discover -s .\concepts\open-source-metro\tests -v
```

To render your own **public, normalised** JSON snapshot matching [`docs/DATA_CONTRACT.md`](../../docs/DATA_CONTRACT.md):

```powershell
py -3 .\concepts\open-source-metro\calendar_metro.py --input C:\path\to\public-activity.json --output .\concepts\open-source-metro\exports
```

For existing users of `metro.py`, its CLI delegates to the calendar-first generator. The previous stand-alone diagram's testable internals remain available for compatibility.

## Validation and limits

- Offline, deterministic, Python standard-library renderer and **22 calendar tests** in addition to the existing legacy regression suite. XML validity, Sunday alignment, UTC ordering, duplicate IDs, empty and single-repository cases, safe links, complete browser export variants, and the 17-station stress scenario are covered.
- The supplied demonstration fixture has **five repositories and ten source events** across August to November 2026. It is intentionally sparse across a full 53-week calendar. The 17-station stress demo is separately labelled as synthetic.
- The snapshot is **not** a complete GitHub contribution calendar. GitHub source APIs have differing coverage; a future public-data collector would need an independently reviewed data provenance and pagination contract.
- The renderer limits the directory to the first **18 repositories** and the first **240 selected-repository source events**; omissions appear in the footer. Historical events outside the visible 53-week range or events dated beyond snapshot generation are also excluded and counted as omitted.
- Browser links are opt-in via `render(..., browser_links=True)` for `source="github"` only, and only safe GitHub HTTPS links are allowed. Demonstration previews have no click-through links.
- Static SVGs are the GitHub-compatible exports. A GitHub README render, mobile browser and screen-reader accessibility pass should be checked before installing on a public profile. SVG animation in GitHub is not guaranteed.

**Scope:** changes are confined to this concept and the **branch-only landing README**. Other concepts, `master`, and the profile repository remain untouched. The draft PR remains unmerged.