# Cursor CLI LLM Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cursor-cli` as a selectable LLM provider so every "Run with LLM" button in the StrataForge UI works via the user's Cursor subscription with `STRATA_LLM_PROVIDER=cursor-cli`.

**Architecture:** Add `complete_text_via_cursor_cli()` to `providers.py` that pipes prompts to `agent -p --output-format text --mode ask` via stdin. Update `llm_status()` and `complete_text()` to dispatch to this path when the provider is `cursor-cli`. Fix `_run_prompt` in `routes_llm.py` to report the right model name regardless of provider.

**Tech Stack:** Python stdlib only (`shutil`, `subprocess`). No new dependencies. Pytest + monkeypatch + `unittest.mock.patch` for tests.

---

## File Map

| File | Change |
|---|---|
| `strataforge/llm/providers.py` | Add `import shutil`, `import subprocess`; add `complete_text_via_cursor_cli()`; update `llm_status()` and `complete_text()` |
| `strataforge/server/routes_llm.py` | Line 73: replace `settings.openai_model` with `str(llm_status()["model"])` |
| `.env.example` | Add cursor-cli block |
| `tests/llm/test_providers.py` | Add 7 new tests for cursor-cli |

---

## Task 1: Tests for cursor-cli provider logic

**Files:**
- Modify: `tests/llm/test_providers.py`

- [ ] **Step 1: Update imports at the top of `tests/llm/test_providers.py`**

Replace the existing providers import line:

```python
from strataforge.llm.providers import LLMNotConfiguredError, complete_text, is_llm_configured
```

with:

```python
import subprocess
from unittest.mock import MagicMock, patch

from strataforge.llm.providers import (
    LLMCompletionError,
    LLMNotConfiguredError,
    complete_text,
    complete_text_via_cursor_cli,
    is_llm_configured,
    llm_status,
)
```

- [ ] **Step 2: Add failing tests**

Append to `tests/llm/test_providers.py`:

```python
import subprocess
from unittest.mock import MagicMock, patch

from strataforge.llm.providers import complete_text_via_cursor_cli


def test_cursor_cli_status_configured_when_agent_in_path(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "cursor-cli")
    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        status = llm_status()
    assert status["configured"] is True
    assert status["provider"] == "cursor-cli"
    assert status["model"] == "cursor-agent"
    assert status["base_url"] == ""


def test_cursor_cli_status_not_configured_when_agent_missing(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "cursor-cli")
    with patch("strataforge.llm.providers.shutil.which", return_value=None):
        status = llm_status()
    assert status["configured"] is False


def test_complete_text_via_cursor_cli_success():
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "  hello world  "
    mock_result.stderr = ""
    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        with patch("strataforge.llm.providers.subprocess.run", return_value=mock_result) as mock_run:
            result = complete_text_via_cursor_cli("my prompt")
    assert result == "hello world"
    mock_run.assert_called_once_with(
        ["/usr/local/bin/agent", "-p", "--output-format", "text", "--mode", "ask"],
        input="my prompt",
        capture_output=True,
        text=True,
        timeout=180.0,
    )


def test_complete_text_via_cursor_cli_nonzero_exit():
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ""
    mock_result.stderr = "auth error: not logged in"
    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        with patch("strataforge.llm.providers.subprocess.run", return_value=mock_result):
            with pytest.raises(LLMCompletionError, match="exit 1"):
                complete_text_via_cursor_cli("my prompt")


def test_complete_text_via_cursor_cli_timeout():
    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        with patch(
            "strataforge.llm.providers.subprocess.run",
            side_effect=subprocess.TimeoutExpired("agent", 180),
        ):
            with pytest.raises(LLMCompletionError, match="timed out"):
                complete_text_via_cursor_cli("my prompt")


def test_complete_text_via_cursor_cli_missing_binary():
    with patch("strataforge.llm.providers.shutil.which", return_value=None):
        with pytest.raises(LLMNotConfiguredError, match="Cursor CLI not found"):
            complete_text_via_cursor_cli("my prompt")


def test_complete_text_dispatches_to_cursor_cli(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "cursor-cli")
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "response text"
    mock_result.stderr = ""
    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        with patch("strataforge.llm.providers.subprocess.run", return_value=mock_result):
            result = complete_text("test prompt")
    assert result == "response text"


def test_complete_text_cursor_cli_json_mode_appends_instruction(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "cursor-cli")
    captured: dict = {}
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '{"key": "val"}'
    mock_result.stderr = ""

    def capture_run(cmd, *, input, **kwargs):
        captured["input"] = input
        return mock_result

    with patch("strataforge.llm.providers.shutil.which", return_value="/usr/local/bin/agent"):
        with patch("strataforge.llm.providers.subprocess.run", side_effect=capture_run):
            complete_text("build json", json_mode=True)
    assert "JSON only" in captured["input"]
    assert captured["input"].startswith("build json")
```

- [ ] **Step 3: Run tests — verify they all fail**

```bash
.venv/bin/pytest tests/llm/test_providers.py -v -k "cursor" 2>&1 | tail -20
```

Expected: `ImportError` or `AttributeError` — `complete_text_via_cursor_cli` doesn't exist yet.

---

## Task 2: Implement cursor-cli provider in `providers.py`

**Files:**
- Modify: `strataforge/llm/providers.py`

