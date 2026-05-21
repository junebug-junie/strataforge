"""UI-facing API contract tests.

These verify endpoints used by the React UI without a browser runner.
"""

from fastapi.testclient import TestClient

from strataforge.server.app import create_app


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("STRATA_WORKSPACE_ROOT", str(tmp_path))
    return TestClient(create_app())


def test_ui_session_resume_and_prompt_endpoints(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    project = client.post("/api/projects", json={"title": "Demo"}).json()
    pid = project["project_id"]

    session_a = client.post(f"/api/projects/{pid}/sessions", json={"title": "Intake", "mode": "intake"}).json()
    session_b = client.post(f"/api/projects/{pid}/sessions", json={"title": "Intake", "mode": "intake"}).json()
    assert session_a["id"] != session_b["id"]

    listed = client.get(f"/api/projects/{pid}/sessions?mode=intake").json()
    assert len(listed) >= 2
    assert listed[0]["id"] in {session_a["id"], session_b["id"]}

    from strataforge.core.paths import ProjectPaths
    from strataforge.core.topic_store import create_topic_scaffold

    paths = None
    for d in tmp_path.iterdir():
        if d.is_dir() and (d / "strata.yaml").exists():
            paths = ProjectPaths(d)
            break
    create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )

    expand = client.get(f"/api/projects/{pid}/topics/topic:runtime/prompts/expand")
    assert expand.status_code == 200
    assert "topic:runtime" in expand.json()["prompt"]

    reconcile = client.get(f"/api/projects/{pid}/topics/topic:runtime/prompts/reconcile-parent")
    assert reconcile.status_code == 200
    assert reconcile.json()["command"] == "reconcile-parent"

    session_id = session_a["id"]
    client.put(
        f"/api/projects/{pid}/sessions/{session_id}",
        json={"inputs": {"source_prompt": "Build a design pairing plane"}},
    )
    intake_prompt = client.get(f"/api/projects/{pid}/sessions/{session_id}/prompts/intake")
    assert intake_prompt.status_code == 200
    prompt_text = intake_prompt.json()["prompt"]
    assert "Build a design pairing plane" in prompt_text
    assert "topic:runtime" in prompt_text
    assert '"session_mode": "intake"' in prompt_text

    live_preview = client.get(
        f"/api/projects/{pid}/sessions/{session_id}/prompts/intake",
        params={"source_prompt": "I want to build a cat app"},
    )
    assert live_preview.status_code == 200
    assert "I want to build a cat app" in live_preview.json()["prompt"]

    imported = client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={
            "proposals": [
                {
                    "kind": "create_component",
                    "title": "Runtime",
                    "proposed_changes": {
                        "area_slug": "01-runtime",
                        "topic_id": "topic:runtime",
                        "title": "Runtime",
                        "level": "area",
                    },
                }
            ]
        },
    )
    assert imported.status_code == 200
    proposal_id = imported.json()["proposals"][0]["id"]

    revised = client.post(f"/api/projects/{pid}/proposals/{proposal_id}/revise", json={"note": "split"})
    assert revised.status_code == 200
    assert revised.json()["state"] == "revised"

    bad_import = client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={"proposals": [{"title": "no kind"}]},
    )
    assert bad_import.status_code == 422
