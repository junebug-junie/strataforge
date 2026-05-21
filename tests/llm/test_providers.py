import httpx
import pytest

from strataforge.config import settings
from strataforge.llm.providers import LLMNotConfiguredError, complete_text, is_llm_configured


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


def test_complete_text_parses_openai_response(monkeypatch):
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

    transport = httpx.MockTransport(handler)
    real_client = httpx.Client

    class _ClientCtx:
        def __init__(self, timeout: float = 180.0):
            self._inner = real_client(transport=transport, timeout=timeout)

        def __enter__(self):
            return self._inner

        def __exit__(self, *args):
            self._inner.close()

    monkeypatch.setattr("strataforge.llm.providers.httpx.Client", _ClientCtx)
    assert complete_text("prompt") == '{"session_mode":"intake"}'
