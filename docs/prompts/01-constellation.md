# Session 1: GitHub Constellation

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

**Assigned branch:** `concept/constellation`
**Owned directory:** `concepts/constellation/`

## Concept
Build a striking, restrained, animated star map of public GitHub work. Repositories are stars with stable, legible positions. Recent activity creates brief pulses, brightening and travelling particles. Larger stars may reflect *labelled* stars or other known metadata; activity intensity should be shown separately rather than conflated with repository popularity.

## Design requirements
1. An intentional, beautiful composition rather than random dots. Use a deterministic layout with enough whitespace and clear labels for 5–15 repositories.
2. Repositories are distinct star systems; time drives pulses; visible lines or arcs should represent **defined, defensible relationships** (for example shared language, not invented collaboration).
3. A gentle 10–18-second loop with readable animation at README size. Avoid screen-covering glow and distracting motion.
4. Build a browser preview where hovering/focusing a star reveals repository name, metadata and event counts; an exported self-contained SVG/GIF for embedding must remain understandable without hover.
5. Support a light 'paper chart' theme and dark 'night sky' theme that differ in more than background colour.
6. Provide an empty-state sky, crowded-state layout strategy, long-label collision handling, and alt text/caption describing the diagram.
7. Compare at least two compositional variants locally: radial constellation and clustered starfield. Choose one, explain why, and include both in PR assets if practical.

## Technical direction
Python 3.11+ is preferred for deterministic layout and SVG authoring; use minimal dependencies. Use a fixed seed or sorted metadata to stabilise positions. Simulate particles only from provided activity data, and keep browser animation separate from any GitHub-only fallback. No off-site image requests or tracking.

## Acceptance
A complete runnable renderer, side-by-side theme previews, meaningful event-to-motion mapping, deterministic snapshot tests and clear export instructions. The result should feel polished in a GitHub README, not like a scientific chart.
