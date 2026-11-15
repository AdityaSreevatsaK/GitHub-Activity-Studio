# Session 3: Agent Swarm

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

**Assigned branch:** `concept/agent-swarm`
**Owned directory:** `concepts/agent-swarm/`

## Concept
Build an elegant 2D swarm of tiny geometric 'agents' moving around an engineering canvas. Repositories are task hubs and the agents ferry packets between them, co-operate on visual patterns and complete symbolic tasks for observed GitHub activity. It should suggest sophisticated AI engineering **without pretending that AI agents actually performed those GitHub actions**.

## Design requirements
1. Build a deterministic finite-state swarm (idle, assigned, travelling, working, complete) with stable agent paths. No paid LLM calls or actual GitHub writes.
2. Each repository is a recognisable task hub. Activity appears as a queued card or signal; assigned agents visibly transform it using simple symbols for commit, PR, issue and release.
3. Use graceful coordinated movement rather than chaotic boids. A looping 10–18-second choreographed sequence should be readable in a profile-sized asset.
4. Deliver two distinct styles: understated geometric swarm and playful miniature robot swarm, with one selected primary design.
5. Include a clear visual key, meaningful per-repository representation, browser preview with inspectable state and reduced-motion/static fallback.
6. Validate behaviour for zero events, bursty event loads and stale data. State that the animation is a metaphorical rendering of GitHub activity, not autonomous operations.
7. Support dark/light appearances without sacrificing contrast or particle visibility.

## Technical direction
Model simulation and rendered frames separately. Prefer seeded scheduling and pathfinding simple enough to test. Python+SVG or Python+Pillow output and a simple HTML preview are suitable. Do not use remote assets or require a live agent framework.

## Acceptance
A working, visually satisfying swarm with measurable event-to-action transitions, deterministic replay, easily verified tests and GitHub-embeddable media. Explain why it is original and what makes its agent metaphor trustworthy.
