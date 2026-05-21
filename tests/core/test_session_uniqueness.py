from datetime import datetime, timezone

from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session, list_sessions


def test_session_ids_are_unique_for_same_title_and_day(tmp_path):
    init_project(tmp_path / "p", "P")
    paths = ProjectPaths(tmp_path / "p")
    now = datetime.now(timezone.utc)
    first = create_session(paths, title="Intake", mode="intake", created_at=now)
    second = create_session(paths, title="Intake", mode="intake", created_at=now)
    assert first.id != second.id
    assert len(list_sessions(paths)) == 2
