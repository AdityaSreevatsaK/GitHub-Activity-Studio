# Shared input contract (v1)

All concepts should accept the same **normalised snapshot**, so that the designs can later be compared against the same input. For the initial prototype consume `shared/fixtures/demo-activity.json` using its structure.

## Required JSON shape
```json
{
  "schema_version": "1",
  "source": "demo",
  "generated_at": "2026-11-16T00:00:00Z",
  "user": {"login": "sample-dev", "url": "https://github.com/example"},
  "repositories": [
    {"full_name": "sample-dev/aurora", "name": "aurora", "url": "https://github.com/example", "language": "Python", "stars": 0}
  ],
  "activity": [
    {"id": "demo-1", "kind": "commit", "repo_full_name": "sample-dev/aurora", "occurred_at": "2026-11-01T10:00:00Z", "url": "https://github.com/example", "count": 1}
  ]
}
```

Field rules:
- `source` is `demo` or `github`. Label demo output unambiguously.
- `id` identifies a unique source event; deduplicate by this ID.
- `kind`: `commit`, `pr_opened`, `pr_merged`, `issue_opened`, or `release`. Do not silently equate opening a PR with merging it.
- `count` is a positive integer representing source-backed activity units, normally 1. Do not sum unlike events and call the sum "commits".
- `occurred_at` and `generated_at` are ISO 8601 UTC timestamps.
- Repositories must be referenced by `full_name`; names may duplicate between owners.
- Names and metadata are untrusted input: escape rendered labels and URLs, validate types/limits and handle missing optional fields.
- Never fetch private repositories or invent missing events. GitHub APIs do not expose the complete contributions graph through every endpoint; document coverage and limits of any collector.
- Keep visualisation engine separate from a future GitHub collector. All five designs must render offline from the same fixture.
- Make truncation and filtering explicit in the UI or supporting documentation; disclose API pagination and recency constraints.

A shared live-data collector is a **later** cross-concept decision. Do not independently add five competing collectors to root/shared. Each concept may implement a private experimental adapter under its own directory.
