import httpx
import pytest

from strataforge.config import settings
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session
from strataforge.llm.manual_import import ProposalBundleError
from strataforge.llm.session_llm import run_session_llm_pipeline


def test_pipeline_imports_structured_json(monkeypatch, tmp_path):
    from datetime import datetime, timezone

    root = tmp_path / "proj"
    manifest = init_project(root, "P")
    paths = ProjectPaths(root)
    session = create_session(
        paths, title="Intake", mode="intake", created_at=datetime.now(timezone.utc)
    )

    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")

    payload = {
        "session_mode": "intake",
        "summary": "test",
        "proposals": [
            {
                "kind": "create_component",
                "title": "Area A",
                "proposed_changes": {
                    "area_slug": "01-a",
                    "topic_id": "topic:a",
                    "title": "Area A",
                    "level": "area",
                },
            }
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(payload)}}]},
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

    result = run_session_llm_pipeline(
        paths,
        session.id,
        "intake",
        source_prompt="idea",
        accept_all=True,
        apply=False,
    )
    assert result.imported
    assert result.proposal_count == 1
    assert result.parse_error is None
    assert result.accepted_count == 1


def test_pipeline_surfaces_parse_error(monkeypatch, tmp_path):
    from datetime import datetime, timezone

    root = tmp_path / "proj"
    init_project(root, "P")
    paths = ProjectPaths(root)
    session = create_session(
        paths, title="Intake", mode="intake", created_at=datetime.now(timezone.utc)
    )

    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "not json at all"}}]},
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

    result = run_session_llm_pipeline(paths, session.id, "intake", source_prompt="x")
    assert not result.imported
    assert result.parse_error
    with pytest.raises(ProposalBundleError):
        from strataforge.llm.manual_import import parse_llm_paste_text

        parse_llm_paste_text(result.text)
