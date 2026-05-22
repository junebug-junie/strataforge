from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.llm.topic_commands import recommended_ui_commands


def test_recommended_commands_for_scaffolded_topic(tmp_path):
    root = tmp_path / "proj"
    init_project(root, "P")
    paths = ProjectPaths(root)
    create_topic_scaffold(
        paths,
        topic_id="topic:a",
        title="Area A",
        area_slug="01-a",
        parent_id=None,
        level="area",
    )
    cmds = recommended_ui_commands(paths, "topic:a")
    assert "expand" in cmds
    assert "decompose" in cmds or "link" in cmds
