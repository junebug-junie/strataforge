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


def test_list_topics_reads_status_from_file(tmp_path: Path):
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
    topic_path = paths.root / "areas/01-runtime/index.md"
    text = topic_path.read_text().replace("status: scaffolded", "status: expanded")
    topic_path.write_text(text)
    topics = list_topics(paths)
    assert topics[0].status.value == "expanded"
