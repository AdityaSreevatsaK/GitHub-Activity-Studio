# GitHub Activity Studio

## Open Source Metro | Five straight metro lines inside GitHub's contribution grid

The redesigned **Metro Atlas** keeps the familiar GitHub contribution calendar and overlays **five straight, parallel, non-intersecting activity lines** inside the gaps between day rows. Each colour-coded metro station marks a week with an event of that type. Numbered terminal markers identify repositories on specific activity dates. These are **synthetic design previews**, not the owner's actual contribution history.

**Modern Metropolitan (invented demo events, explicitly labelled)**

![Synthetic midnight contribution-calendar map with five straight horizontal activity lines in day-row gutters, weekly platform stops and numbered repository terminals.](concepts/open-source-metro/exports/atlas-midnight-showcase.svg)

**Vintage Transit (the same invented demo events)**

![Synthetic vintage parchment contribution calendar with five straight parallel colour-coded metro rails and dated weekly stops.](concepts/open-source-metro/exports/atlas-parchment-showcase.svg)

**The exact shared fixture, without any invented history**

![Faithful ten-event Open Source Metro diagram using only the shared synthetic fixture.](concepts/open-source-metro/exports/atlas-midnight-fixture.svg)

**How to read:** squares are days; brighter greens mean more observed source units. **The five straight lines are CODE, PROPOSE, MERGE, DISCUSS and SHIP**. Small circles mark source-observed active weeks. **Numbered circles** mark specific repositories on actual recorded days. The rails between active weeks are schematic, not claims of daily activity.

[Technical documentation](concepts/open-source-metro/README.md) · [Draft PR #4](https://github.com/AdityaSreevatsaK/GitHub-Activity-Studio/pull/4)

---

### Previous Metro prototype

The earlier, sparsely populated design remains available for comparison in the [concept archive and generator documentation](concepts/open-source-metro/README.md#earlier-calendar-metro-prototype). The new Metro Atlas illustrations above are the current exploration.

---

Five original, independently developed GitHub activity visualisations. Explore them, compare the results, then select one for a personal GitHub profile or develop a reusable open-source tool.

**Status:** concept exploration. No design is selected, released, or installed on a GitHub profile.

| Concept | Concept brief | Working directory | Development branch |
| --- | --- | --- | --- |
| GitHub Constellation | [Brief](docs/prompts/01-constellation.md) | `concepts/constellation/` | `concept/constellation` |
| Code Factory | [Brief](docs/prompts/02-code-factory.md) | `concepts/code-factory/` | `concept/code-factory` |
| Agent Swarm | [Brief](docs/prompts/03-agent-swarm.md) | `concepts/agent-swarm/` | `concept/agent-swarm` |
| Open Source Metro | [Brief](docs/prompts/04-open-source-metro.md) | `concepts/open-source-metro/` | `concept/open-source-metro` |
| Developer World | [Brief](docs/prompts/05-developer-world.md) | `concepts/developer-world/` | `concept/developer-world` |

## Working agreement

- Every concept has its own branch and directory. Work should be submitted through a **draft pull request**. No merging without explicit approval.
- Start by reading [AGENTS.md](AGENTS.md), the [shared data contract](docs/DATA_CONTRACT.md) and the appropriate concept brief.
- Build a useful preview from labelled demonstration data, plus a reproducible export suitable for a GitHub README.
- Prefer a compact, tasteful design to dashboards, generic statistic cards or ornamental images.
- Never modify the owner's profile repository or claim that a demonstration is real GitHub activity.
- Keep the Windows setup simple, security conscious, tested and inexpensive.

## Selection criteria

Compare the five candidates for visual identity, immediate clarity, animation quality, accurate representation of real activity, GitHub README rendering, accessibility, output size, maintenance burden and reuse by other GitHub users.

The final design is intentionally undecided. The concept briefs are design targets, not evidence of implementation.
