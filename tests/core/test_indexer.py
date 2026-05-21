import sqlite3
from pathlib import Path
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.core.indexer import rebuild_index

def test_index_rebuild_populates_topics_table(tmp_path: Path):
    root = tmp_path / "p"
    init_project(root, "P")
    paths = ProjectPaths(root)
    create_topic_scaffold(
        paths,
        topic_id="topic:runtime",
        title="Runtime",
        area_slug="01-runtime",
        parent_id=None,
        level="area",
    )
    rebuild_index(paths)
    conn = sqlite3.connect(paths.db_path)
    count = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    conn.close()
    assert count == 1
