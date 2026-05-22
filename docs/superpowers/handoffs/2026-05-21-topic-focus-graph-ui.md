# StrataForge — Topic Focus Mode + Atlas Graph UI

Handoff for a new agent session.

## Context

| | |
|---|---|
| **Repo** | `git@github.com:junebug-junie/strataforge.git` |
| **Branch** | `main` (MVP merged) |
| **Stack** | Python 3.11 (Typer CLI, FastAPI), Vite/React UI, Docker Compose |
| **Run** | `docker compose up --build` → UI at `http://127.0.0.1:8788/strataforge/`, API at `8787` |

StrataForge is a local-first HITL architecture design pairing plane. Files (`strata.yaml`, topic Markdown, session JSON) are authoritative. LLM integration is manual-paste-first (generate prompt → external LLM → paste JSON → human gates → apply).

### Key docs

- Spec: `docs/design/specs/mvp_20260520.md` (especially §5.2 Atlas, §14 Proposals, §18 Visual UI, §18.3 Topic detail, §18.6 Dependency graph)
- Original MVP plan: `docs/superpowers/plans/2026-05-20-strataforge-session-v0.md`
- `workspaces/` is gitignored — local runtime data only

---

## What's already on `main` (do not re-implement)

- Full intake → import → accept/reject → apply flow
- Server-built **augmented intake prompts** (`build_intake_prompt` in `strataforge/llm/prompts.py`, `GET .../sessions/{id}/prompts/intake`)
- Atlas as **topic pills** at top of main panel (`ProjectShell.tsx`, `AtlasTree.tsx`)
- Topic editor with gates, expansion/reconcile prompt copy (`TopicEditor.tsx`)
- Coherence radar panel
- Data model supports `parent`, `depends_on`, `feeds_into`, `blocks` on `TopicRecord` (`strataforge/models.py`)

---

## Problem (from user testing)

After intake + apply, users click an atlas topic (e.g. **Behavior Insights**) and get **no meaningful interactivity**:

1. **Active Pairing Session** still dominates the center — old proposal cards (`promoted to scaffold`, `create_component`, rationale) remain visible above the fold.
2. **Topic Detail** renders far below — requires scrolling past session history.
3. Users expect a **graph mental model**: flat areas from intake → hierarchy via decompose → cross-links via `depends_on` / `feeds_into`. Current UI is flat pills + read-only markdown body.
4. Clicking an atlas node should feel like **entering a workspace**, not re-reading intake proposal cards.

---

## Target UX (approved direction)

Implement **three layers**, not one scroll:

| Layer | Purpose | Default visibility |
|-------|---------|-------------------|
| **Atlas** | Navigate durable structure | Always visible (top bar) |
| **Topic workspace** | Design the selected node | **Primary** when a topic is selected |
| **Session** | Ephemeral proposals + gates | Collapsed tab/drawer — not default after apply |

**Selection = focus.** Clicking an atlas pill should switch the main panel to topic workspace. Session history becomes provenance ("Created via intake · promoted to scaffold"), not the main reading surface.

**Two geometries:**

- **Tree** = containment (`parent` / children) — from decompose
- **Graph** = relationships (`depends_on`, `feeds_into`, `blocks`) — from link proposals

Intake creates **flat sibling areas** (no edges). Edges come later via gated proposals.

---

## Mock layout (implement toward this)

```
┌─ Atlas ─────────────────────────────────────────────────────┐
│  Cat Profiles   Care Tracking   ●Behavior Insights   ...     │
└─────────────────────────────────────────────────────────────┘

┌─ Local graph (1-hop) ───────┬─ Topic workspace ──────────────┐
│  Care Tracking ──feeds──▶ ●  │ Behavior Insights              │
│  Cat Profiles ──events──▶ ●  │ scaffolded · needs design      │
│                              │ [Expand] [Decompose] [Add link]│
│                              │ Purpose / Boundary / Questions │
└──────────────────────────────┴────────────────────────────────┘

[ Session ▾ ]  ← collapsed; shows proposal replay when opened
```

Spec §18.6 calls for **React Flow** with modes: local neighborhood, dependency graph, feeds-into graph. Start with **local 1-hop neighborhood** around selected topic (`settings.ui.default_graph_depth: 1` in spec §33).

Spec §18.3 topic detail should include side panel: parent, children, dependencies, feeds_into, recommended commands.

---

## Implementation phases

### Phase 1 — Topic focus mode (highest priority)

**Goal:** Fix the scroll/confusion problem without new backend primitives.

