# StrataForge

Local-first HITL architecture design pairing plane. Humans gate LLM or manual proposals into durable Markdown topic scaffolds, browse the atlas in a minimal web UI, validate the workspace, generate bounded prompts, and review a deterministic coherence radar queue.

## Quick start (Docker)

```bash
# From the repo root
mkdir -p workspaces .strata
docker compose up --build
```

| Service | URL |
|---------|-----|
| API (direct) | http://localhost:8787 |
| UI + API (proxied) | http://localhost:8788/strataforge/ |
| Health (direct) | http://localhost:8787/health |

Workspace files live under `./workspaces`; the SQLite index is rebuilt under `./.strata`.

## Tailscale (subpath — root already in use)

When another app occupies `/` on your Tailscale HTTPS endpoint, expose StrataForge under `/strataforge` only. The UI nginx container serves static files and proxies `/strataforge/api/` to the FastAPI backend, so **one** `tailscale serve` entry is enough.

```bash
docker compose up --build

# Single subpath — UI + API on port 8788
sudo tailscale serve --bg --https=443 --set-path=/strataforge http://127.0.0.1:8788
```

Open: `https://<your-tailscale-host>/strataforge/` (note trailing slash)

On first visit, the UI prompts you to **create a project** — no CLI required.

To remove later: `sudo tailscale serve reset` (or `tailscale serve status` to inspect).

## Local development (without Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# API
uvicorn strataforge.server.app:create_app --factory --host 127.0.0.1 --port 8787

# UI (separate terminal)
cd strataforge/ui && npm install && npm run dev
```

Copy `.env.example` to `.env` and adjust paths if needed.

## MVP walkthrough

This follows the manual-paste-first loop: **init → intake → import → accept → apply → radar → prompt**.

### 1. Initialize a project

```bash
mkdir -p workspaces
strata init workspaces/demo --title "Demo Architecture"
```

Creates `strata.yaml`, area/session directories, and a project README.

### 2. Start an intake session

```bash
strata session start \
  --project workspaces/demo \
  --title "Initial decomposition" \
  --mode intake
```

Note the printed session id (for example `session.2026-05-20-initial-decomposition`).

Paste your high-level design idea into a file, then attach it to the session:

```bash
cat > /tmp/intake-idea.md <<'EOF'
I want a standalone visual HITL design pairing plane where an LLM buddy helps
decompose architecture ideas into approved scaffolds, links into my IDE, and
continually checks coherence.
EOF

strata session set-input SESSION_ID \
  --project workspaces/demo \
  --prompt-file /tmp/intake-idea.md
```

Replace `SESSION_ID` with the id from step 2.

### 3. Import proposals (manual LLM paste)

Ask your LLM for a JSON proposal bundle, or use the fixture:

```bash
strata session import-proposals SESSION_ID \
  --project workspaces/demo \
  --file fixtures/intake_proposals.json
```

Proposal cards appear in the UI session panel (or via `GET /api/projects/{project_id}/sessions/{session_id}`).

### 4. Accept, reject, or defer

Human gating is required before any durable write.

**In the UI:** open http://localhost:8788/strataforge/, select the project, open the session, and use **Accept**, **Reject**, or **Defer** on each proposal card.

**Via API:**

```bash
curl -X POST "http://localhost:8787/api/projects/demo/proposals/PROPOSAL_ID/accept"
curl -X POST "http://localhost:8787/api/projects/demo/proposals/PROPOSAL_ID/reject"
curl -X POST "http://localhost:8787/api/projects/demo/proposals/PROPOSAL_ID/defer"
```

Only **accepted** proposals become scaffolds on apply.

### 5. Apply accepted proposals

```bash
strata apply SESSION_ID --project workspaces/demo
```

Creates Markdown scaffolds under `areas/` for each accepted `create_component` proposal. Expanded topics are not overwritten without `--force`.

Verify:

```bash
strata validate workspaces/demo
strata list workspaces/demo
```

### 6. Coherence radar

```bash
strata radar workspaces/demo
```

Surfaces deterministic pressure items (missing boundaries, reconciliation needs, dependency gaps). The UI **Coherence Radar** panel shows the same queue when the API is running.

Mark topics with coverage flags in the UI (for example **Needs reconciliation**) to see radar items after decomposition.

### 7. Generate a bounded expansion prompt

Pick a topic from the atlas tree, then:

```bash
strata prompt expand topic:session-runtime --project workspaces/demo
```

Copy the output into your LLM, paste the returned JSON back with `strata session import-proposals`, and repeat the accept → apply loop for child components.

For parent reconciliation after editing a child:

```bash
strata prompt reconcile-parent topic:CHILD_ID --project workspaces/demo
```

## CLI reference

| Command | Purpose |
|---------|---------|
| `strata init PATH` | Create a new project workspace |
| `strata session start` | Open an intake or expansion session |
| `strata session set-input` | Attach source prompt text |
| `strata session import-proposals` | Import pasted proposal JSON |
| `strata apply` | Write scaffolds for accepted proposals |
| `strata validate` | Check manifest and scaffold integrity |
| `strata radar` | List coherence pressure queue |
| `strata prompt expand` | Build bounded LLM expansion prompt |
| `strata index rebuild` | Rebuild SQLite index from files |

## Architecture notes

- **Files are authoritative:** `strata.yaml`, topic Markdown, session/proposal JSON on disk.
- **SQLite is a rebuildable index** under `.strata/`.
- **LLM mode is manual-first:** generate prompts, paste structured JSON, import proposals; no autonomous agent in MVP.
