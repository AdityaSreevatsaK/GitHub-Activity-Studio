# Session 5: Developer World

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

**Assigned branch:** `concept/developer-world`
**Owned directory:** `concepts/developer-world/`

## Concept
Create a charming, original miniature world made of small islands and buildings. Each repository is a landmark with its own character; activity brings gentle changes such as lit windows, moving builders, growing gardens or boats arriving. The world evolves in **deterministic stages derived from known public activity**, not fabricated productivity scores.

## Design requirements
1. Develop a cohesive original pixel-art or low-poly-inspired world that stays legible in a wide, shallow GitHub README export.
2. Repositories become distinct buildings/islands. Display actual names or clearly corresponding labels in a nearby legend.
3. Create a data-backed progression rule: real recorded event counts unlock visible decoration thresholds. Clearly document thresholds, retain stable placements, and never claim fictional achievements.
4. Animate small environmental details (water, clouds, lanterns, builders), with activity-based changes meaningful beyond ambience.
5. Offer two layouts: archipelago from above and compact side-view village. Select one primary visual and explain trade-offs.
6. Keep assets original and procedurally drawn; avoid third-party game sprites. Support dark/light, paused/reduced motion, empty and overflow states.
7. Document growth snapshots with fixture updates, plus browser preview and fallback still for GitHub embedding.

## Technical direction
Prefer Python 3.11+, deterministic coordinate generation, small custom tile/sprite primitives, optional Pillow for multi-frame GIFs, and minimal local dependencies. Consider file-size carefully: large frame sequences can make a profile unusable.

## Acceptance
A genuinely attractive evolving world, with data-to-landmark progression, reproducible exports, test coverage of progression and edge cases, readable names at profile size, and a draft PR featuring both layout alternatives.