- Refactor `PairingPlane.tsx` / `ProjectShell.tsx` into **view modes**: `atlas-only` | `topic-focus` | `session-focus`
- When `selectedTopicId` is set → show **Topic workspace** as primary; collapse or tab **SessionPanel** behind "Session history" / "Intake session"
- Scroll to topic workspace on selection (or replace center content entirely)
- Topic header: status, coverage badges, **Next actions** row: Expand, Decompose (stub OK), Add link (stub OK), Boundary check (stub OK)
- Move proposal cards out of default view — link to originating session only
- After apply, keep existing "click topic in Atlas" success UX

**Files:** `PairingPlane.tsx`, `ProjectShell.tsx`, `TopicEditor.tsx`, possibly new `TopicWorkspace.tsx`

### Phase 2 — Topic context panel

**Goal:** Show structure around the selected node.

- API: extend topic detail or add `GET /api/projects/{id}/topics/{topic_id}/context` returning parent, children, `depends_on`, `feeds_into`, `blocks` (resolve titles from manifest)
- UI side panel or section in topic workspace listing neighbors with click-to-navigate
- Empty state: "No links yet — use Add link after expansion"

**Files:** `strataforge/server/routes_topics.py`, `strataforge/core/topic_store.py`, `api.ts`, new component

### Phase 3 — Local neighborhood graph (React Flow)

**Goal:** Visual graph for selected topic + 1-hop neighbors.

- Add `@xyflow/react` (or react-flow per spec)
- Render nodes = topics, edges = typed (`depends_on`, `feeds_into`, `blocks`)
- Click node → `onSelectTopic`
- Flat intake atlas: graph shows isolated node until links exist — that's OK

**Files:** new `LocalGraph.tsx`, wire into topic workspace

### Phase 4 — Decompose + link sessions (stretch)

**Goal:** Wire graph growth to HITL loop.

- Session modes: `decompose` (child `create_component` under selected parent), `link` (`add_dependency` / `add_feeds_into` proposal kinds — may need backend apply support if missing)
- Augmented prompts for decompose/link (mirror intake prompt pattern)
- Apply engine: ensure `add_dependency` / `add_feeds_into` proposals update topic frontmatter

Check spec §14.1 proposal kinds and what's implemented in `apply_engine.py` — today mostly `create_component`.

---

## Constraints

- **Minimal diffs** — match existing patterns (inline styles OK, same API style)
- **Files authoritative** — SQLite is rebuildable cache
- **Manual LLM first** — no autonomous agent
- **Human gates** — proposals before durable writes
- **Do not commit** `workspaces/` or `.claude/settings.local.json`
- **Tests:** extend `tests/ui/test_ui_api_contract.py`; add unit tests for new context endpoint
- Run `pytest -q` before claiming done

---

## Out of scope for this task

- MCP server, auth, vector search, background workers
- Full-project graph layout (start local 1-hop only)
- Gap board / status heatmap (spec §18.4–18.5)
- Autonomous LLM calls

---

## Verification checklist

- [x] Click atlas topic → topic workspace is immediately visible without scrolling past session
- [x] Session/proposal cards not default view after topic selection
- [x] Parent/children/neighbors shown for selected topic (even if empty)
- [x] Local graph renders selected node (React Flow 1-hop); clicking neighbor changes selection
- [x] Expand prompt still works from topic workspace (+ Run with LLM + save body)
- [x] Decompose/link sessions with apply engine for children and edges
- [x] OpenAI-compatible embedded LLM (`POST .../llm/run`, UI Run buttons)
- [x] `pytest -q` passes (50+)
- [x] Docker UI rebuild works at `/strataforge/`

---

## Reference: current pain-point code

Session stacks above topic detail (`PairingPlane.tsx`):

```tsx
// Session panel always renders first (lines 28–37).
// Topic detail is below (lines 39–50). Invert this.
{selectedTopicId && (
  <div style={{ padding: "16px" }}>
    <h2>Topic Detail</h2>
    <TopicEditor ... />
  </div>
)}
```

Graph fields exist but UI doesn't surface them (`strataforge/models.py`):

```python
depends_on: list[str] = Field(default_factory=list)
feeds_into: list[str] = Field(default_factory=list)
blocks: list[str] = Field(default_factory=list)
```

---

## Suggested first commit message

```
feat(ui): add topic focus mode and local atlas context
```

Start with Phase 1 only; land Phase 2–3 in follow-up commits if scope is large.
