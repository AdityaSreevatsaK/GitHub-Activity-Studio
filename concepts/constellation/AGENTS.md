# GitHub Constellation: instructions for the next implementation agent

> **Scope:** This file applies only to `concepts/constellation/`. It extends, and does not override, the repository-level `AGENTS.md`. The decisions here reflect subsequent owner feedback and supersede earlier **visual direction** in `docs/prompts/01-constellation.md`, but never its safety, provenance, branch-isolation or testing requirements.

## Assignment and permissions

- Repository: https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio
- **Only working branch:** `concept/constellation`. Existing **draft PR #1** targets `master`: https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio/pull/1
- **Only owned paths:** `concepts/constellation/**`. Do not edit the root `AGENTS.md`, shared fixture, data contract, other concepts, `master`, GitHub settings, releases or `AdityaSreevatsaK/AdityaSreevatsaK`.
- Implement real code, tests and export assets, and update the existing draft PR with visual previews. **Never merge without the owner's explicit approval.**
- Read root `AGENTS.md`, `docs/DATA_CONTRACT.md`, `docs/prompts/01-constellation.md`, this file, `NEXT_ITERATION.md`, and the local `README.md` before changing code. Prefer Python 3.11+ and the standard library, Windows PowerShell support, deterministic rendering, offline tests and optional read-only access to public GitHub data.

## Critical owner feedback: what failed

The original radial/clustered map was a picture of repository stars and **did not resemble a GitHub contribution chart**. The follow-up calendar-with-nebula/signal-lens designs were perceived as visually underwhelming, cluttered and **not immediately understandable**. Do **not** solve this by adding more atmospheric decoration, dashboards, arbitrary constellation lines, repository spotlights or a second explanatory timeline.

**Primary design principle:** A viewer should recognise the GitHub contribution calendar and understand the animation **within five seconds**, without instructions.

**A one-sentence visual story:** *A year of contributions, written in the stars.*

Viewer interpretation:
1. Each calendar position is a real day; lit positions indicate recorded activity for that day.
2. Brighter stars indicate **more activity according to the input's documented measure** (never confuse mixed event units with GitHub's official contribution counts).
3. Constellations or motion appear **because of** recorded days, not invented relationships.
4. Comet trails represent **consecutive active dates** only, not generic connections between repositories.

Retain the familiar **53-column × 7-day** GitHub calendar, months/weekdays where practical, clear intensity legend, visible active dates and the same dates in a motionless still. In both themes keep readability at typical GitHub-profile width. Use animation to reveal meaning, not obscure it.

## Deliver THREE genuinely distinct prototypes

Work through `NEXT_ITERATION.md` and implement all three **under this directory** with shared input validation and stable time-to-cell mapping. Each must have distinct motion language, spatial composition and a convincing final still; changing colours alone is insufficient.

1. **Celestial Cartographer:** a small original observatory/telescope/search beam sweeps across the calendar in date order, revealing active days as stars. The calendar remains the main object, not a background.
2. **Comet Streaks:** consecutive active days create luminous, directional streaks; longer verified runs produce longer trails. Isolated active days stay as individual stars. This is the first priority for clarity and memorability.
3. **Starforge:** activity sparks land on their **true dates**, forging individual day-stars; brightness relates to the documented units. A satisfying build-up resolves into the same unchanged calendar. Avoid implying one spark equals one GitHub contribution unless data supports it.

Provide **night** and **paper/light** themes for each; animation around **12–16 seconds**, accessible reduced-motion and fully motionless fallbacks. Aim for polished, original, charming artwork; no copying Snake or the existing Constellation FX projects.

## Strict data honesty

- Shared fixture: `shared/fixtures/demo-activity.json`, **10 synthetic events**. Demo exports and captions must say **SYNTHETIC DEMO**, never suggest it is the owner's contribution history.
- This is a sparse **event sample**, not a complete annual contribution history. Unlit fixture cells mean **not represented in the snapshot**, not verified zero contributions. **Do not fabricate a fuller chart or green activity squares.**
- Source contract `docs/DATA_CONTRACT.md`: deduplicate event IDs, UTC dates, supported kinds, positive `count`; never describe sums of mixed events as commits or GitHub's official contribution count. PR opened and PR merged are distinct kinds.
- For authentic annual GitHub counts, research `contributionsCollection.contributionCalendar` (GraphQL), date/visibility/rate-limit scope and API access. A **concept-local optional experimental adapter** may be appropriate; do not independently alter `shared/` or replace the shared contract. Label official calendar counts differently from event-sample units. Never need a token in CI or leak credentials or private data.
- Decorative background stars are allowed only when unmistakably decorative and never visually indistinguishable from contributions. Every highlighted calendar day and every streak must be traceable to input dates.

## Implementation expectations

- Reuse or refactor useful parts of `calendar_sky.py`, `preview.html` and tests. The current `calendar-*-*.svg` exports and `constellation.py` are **legacy explorations, not an approved final design**. Retain until replacements can be compared and validated.
- Keep visualisations self-contained and GitHub-compatible: no JS dependency inside exported SVG/GIF, no off-site assets/tracking, clear still fallback, keyboard-friendly interactive browser preview, narrow-screen support, semantic legends/alt text and `prefers-reduced-motion` behaviour.
- Place three side-by-side, recognisably different GitHub-rendered previews in the **concept README** and the **existing draft PR**. Link animated exports. Only claim GitHub animation works if verified in a real rendered README; otherwise clearly label it unverified.
- Windows instructions must work from a fresh checkout and generate assets offline. Reproduce results deterministically from identical inputs.

## Acceptance / what to test

- A 5-second comprehension test: with labels minimised, a viewer can tell it is a GitHub contribution chart, tell which dates are active and understand what a comet/streak means.
- Full 53×7 positions and correct dates across years (including leap year, week alignment, time-zone boundaries); no invented activity; correct grouping, dedup and intensity scale.
- Streaks **only** join adjacent active calendar dates, never missing days. Isolated days do not become false streaks.
- Event-sample `count` semantics, privacy, URL escaping, empty days, single day, long streak, very crowded year, future dates, deterministic stills, theme contrast and static fallback.
- Automated Python tests and, where feasible, browser smoke checks for theme/prototype switching, pause, keyboard access and mobile overflow. No paid external calls in CI.
- Show **all three distinct rendered variants** on the branch README before requesting a design decision; do not claim completion after merely drafting concepts.
- Keep PR #1 a draft; document tested versus unverified aspects. Do not change other concepts or the owner's profile.

**Next action:** Execute `NEXT_ITERATION.md` rather than writing another handoff/strategy memo. This file captures the approved direction, not evidence that the three prototypes have already been built.
