# Agent instructions: GitHub Activity Studio

## Mission
Build five **genuinely different** visualisations of public GitHub activity. Do not clone Platane/snk or create generic GitHub profile cards. All five are prototypes until reviewed.

## Parallel-session isolation
1. Read `README.md`, `docs/DATA_CONTRACT.md` and your assigned `docs/prompts/NN-*.md`.
2. Work only on your assigned `concept/<slug>` branch and mainly in `concepts/<slug>/`. The branch must originate from the common `master` starting point.
3. Do not edit another concept directory, shared files, root `README.md`, or `AGENTS.md` without explicit cross-session coordination.
4. Do not merge, retarget branches, rewrite shared history, publish releases, change repo settings, or edit `AdityaSreevatsaK/AdityaSreevatsaK`.
5. Create or update a **draft pull request to master**, with screenshots or generated previews, how-to-run instructions, tests, trade-offs, known limits and any GitHub rendering verification. Leave review/merge to the owner.

## Shared principles
- The attached `shared/fixtures/demo-activity.json` is synthetic, and must visibly be labelled as a **demo** in previews. It must never be described as the owner's actual contribution history.
- Treat activity counts, timestamp provenance and ownership carefully. No guessed activity or invented achievements.
- Public data only unless the user explicitly changes that scope. No hard-coded tokens or private repository metadata in generated assets, logging or CI.
- Support `GITHUB_TOKEN` as optional read-only access; previews and tests must work without it. No paid API services.
- Use deterministic rendering (seeded or stable mapping); prefer Python 3.11+, standard library and small dependencies. Support Windows PowerShell.
- Provide a 16:5 or similarly wide profile-ready export plus an accessible browser preview. Avoid layout overflow at mobile widths.
- SVG/GIF content in README is not an arbitrary web application: verify an actual GitHub README render. An interactive HTML preview may use JS but the embedded export cannot depend on it.
- A minimal static fallback, dark/light visibility, accessible alt text, reduced-motion behaviour and reasonable file size are important.
- Handle empty activity, one repository, high activity, long names, missing metadata, duplicate events and time zones.
- Use mock/fixture data in automated tests and CI; never require network, API tokens or paid services in CI.

## Definition of done
A working reproducible prototype, a distinctive visual composition, example exported assets, a simple Windows run procedure, relevant tests, honest GitHub-compatibility notes, and a draft PR. No change to `master` without approval.
