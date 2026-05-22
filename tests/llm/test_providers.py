import httpx
import pytest
import subprocess
from unittest.mock import MagicMock, patch

from strataforge.config import settings
from strataforge.llm.providers import (
    LLMCompletionError,
    LLMNotConfiguredError,
    complete_text,
    complete_text_via_cursor_cli,
    is_llm_configured,
    llm_status,
)


def test_is_llm_configured_requires_key_and_provider(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "strata_llm_provider", "manual")
    assert not is_llm_configured()

    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "strata_llm_provider", "manual")
    assert not is_llm_configured()

    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    assert is_llm_configured()


def test_complete_text_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "manual")
    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(LLMNotConfiguredError):
        complete_text("hello")


def test_complete_text_parses_openai_response(monkeypatch, mock_httpx_client):
    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "openai_base_url", "https://api.example.com/v1")
    monkeypatch.setattr(settings, "openai_model", "test-model")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.example.com/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer sk-test"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"session_mode":"intake"}'}}]},
        )

    mock_httpx_client(handler)
    assert complete_text("prompt") == '{"session_mode":"intake"}'


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
