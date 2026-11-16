# Next iteration: three unmistakably GitHub-first constellation prototypes

**Status: NOT YET IMPLEMENTED.** This is the concrete build specification approved after the owner rejected the original standalone repository constellation and the complex signal-lens revision. Treat the existing illustrations as legacy references only, not accepted deliverables.

**Branch:** `concept/constellation`  
**PR:** https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio/pull/1 (must stay draft)  
**Scope:** `concepts/constellation/` only. See the nested `AGENTS.md` for agent instructions and guardrails.

## Goal and measurable creative bar

Make a GitHub profile viewer immediately understand: **this is a year's contribution graph**, with active days represented by stars. The 53-week/7-day structure is the anchor, not an accent. A decorative constellation that can be mistaken for an unrelated astronomy graphic is a failure.

The desired benchmark is the clarity and delight of GitHub Snake **without copying** its mechanics or visual language. The first static frame should already feel professional; the last frame must be a satisfying, legible representation of the exact same dated source activity. Prioritise meaningful beauty, not maximal decoration.

## Three designs (each different in mechanics, not just palette)

### A. Comet Streaks: recommended first

**Single-line legend:** "Stars are active days. Brighter means more recorded activity. Comets are uninterrupted streaks."

- Keep a subtly rounded GitHub-like square lattice, chronological left to right.
- The calendar is always visible. On active days, a compact luminous star sits *inside* the calendar cell, not in a detached chart.
- For runs of consecutive active dates, animate a small comet along **that exact run**, visiting the cells in date order. A 1-day run shows no connecting comet. A gap breaks the trail.
- Longer runs can earn a longer **tail duration/length**; brightness cannot imply counts that are not in source.
- After the final comet, resolve into static stars and faint trace lines, with the lattice still easy to see.
- Background: tasteful cosmic depth, constellation ink and a few ambient motes; decorative dots must be visually segregated from data cells.
- Distinct light and dark visual treatments. Avoid an overly saturated rainbow or an unreadably dim profile-size result.

### B. Celestial Cartographer: premium/editorial

**Single-line legend:** "An observatory discovers each active day in your coding year."

- A small original telescope/observatory motif is positioned outside the grid so it never blocks data cells.
- Over a 12–16 second loop, a restrained scanning beam moves left to right through the **calendar weeks**. Recorded active dates reveal stars; empty/unknown dates stay neutral.
- The beam, the revealed stars and the month/weekday guides tell the story with minimal labels. Do not add a giant secondary panel.
- Finish on a fully revealed calendar with a tasteful editorial title and clear legend. The final still makes sense without the telescope in motion.
- Light should resemble a carefully printed observatory chart; dark can use restrained aurora glows.

### C. Starforge: playful/cinematic

**Single-line legend:** "The year's recorded activity forges a sky of stars."

- Use a tiny original forge/stellar foundry motif outside the calendar. It emits a sparkle aimed at a **specific recorded active date**.
- A particle travels to the cell and resolves into a permanent star. Events with `count>1` can change the sparkle size/intensity, not the number of invented events.
- Event replay is bounded and deterministic. Multiple events on a calendar day must end at **the same day cell** and never create fake days.
- Final starfield retains every empty square in the calendar grid, so it is unmistakably GitHub-shaped.
- Distinct character and motion from Cartographer's sweep and Comet's streak traversal. Avoid recycling the identical animation with different colours.

## Visual output contract

For **each** prototype:
- Dark/night and light/paper theme, self-contained animated export and static fallback.
- Wide profile-friendly SVG (about 16:5; retain readability at normal README embed widths), with a **12–16-second replay**. If SVG animation is blocked by the GitHub image proxy, use accessible, documented GIF or static fallback; do not pretend it works.
- True 53×7 date positions with visible calendar skeleton; dates derived from source snapshot UTC, no arbitrary scattering or shifting to flatter the visual.
- Clear `DEMO` label on fixture-based assets, legend and alt/description. Include a minimally labelled static version that survives README downsizing.
- Browser preview with 3 design choices, 2 themes, optional side-by-side comparison, pause/reduced-motion and hover/focus to inspect the actual dated activity.
- A reproducible output generation command and screenshots/exports **committed to the branch**. README must embed the static images; PR must show them too.

