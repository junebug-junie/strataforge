import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from strataforge.server.app import create_app


def _client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("STRATA_WORKSPACE_ROOT", str(tmp_path))
    return TestClient(create_app())


def test_health():
    client = TestClient(create_app())
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_list_projects_empty(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    r = client.get("/api/projects")
    assert r.status_code == 200
    assert r.json() == []


def test_create_and_list_project(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    r = client.post("/api/projects", json={"title": "Demo"})
    assert r.status_code == 201
    body = r.json()
    assert body["project_id"].startswith("project:")
    assert body["title"] == "Demo"

    r2 = client.get("/api/projects")
    assert r2.status_code == 200
    projects = r2.json()
    assert len(projects) == 1
    assert projects[0]["project_id"] == body["project_id"]


def test_topics_tree_and_detail(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

    from strataforge.core.manifest import load_manifest
    from strataforge.core.paths import ProjectPaths
    from strataforge.core.topic_store import create_topic_scaffold

    paths = ProjectPaths(tmp_path / "p")
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

    r = client.get(f"/api/projects/{pid}/topics")
    assert r.status_code == 200
    nodes = r.json()
    assert len(nodes) >= 1
    assert any(n["id"] == "topic:runtime" for n in nodes)

    r2 = client.get(f"/api/projects/{pid}/topics/topic:runtime")
    assert r2.status_code == 200
    detail = r2.json()
    assert detail["topic"]["id"] == "topic:runtime"
    assert "body" in detail


def test_update_topic(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

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

    r = client.put(
        f"/api/projects/{pid}/topics/topic:runtime",
        json={"review_state": "accepted", "status": "expanded"},
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["review_state"] == "accepted"
    assert updated["status"] == "expanded"


def test_session_import_accept_apply(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

    r = client.post(
        f"/api/projects/{pid}/sessions",
        json={"title": "Intake", "mode": "intake"},
    )
    assert r.status_code == 201
    session = r.json()
    session_id = session["id"]

    bundle = {
        "session_mode": "intake",
        "proposals": [
            {
                "kind": "create_component",
                "title": "Session Runtime",
                "proposed_changes": {
                    "area_slug": "01-session-runtime",
                    "topic_id": "topic:session-runtime",
                    "title": "Session Runtime",
                    "level": "area",
                },
            }
        ],
    }
    r2 = client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json=bundle,
    )
    assert r2.status_code == 200
    imported = r2.json()
    assert imported["count"] == 1

    r3 = client.get(f"/api/projects/{pid}/sessions/{session_id}")
    assert r3.status_code == 200
    detail = r3.json()
    assert len(detail["proposals"]) == 1
    proposal_id = detail["proposals"][0]["id"]

    r4 = client.post(
        f"/api/projects/{pid}/proposals/{proposal_id}/accept",
        json={"note": "ok"},
    )
    assert r4.status_code == 200
    assert r4.json()["state"] == "accepted"

    r5 = client.post(f"/api/projects/{pid}/sessions/{session_id}/apply")
    assert r5.status_code == 200
    applied = r5.json()
    assert len(applied["created"]) == 1
    assert applied["created"][0]["id"] == "topic:session-runtime"


def test_prompt_expand(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

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

    r = client.get(f"/api/projects/{pid}/topics/topic:runtime/prompts/expand")
    assert r.status_code == 200
    assert "expanding one strataforge topic" in r.json()["prompt"].lower()


def test_radar_scan_and_list(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

    r = client.post(f"/api/projects/{pid}/radar/scan")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    r2 = client.get(f"/api/projects/{pid}/radar")
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)

    from strataforge.core.paths import ProjectPaths

    paths = None
    for d in tmp_path.iterdir():
        if d.is_dir() and (d / "strata.yaml").exists():
            paths = ProjectPaths(d)
            break
    cache = paths.strata_dir / "radar" / "latest.json"
    assert cache.exists()


def test_proposal_reject_and_defer(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

    session = client.post(
        f"/api/projects/{pid}/sessions",
        json={"title": "S", "mode": "intake"},
    ).json()
    session_id = session["id"]

    client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={
            "proposals": [
                {
                    "kind": "create_component",
                    "title": "A",
                    "proposed_changes": {
                        "area_slug": "01-a",
                        "topic_id": "topic:a",
                        "title": "A",
                        "level": "area",
                    },
                }
            ]
        },
    )
    detail = client.get(f"/api/projects/{pid}/sessions/{session_id}").json()
    proposal_id = detail["proposals"][0]["id"]

    now = datetime.now(timezone.utc).isoformat()
    r_reject = client.post(
        f"/api/projects/{pid}/proposals/{proposal_id}/reject",
        json={"note": "no"},
    )
    assert r_reject.status_code == 200
    assert r_reject.json()["state"] == "rejected"

    client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={
            "proposals": [
                {
                    "kind": "create_component",
                    "title": "B",
                    "proposed_changes": {
                        "area_slug": "02-b",
                        "topic_id": "topic:b",
                        "title": "B",
                        "level": "area",
                    },
                }
            ]
        },
    )
    detail2 = client.get(f"/api/projects/{pid}/sessions/{session_id}").json()
    proposal_id2 = detail2["proposals"][-1]["id"]
    r_defer = client.post(
        f"/api/projects/{pid}/proposals/{proposal_id2}/defer",
        json={"note": "later"},
    )
    assert r_defer.status_code == 200
    assert r_defer.json()["state"] == "deferred"


def test_list_sessions_and_unique_ids(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]

    first = client.post(f"/api/projects/{pid}/sessions", json={"title": "Intake", "mode": "intake"}).json()
    second = client.post(f"/api/projects/{pid}/sessions", json={"title": "Intake", "mode": "intake"}).json()
    assert first["id"] != second["id"]

    listed = client.get(f"/api/projects/{pid}/sessions?mode=intake").json()
    assert len(listed) == 2


def test_import_proposals_invalid_returns_422(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]
    session = client.post(f"/api/projects/{pid}/sessions", json={"title": "S", "mode": "intake"}).json()
    session_id = session["id"]

    r = client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={"proposals": [{"title": "Missing kind"}]},
    )
    assert r.status_code == 422


def test_proposal_revise(tmp_path: Path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post("/api/projects", json={"title": "P"}).json()
    pid = created["project_id"]
    session = client.post(f"/api/projects/{pid}/sessions", json={"title": "S", "mode": "intake"}).json()
    session_id = session["id"]

    client.post(
        f"/api/projects/{pid}/sessions/{session_id}/import",
        json={
            "proposals": [
                {
                    "kind": "create_component",
                    "title": "A",
                    "proposed_changes": {
                        "area_slug": "01-a",
                        "topic_id": "topic:a",
                        "title": "A",
                        "level": "area",
                    },
                }
            ]
        },
    )
    detail = client.get(f"/api/projects/{pid}/sessions/{session_id}").json()
    proposal_id = detail["proposals"][0]["id"]

    r = client.post(
        f"/api/projects/{pid}/proposals/{proposal_id}/revise",
        json={"note": "split needed"},
    )
    assert r.status_code == 200
    assert r.json()["state"] == "revised"
