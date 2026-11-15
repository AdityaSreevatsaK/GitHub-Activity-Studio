# Session 4: Open Source Metro

## Repo and workflow
Repository: https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio
Read `AGENTS.md`, `docs/DATA_CONTRACT.md`, and `shared/fixtures/demo-activity.json` first. Use the assigned existing `concept/...` branch, keep all implementation under your own `concepts/...` folder, and never modify the other concepts, root files, `master`, or the owner's live GitHub profile. Build actual code and tests, not just a design memo. Work independently from the other four sessions. Finish with a draft PR targeting `master`, but **do not merge it**.

## Required baseline
- Data-driven, reproducible, visually compelling animation based on the shared offline demo fixture.
- Original design, not a reskinned snake, GitHub stats card, or boilerplate landing page.
- Wide, compact output suitable for the GitHub profile README; browser preview and an exported SVG or GIF with a still-image fallback. State clearly which outputs have been verified in a rendered GitHub README.
- Demo labelling, dark/light support, responsive scaling, reduced motion, accessible explanation, sensible file sizes, no external runtime services.
- Windows PowerShell instructions from a fresh checkout; tests for empty and malformed data, duplicate events, stable output and the main rendering rules.
- Honest provenance: never invent real user activity, never need paid APIs in CI, never leak tokens.
- Add two or three representative preview images or sample exports to the PR. Include a short design rationale and what needs improvement before release.
- If you hit a technical limitation, implement the best working fallback and document it instead of claiming unverified success.

**Assigned branch:** `concept/open-source-metro`
**Owned directory:** `concepts/open-source-metro/`

## Concept
Create a beautiful animated schematic metro map for GitHub contributions. Repositories are stations. Activity moves as trains along meaningful, labelled 'lines'. The map should be informative at a glance and aesthetically good enough to stand alone as an open-source tool.

## Design requirements
1. Build a clean, intentionally routed schematic with 45-degree/90-degree paths, harmonious line colours and consistently spaced station labels.
2. Give the routes real semantics. A line may represent an activity category or a sequence of dated events; do not fabricate relationships between unrelated repositories or imply contributions were made to another user's repositories.
3. Animated trains indicate the direction/order of actual recorded events; stations light up on arrival and provide a legible repository and event identifier.
4. Produce a small 5-station map and an extended 15+ station stress preview; prevent overlapping labels, excessively long routes and unreadable crossings.
5. Offer two art directions: modern metropolitan map and elegant vintage transport diagram. Choose a primary profile export.
6. Include a key, light/dark modes, still image, reduced motion, descriptive alt text, and optional browser hover/focus details.
7. Keep links clickable in browser demo only where the underlying URL is genuine and safe. The static GitHub-embedded image need not support click targets.

## Technical direction
Use deterministic graph layout and testable event ordering. Python 3.11+ to produce standalone SVG preferred, minimal dependencies. Avoid real transit logos and trademarks. Verify readability at narrow GitHub profile size.

## Acceptance
A crisp, unique metro visual with a defensible explanation of every route, a working animation loop, tests of layout/ordering, an export suitable for a README, and draft PR previews comparing the two art directions.
