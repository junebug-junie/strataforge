# Cursor CLI LLM Provider

**Date:** 2026-05-21  
**Branch:** feat/topic-focus-graph-ui  
**Status:** Approved

## Goal

Add `cursor-cli` as a first-class LLM provider so every "Run with LLM" button in the StrataForge UI works via the user's existing Cursor subscription — no API key required.

## Background

The UI already has `LlmRunButton` components on every LLM step (expand, boundary-check, reconcile-parent, decompose, link, intake). They hide when the backend reports `configured: false`. Today the only live provider is `openai`; `manual` disables everything.

The Cursor CLI (`agent` command, installed via `curl https://cursor.com/install -fsS | bash`) supports headless non-interactive use:

```bash
echo "prompt" | agent -p --output-format text --mode ask
```

`--mode ask` is read-only (no file edits). This is safe for inference-only use.

## Architecture

No new dependencies. One new provider branch in the existing `providers.py` dispatch.

```
.env  →  STRATA_LLM_PROVIDER=cursor-cli
            ↓
        providers.llm_status()   →  checks shutil.which("agent")
        providers.complete_text() →  dispatches to complete_text_via_cursor_cli()
            ↓
        subprocess: agent -p --output-format text --mode ask
        (prompt piped via stdin)
            ↓
        stdout returned as string
```

## Components

### `strataforge/llm/providers.py`

Add `complete_text_via_cursor_cli(prompt, timeout)`:
- `shutil.which("agent")` → `LLMNotConfiguredError` if missing
- `subprocess.run(["agent", "-p", "--output-format", "text", "--mode", "ask"], input=prompt, capture_output=True, text=True, timeout=timeout)`
- Non-zero exit → `LLMCompletionError` with stderr detail (first 500 chars)
- `TimeoutExpired` → `LLMCompletionError("Cursor agent request timed out")`
- Returns `result.stdout.strip()`

Update `llm_status()`:
- New branch: when `strata_llm_provider == "cursor-cli"`, return `configured=bool(shutil.which("agent"))`, `provider="cursor-cli"`, `model="cursor-agent"`, `base_url=""`

Update `complete_text(prompt, *, timeout, json_mode)`:
- New branch: when provider is `cursor-cli`, append `"\n\nRespond with valid JSON only, no prose."` to prompt when `json_mode=True`, then delegate to `complete_text_via_cursor_cli`

### `strataforge/server/routes_llm.py`

`_run_prompt` hardcodes `settings.openai_model` in the response. Extract a one-liner helper `_active_model()` that returns `"cursor-agent"` when provider is `cursor-cli`, else `settings.openai_model`.

### `.env.example`

Add a `cursor-cli` block alongside the existing `openai` block:

```
# Cursor CLI (uses your Cursor subscription — no API key needed)
# Requires: curl https://cursor.com/install -fsS | bash
# STRATA_LLM_PROVIDER=cursor-cli
```

### UI

No changes. All existing `LlmRunButton` instances show automatically when `configured: true`.

## Error Handling

| Scenario | Behaviour |
|---|---|
| `agent` not in PATH | `llm_status` returns `configured=false`; buttons hidden |
| `agent` exits non-zero | `LLMCompletionError` → HTTP 502 |
| Timeout (180s default) | `LLMCompletionError` → HTTP 502 |
| Cursor not authenticated | `agent` exits non-zero with auth error in stderr → HTTP 502 with detail |

## Testing

- Unit: mock `subprocess.run` in `test_providers.py` — success, non-zero exit, timeout, missing binary
- Integration: existing `test_llm_routes.py` smoke tests cover the route layer; mock `complete_text` to avoid calling real CLI in CI

## Out of Scope

- Streaming tokens to UI (future)
- Cloud Agent API (`api.cursor.com/v0/agents`) — requires paid plan with API access
- Auto-install of Cursor CLI
