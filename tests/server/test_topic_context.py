from fastapi.testclient import TestClient

from strataforge.server.app import create_app


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("STRATA_WORKSPACE_ROOT", str(tmp_path))
    return TestClient(create_app())


def test_topic_context_parent_children_and_links(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    project = client.post("/api/projects", json={"title": "Ctx"}).json()
    pid = project["project_id"]

    from strataforge.core.paths import ProjectPaths
    from strataforge.core.topic_store import create_topic_scaffold

    paths = None
    for d in tmp_path.iterdir():
        if d.is_dir() and (d / "strata.yaml").exists():
            paths = ProjectPaths(d)
            break

    create_topic_scaffold(
        paths,
        topic_id="topic:parent",
        title="Parent Area",
        area_slug="01-parent",
        parent_id=None,
        level="area",
    )
    child = create_topic_scaffold(
        paths,
        topic_id="topic:child",
        title="Child Topic",
        area_slug="02-child",
        parent_id="topic:parent",
        level="topic",
    )
    create_topic_scaffold(
        paths,
        topic_id="topic:upstream",
        title="Upstream",
        area_slug="03-upstream",
        parent_id=None,
        level="area",
    )
    child_path = paths.root / child.path
    text = child_path.read_text()
    text = text.replace(
        "depends_on: []",
        'depends_on: ["topic:upstream"]',
    )
    text = text.replace(
        "feeds_into: []",
        'feeds_into: ["topic:parent"]',
    )
    child_path.write_text(text)

    resp = client.get(f"/api/projects/{pid}/topics/topic:child/context")
    assert resp.status_code == 200
    ctx = resp.json()
    assert ctx["topic"]["id"] == "topic:child"
    assert ctx["parent"]["id"] == "topic:parent"
    assert ctx["children"] == []
    assert len(ctx["depends_on"]) == 1
    assert ctx["depends_on"][0]["title"] == "Upstream"
    assert len(ctx["feeds_into"]) == 1
    assert ctx["feeds_into"][0]["title"] == "Parent Area"

    parent_ctx = client.get(f"/api/projects/{pid}/topics/topic:parent/context")
    assert parent_ctx.status_code == 200
    assert len(parent_ctx.json()["children"]) == 1
    assert parent_ctx.json()["children"][0]["id"] == "topic:child"
