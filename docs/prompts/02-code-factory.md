# Session 2: Code Factory

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

**Assigned branch:** `concept/code-factory`
**Owned directory:** `concepts/code-factory/`

## Concept
Design a tiny, original animated pixel/isometric factory. Each repository is a labelled production station. Activity becomes material moving through machinery: commits supply parts, PR openings assemble items, merges complete shipments, issues appear as inspection tickets, and releases dispatch finished packages. These are explicitly **visual metaphors**, not claims about actual CI or shipping events.

## Design requirements
1. Start with a coherent small factory scene that is legible at a roughly 1000x300 profile aspect ratio. Use original assets drawn in code.
2. Animate conveyor belts, machine cycles and short-lived events linked to fixture records, with deterministic timing and no invented metrics.
3. Make the event vocabulary obvious through a compact legend and visual cues; show a few visually distinct machines instead of a wall of widgets.
4. Deliver two variants: an industrial isometric floor and a cleaner side-scrolling pixel factory. Use one as the primary export.
5. Ensure the loop resolves cleanly, does not visibly jump, and is not dependent on hover. Browser preview may have accessible details/tooltips.
6. Make light and dark themes, static/reduced-motion mode, empty factory state and overflow strategy for many repositories.
7. Document exactly what the animation reflects, and avoid suggesting that a merge represents a real deployment.

## Technical direction
Prefer procedural geometry and 2D sprites/tiles authored in this repository; do not use borrowed game sprites or copyrighted character art. Python-generated frames/SVG plus minimal Pillow for GIF is acceptable; a browser preview may use HTML/CSS/JS. Keep generated assets small and reproducible.

## Acceptance
An engaging, original animated production line, visible relationship to the underlying events, reproducible profile export, a playable local preview, tests for event mapping and safe rendering, and a draft PR containing both major visual variants.
