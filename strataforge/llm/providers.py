"""OpenAI-compatible chat completion for embedded LLM runs."""

from __future__ import annotations

import shutil
import subprocess

import httpx

from strataforge.config import settings


class LLMNotConfiguredError(RuntimeError):
    pass


class LLMCompletionError(RuntimeError):
    pass


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


def is_llm_configured() -> bool:
    return bool(llm_status()["configured"])


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
