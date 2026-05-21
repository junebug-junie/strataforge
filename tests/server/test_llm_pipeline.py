import httpx
import pytest
from fastapi.testclient import TestClient

from strataforge.config import settings
from strataforge.server.app import create_app


def test_pipeline_route(monkeypatch, tmp_path):
    from datetime import datetime, timezone

    from strataforge.core.manifest import init_project
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.session_store import create_session

    monkeypatch.setenv("STRATA_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.setattr(settings, "strata_workspace_root", str(tmp_path))
    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")

    root = tmp_path / "demo"
    manifest = init_project(root, "Demo")
    paths = ProjectPaths(root)
    session = create_session(
        paths, title="Intake", mode="intake", created_at=datetime.now(timezone.utc)
    )

    import json

    bundle = {
        "session_mode": "intake",
        "proposals": [
            {
                "kind": "create_component",
                "title": "X",
                "proposed_changes": {
                    "area_slug": "01-x",
                    "topic_id": "topic:x",
                    "title": "X",
                    "level": "area",
                },
            }
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(bundle)}}]},
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

    client = TestClient(create_app())
    r = client.post(
        f"/api/projects/{manifest.project_id}/sessions/{session.id}/llm/pipeline",
        json={"command": "intake", "source_prompt": "cats", "accept_all": True, "apply": False},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] is True
    assert data["proposal_count"] == 1
    assert data["accepted_count"] == 1
