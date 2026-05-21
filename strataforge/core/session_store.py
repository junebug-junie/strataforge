import json
import uuid
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


def _session_slug(title: str, created_at: datetime) -> str:
    title_part = title.lower().replace(" ", "-")[:40].strip("-")
    time_part = created_at.strftime("%Y-%m-%dT%H%M%S")
    unique_part = uuid.uuid4().hex[:8]
    return f"{time_part}-{title_part}-{unique_part}"


def list_sessions(paths: ProjectPaths) -> list[DesignSession]:
    if not paths.sessions_dir.exists():
        return []
    sessions: list[DesignSession] = []
    for path in sorted(paths.sessions_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
            session_data = {k: v for k, v in data.items() if k != PROPOSAL_RECORDS_KEY}
            sessions.append(DesignSession.model_validate(session_data))
        except (OSError, ValueError, KeyError):
            continue
    sessions.sort(key=lambda s: s.updated_at, reverse=True)
    return sessions


def find_latest_session(paths: ProjectPaths, *, mode: str | None = None) -> DesignSession | None:
    for session in list_sessions(paths):
        if mode is None or session.mode == mode:
            return session
    return None


def create_session(
    paths: ProjectPaths,
    *,
    title: str,
    mode: str,
    created_at: datetime,
    topic_id: str | None = None,
) -> DesignSession:
    slug = _session_slug(title, created_at)
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
