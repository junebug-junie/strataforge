import httpx
import pytest
from fastapi.testclient import TestClient

from strataforge.config import settings
from strataforge.server.app import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    return TestClient(create_app())


def test_llm_status(client, monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-x")
    r = client.get("/api/llm/status")
    assert r.status_code == 200
    assert r.json()["configured"] is True
    assert r.json()["model"]


def test_run_session_llm_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "strata_llm_provider", "manual")
    monkeypatch.setattr(settings, "openai_api_key", "")
    c = TestClient(create_app())
    r = c.post("/api/projects/project:demo/sessions/sess:fake/llm/run?command=intake")
    assert r.status_code in (404, 503)


def test_run_session_llm_mocked(client, monkeypatch, tmp_path, mock_httpx_client):
    from datetime import datetime, timezone

    from strataforge.core.manifest import init_project
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.session_store import create_session

    root = tmp_path / "workspaces"
    monkeypatch.setattr(settings, "strata_workspace_root", str(root))
    project_root = root / "demo"
    manifest = init_project(project_root, "Demo")
    paths = ProjectPaths(project_root)
    session = create_session(
        paths, title="Intake", mode="intake", created_at=datetime.now(timezone.utc)
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"session_mode":"intake","proposals":[]}'}}]},
        )

    mock_httpx_client(handler)

    r = client.post(
        f"/api/projects/{manifest.project_id}/sessions/{session.id}/llm/run",
        params={"command": "intake", "source_prompt": "pet app"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "proposals" in data["text"]
    assert data["command"] == "intake"
