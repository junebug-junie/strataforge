from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold, list_topics

def test_create_and_list_topics(tmp_path: Path):
    init_project(tmp_path / "p", "P")
    paths = ProjectPaths(tmp_path / "p")
    create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )
    topics = list_topics(paths)
    assert len(topics) == 1
    assert topics[0].id == "topic:runtime"
