import json
from datetime import datetime
from pathlib import Path

from strataforge.core.manifest import load_manifest
from strataforge.core.paths import ProjectPaths
from strataforge.models import DesignSession

PROPOSAL_RECORDS_KEY = "proposal_records"


def _session_path(paths: ProjectPaths, session_id: str) -> Path:
    slug = session_id.split(":", 1)[-1]
    return paths.sessions_dir / f"{slug}.json"


def _read_session_file(paths: ProjectPaths, session_id: str) -> dict:
    return json.loads(_session_path(paths, session_id).read_text())


def _write_session_file(paths: ProjectPaths, session_id: str, data: dict) -> None:
    paths.sessions_dir.mkdir(parents=True, exist_ok=True)
    _session_path(paths, session_id).write_text(json.dumps(data, indent=2, default=str))


def create_session(
    paths: ProjectPaths,
    *,
    title: str,
    mode: str,
    created_at: datetime,
    topic_id: str | None = None,
) -> DesignSession:
    slug = created_at.date().isoformat() + "-" + title.lower().replace(" ", "-")[:40]
    session = DesignSession(
        id=f"session:{slug}",
        project_id=load_manifest(paths).project_id,
        title=title,
        topic_id=topic_id,
        mode=mode,
        created_at=created_at,
        updated_at=created_at,
    )
    data = session.model_dump(mode="json")
    data[PROPOSAL_RECORDS_KEY] = {}
    _write_session_file(paths, session.id, data)
    return session


def load_session(paths: ProjectPaths, session_id: str) -> DesignSession:
    data = _read_session_file(paths, session_id)
    session_data = {k: v for k, v in data.items() if k != PROPOSAL_RECORDS_KEY}
    return DesignSession.model_validate(session_data)


def save_session(paths: ProjectPaths, session: DesignSession, proposal_records: dict | None = None) -> None:
    data = session.model_dump(mode="json")
    if proposal_records is not None:
        data[PROPOSAL_RECORDS_KEY] = proposal_records
    else:
        existing = _read_session_file(paths, session.id)
        data[PROPOSAL_RECORDS_KEY] = existing.get(PROPOSAL_RECORDS_KEY, {})
    _write_session_file(paths, session.id, data)


def get_proposal_records(paths: ProjectPaths, session_id: str) -> dict:
    return _read_session_file(paths, session_id).get(PROPOSAL_RECORDS_KEY, {})
