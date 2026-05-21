# Pull Request: StrataForge Session v0 MVP

**Branch:** `feat/session-v0-mvp` → `master`  
**Repo:** [junebug-junie/strataforge](https://github.com/junebug-junie/strataforge)

## Summary

Introduces **StrataForge Session v0** — a local-first, human-in-the-loop architecture design pairing plane. Files (`strata.yaml`, topic Markdown, session/proposal JSON) are the source of truth; SQLite under `.strata/` is a rebuildable index.

This PR delivers the full MVP from the implementation plan (Tasks 1–21):

- **CLI (`strata`)** — init, validate, topic list/show, session/proposal flow, gated apply, radar, bounded prompt generation, index rebuild
- **Core** — manifest, topic store, session/proposal stores, validation (including frontmatter drift checks), apply engine with overwrite protection
- **Manual LLM mode** — paste proposal JSON, expansion/reconciliation prompts, deterministic coherence radar
- **FastAPI** — REST endpoints for projects, topics, sessions, proposals, radar, prompts
- **React UI** — atlas tree, topic editor (status/coverage gates + prompt copy), session panel (intake → import → accept/reject/defer/revise → apply), coherence radar
- **Ops** — Docker Compose (API `:8787`, UI `:8788`), README quickstart

Post-review hardening included: unique session IDs, session resume, revise API/UI, file-backed topic listing, import validation (422), CORS fix, UI API contract tests.

## Architecture

```
Files (authoritative)          SQLite (.strata/) — rebuildable cache
├── strata.yaml                ├── topics
├── areas/**/*.md              ├── sessions
├── sessions/*.json            ├── proposals
└── .strata/radar/latest.json  └── radar_cache

CLI + FastAPI → shared core modules → file writes gated by human proposal actions
```

## Test plan

- [x] `pytest` — **37 tests passing** (unit, integration, API smoke, E2E walkthrough, UI API contract)
- [x] E2E golden path: init → intake session → import proposals → accept/reject/defer → apply → validate → radar → expansion prompt → re-apply blocked without `--force`
- [x] Code review findings resolved (session collision, revise, UI prompts, validation drift, import 422)
- [ ] Manual UI smoke: `docker compose up --build` → http://localhost:8788
- [ ] Manual CLI walkthrough per `README.md`

## MVP acceptance (spec §28.4)

| Criterion | Status |
|-----------|--------|
| Initialize project workspace | ✅ |
| Paste design idea + proposal import | ✅ |
| Proposal cards with human gates | ✅ |
| Only approved → Markdown scaffolds | ✅ |
| Browse atlas tree | ✅ |
| Bounded LLM prompt from selected node | ✅ |
| Status/coverage gates | ✅ |
| Coherence radar queue | ✅ |
| No overwrite expanded without force | ✅ |
| `strata validate` / `strata radar` | ✅ |

## Deferred (post-MVP)

MCP server, autonomous agents, multi-user auth, vector search, background workers, React Flow dependency graph.

## Stats

- **23 commits**, **81 files**, **~8.4k lines** added
- Base: `master` (plan docs only) → `feat/session-v0-mvp`

## Commits

```
feat: add strataforge package skeleton and CLI entrypoint
feat: add settings and project path helpers
feat: add domain models and status transition rules
feat: add topic frontmatter parse and serialize
feat: add project init and strata.yaml manifest
feat: add topic scaffold creation, list, and show
feat: add project validation and strata validate command
feat: add session and proposal persistence with human actions
feat: add gated apply engine with overwrite protection
feat: add manual proposal JSON import for intake sessions
feat: add bounded expansion and reconciliation prompt generation
feat: add deterministic coherence radar scanner
feat: add rebuildable SQLite index for fast queries
feat: add FastAPI routes for MVP project/session/proposal flow
feat: scaffold React UI with API client
feat(ui): add atlas tree navigation
feat(ui): add topic detail with status and coverage controls
feat(ui): add session panel with proposal review and apply
feat(ui): add coherence radar panel
docs: add docker compose and MVP quickstart
test: add MVP end-to-end walkthrough coverage
fix: address code review findings for MVP readiness
```