- [ ] **Step 1: Add stdlib imports and new function**

At the top of `strataforge/llm/providers.py`, after `from __future__ import annotations`, add:

```python
import shutil
import subprocess
```

After the `is_llm_configured` function (line 29), insert the new function:

```python
def complete_text_via_cursor_cli(prompt: str, *, timeout: float = 180.0) -> str:
    """Run a prompt through the Cursor agent CLI and return the text response."""
    agent_path = shutil.which("agent")
    if not agent_path:
        raise LLMNotConfiguredError(
            "Cursor CLI not found in PATH. Install with: curl https://cursor.com/install -fsS | bash"
        )
    try:
        result = subprocess.run(
            [agent_path, "-p", "--output-format", "text", "--mode", "ask"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise LLMCompletionError("Cursor agent request timed out") from exc
    except OSError as exc:
        raise LLMCompletionError(f"Failed to run Cursor agent: {exc}") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout)[:500]
        raise LLMCompletionError(f"Cursor agent error (exit {result.returncode}): {detail}")

    return result.stdout.strip()
```

- [ ] **Step 2: Update `llm_status()` to handle cursor-cli**

Replace the current `llm_status` function body (lines 18–25) with:

```python
def llm_status() -> dict[str, str | bool]:
    if settings.strata_llm_provider == "cursor-cli":
        return {
            "configured": bool(shutil.which("agent")),
            "provider": "cursor-cli",
            "model": "cursor-agent",
            "base_url": "",
        }
    configured = bool(settings.openai_api_key.strip()) and settings.strata_llm_provider != "manual"
    return {
        "configured": configured,
        "provider": settings.strata_llm_provider,
        "model": settings.openai_model,
        "base_url": settings.openai_base_url,
    }
```

- [ ] **Step 3: Update `complete_text()` to dispatch to cursor-cli**

Replace the current `complete_text` function body with (keep docstring, insert new branch before the `is_llm_configured` check):

```python
def complete_text(prompt: str, *, timeout: float = 180.0, json_mode: bool = False) -> str:
    """Send a single user message to an OpenAI-compatible chat API."""
    if settings.strata_llm_provider == "cursor-cli":
        if json_mode:
            prompt = prompt + "\n\nRespond with valid JSON only, no prose."
        return complete_text_via_cursor_cli(prompt, timeout=timeout)

    if not is_llm_configured():
        raise LLMNotConfiguredError(
            "LLM not configured. Set OPENAI_API_KEY and STRATA_LLM_PROVIDER=openai in .env, then restart the API."
        )

    api_key = settings.openai_api_key.strip()
    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    payload: dict = {
        "model": settings.openai_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": settings.openai_temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise LLMCompletionError("LLM request timed out") from exc
    except httpx.HTTPError as exc:
        raise LLMCompletionError(f"LLM request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500]
        raise LLMCompletionError(f"LLM API error {response.status_code}: {detail}")

    try:
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMCompletionError("Unexpected LLM response shape") from exc
```

- [ ] **Step 4: Run cursor-cli tests — verify they pass**

```bash
.venv/bin/pytest tests/llm/test_providers.py -v 2>&1 | tail -20
```

Expected: all 11 tests in `test_providers.py` PASS.

- [ ] **Step 5: Commit**

```bash
git add strataforge/llm/providers.py tests/llm/test_providers.py
git commit -m "feat: add cursor-cli LLM provider"
```

---

## Task 3: Fix model name in `routes_llm.py`

**Files:**
- Modify: `strataforge/server/routes_llm.py:73`

- [ ] **Step 1: Replace hardcoded `settings.openai_model` with `llm_status()` lookup**

On line 73 of `strataforge/server/routes_llm.py`, replace:

```python
    return LlmRunResponse(text=text, model=settings.openai_model, command=command)
```

with:

```python
    return LlmRunResponse(text=text, model=str(llm_status()["model"]), command=command)
```

`llm_status` is already imported at line 17 — no import change needed.

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
.venv/bin/pytest tests/llm/ tests/server/test_llm_routes.py -v 2>&1 | tail -25
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add strataforge/server/routes_llm.py
git commit -m "fix: report correct model name for active LLM provider"
```

---

## Task 4: Document cursor-cli in `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add cursor-cli block**

In `.env.example`, after the existing OpenAI block, append:

```bash
# Cursor CLI (uses your Cursor subscription — no API key needed)
# Install: curl https://cursor.com/install -fsS | bash
# Then authenticate: agent auth
# STRATA_LLM_PROVIDER=cursor-cli
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document cursor-cli provider in .env.example"
```

---

## Verification

After all tasks, run the full provider + route test suite:

```bash
.venv/bin/pytest tests/llm/ tests/server/test_llm_routes.py -v
```

Expected: 14 tests PASS (3 original providers + 8 new providers + 3 original routes).

Manual smoke test (once `agent` is installed):
1. Set `STRATA_LLM_PROVIDER=cursor-cli` in `.env`
2. Restart the API: `.venv/bin/uvicorn strataforge.server.app:create_app --factory --host 127.0.0.1 --port 8787`
3. `curl http://localhost:8787/api/llm/status` → `{"configured":true,"provider":"cursor-cli","model":"cursor-agent",...}`
4. Open UI → all "Run with LLM" buttons appear
