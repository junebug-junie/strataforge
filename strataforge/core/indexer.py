import json
import sqlite3
from pathlib import Path

from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import PROPOSAL_RECORDS_KEY
from strataforge.core.topic_store import list_topics
from strataforge.llm.coherence import scan_project

_SCHEMA = """
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    level TEXT,
    parent_id TEXT,
    path TEXT,
    status TEXT,
    review_state TEXT,
    proposal_state TEXT,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    mode TEXT,
    topic_id TEXT,
    current_gate TEXT,
    created_at TEXT,
    updated_at TEXT,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    topic_id TEXT,
    kind TEXT,
    state TEXT,
    title TEXT,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS radar_cache (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    title TEXT,
    severity TEXT,
    score INTEGER,
    reason_codes_json TEXT,
    summary TEXT,
    recommended_commands_json TEXT,
    created_at TEXT,
    payload_json TEXT NOT NULL
);
"""


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(_SCHEMA)
    return conn


def _upsert_topic(conn: sqlite3.Connection, topic) -> None:
    payload = topic.model_dump(mode="json")
    conn.execute(
        """
        INSERT OR REPLACE INTO topics (
            id, title, level, parent_id, path, status, review_state,
            proposal_state, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            topic.id,
            topic.title,
            topic.level,
            topic.parent,
            topic.path,
            topic.status.value,
            topic.review_state.value,
            topic.proposal_state.value,
            json.dumps(payload),
        ),
    )


def _upsert_session(conn: sqlite3.Connection, session_data: dict) -> None:
    session_fields = {
        k: v for k, v in session_data.items() if k != PROPOSAL_RECORDS_KEY
    }
    conn.execute(
        """
        INSERT OR REPLACE INTO sessions (
            id, project_id, title, mode, topic_id, current_gate,
            created_at, updated_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_fields["id"],
            session_fields.get("project_id"),
            session_fields.get("title"),
            session_fields.get("mode"),
            session_fields.get("topic_id"),
            session_fields.get("current_gate"),
            session_fields.get("created_at"),
            session_fields.get("updated_at"),
            json.dumps(session_fields),
        ),
    )


def _upsert_proposal(conn: sqlite3.Connection, proposal_data: dict) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO proposals (
            id, session_id, topic_id, kind, state, title, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            proposal_data["id"],
            proposal_data["session_id"],
            proposal_data.get("topic_id"),
            proposal_data.get("kind"),
            proposal_data.get("state"),
            proposal_data.get("title"),
            json.dumps(proposal_data),
        ),
    )


def _upsert_radar_item(conn: sqlite3.Connection, item) -> None:
    payload = item.model_dump(mode="json")
    conn.execute(
        """
        INSERT OR REPLACE INTO radar_cache (
            id, topic_id, title, severity, score, reason_codes_json,
            summary, recommended_commands_json, created_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            item.id,
            item.topic_id,
            item.title,
            item.severity,
            item.score,
            json.dumps(item.reason_codes),
            item.summary,
            json.dumps(item.recommended_commands),
            item.created_at.isoformat(),
            json.dumps(payload),
        ),
    )


def _index_topics(conn: sqlite3.Connection, paths: ProjectPaths) -> None:
    conn.execute("DELETE FROM topics")
    for topic in list_topics(paths):
        _upsert_topic(conn, topic)


def _index_sessions(conn: sqlite3.Connection, paths: ProjectPaths) -> None:
    conn.execute("DELETE FROM sessions")
    conn.execute("DELETE FROM proposals")
    if not paths.sessions_dir.exists():
        return
    for path in sorted(paths.sessions_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        _upsert_session(conn, data)
        for proposal_data in data.get(PROPOSAL_RECORDS_KEY, {}).values():
            _upsert_proposal(conn, proposal_data)


def _index_radar(conn: sqlite3.Connection, paths: ProjectPaths) -> None:
    conn.execute("DELETE FROM radar_cache")
    for item in scan_project(paths):
        _upsert_radar_item(conn, item)


def rebuild_index(paths: ProjectPaths) -> None:
    """Rebuild the SQLite cache from authoritative project files."""
    conn = _connect(paths.db_path)
    try:
        _index_topics(conn, paths)
        _index_sessions(conn, paths)
        _index_radar(conn, paths)
        conn.commit()
    finally:
        conn.close()
