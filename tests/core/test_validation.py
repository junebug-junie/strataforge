from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.core.validation import validate_project, ValidationIssue

def test_validate_catches_missing_parent_file(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    create_topic_scaffold(paths, topic_id="topic:child", title="Child", area_slug="01-x", parent_id="topic:missing", level="leaf")
    issues = validate_project(paths)
    assert any(i.code == "parent_not_found" for i in issues)

def test_validate_passes_clean_project(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    parent = create_topic_scaffold(paths, topic_id="topic:runtime", title="Runtime", area_slug="01-runtime", parent_id=None, level="area")
    create_topic_scaffold(paths, topic_id="topic:runtime.gates", title="Gates", area_slug="01-runtime", parent_id=parent.id, level="leaf")
    issues = validate_project(paths)
    assert issues == []