### Data contract decision

- First build/test entirely offline using the shared contract-v1 sample. It contains ten **synthetic recorded events**, not 371 source-complete days.
- Do not claim a blank cell is zero contributions on GitHub. For this fixture, blank means **no event in sample**.
- The legend must say "recorded activity units" rather than official GitHub contributions when displaying sums of different `kind` values. Convert source-backed `count` to daily intensity with explicit thresholds or quantiles; keep exact values inspectable.
- Event IDs deduplicated; UTC dates; PR open versus PR merge distinct; invalid data rejected or clearly handled. Streak computation uses the dates of recorded activity, joined **only when calendar-day difference == 1**.
- A full real GitHub contribution calendar may be added **later**, through a separately documented concept-local public-only experimental adapter using GitHub's authorised contribution-calendar API. It must not silently map arbitrary repository events onto GitHub's official contribution counts or alter the shared contract.
- Do not use hardcoded fake activity to make example art look fuller. For visual review, you may create additional **explicitly labelled synthetic stress-test fixtures inside this directory**, never presented as the owner's history. Preserve the shared demo as-is.

## Practical implementation sequence

1. Read root and nested `AGENTS.md`, `docs/DATA_CONTRACT.md`, `docs/prompts/01-constellation.md`, current concept README, `calendar_sky.py` and both test files.
2. Define a single, tested calendar model used by all three prototypes (date-to-cell, summed source units, known/unknown coverage, sorted unique events and consecutive active-day streaks). Avoid forked, inconsistent data semantics.
3. Build **Comet Streaks** to a high visual bar first; render night/paper stills and one complete loop. Inspect at full and at small GitHub README dimensions. Fix the *look* before moving on.
4. Build **Celestial Cartographer** and **Starforge** with genuinely different compositions, motion cues and original artwork. Give each one a distinct purpose beyond the colour scheme.
5. Implement browser controls and accessible, responsive inspection; show all six static variants side by side in the concept README and attach two/three strongest full-size previews in PR #1.
6. Run tests and browser smoke locally. Open the **actual GitHub-rendered branch README** and confirm the stills; test animation in GitHub's image proxy rather than assuming it works. Fix broken links and oversized exports.
7. Record objective pass/fail, trade-offs and a short recommendation. Keep PR #1 **draft**, do not merge or touch the user's profile. Request design selection after all three render.

## Regression cases the next agent must cover

- All 371 calendar cells (and no accidental additional future-day claims), correct Sunday/Monday week alignment and year boundaries including leap years.
- One isolated activity day gives one star and **no comet trail**; consecutive UTC dates yield one correct run; a missing day **breaks** the streak.
- Multiple events for one day aggregate without duplicating a day; repeated event IDs are ignored; `count>1` changes intensity but cannot create fictional extra event dates.
- Empty snapshot, only one repository, high-density stress data, invalid URLs/markup, malicious names, missing optional fields, malformed counts and timestamps.
- Same source -> identical exports, all three designs and both themes valid SVG, animated versus truly still exports, reduced-motion and accessible descriptions.
- Browser: selector (3 designs), theme (2 choices), pause, focus/hover, small-screen horizontal overflow and legibility at realistic README dimensions.
- No external fonts, trackers or keys needed for offline preview or tests.

## Explicit non-goals

- No new independent concepts such as Code Factory, Metro or Agent Swarm.
- No portfolio landing page, extra charts/metrics panels, generic GitHub card or hypothetical repository collaboration network.
- No mandatory GitHub token for the offline prototype; no unapproved profile installation or `master` merge.
- No more design-only write-ups as a substitute for implemented files.

**Definition of done:** three runnable, polished, clearly different *GitHub contribution-calendar* visualisations in both themes, each with honest source-backed activity, an animated and still export, readable browser/GitHub previews, reproducible Windows commands, automated tests and an updated **draft** PR #1.
