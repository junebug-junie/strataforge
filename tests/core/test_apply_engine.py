from pathlib import Path
from datetime import datetime, timezone

import pytest

from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session
from strataforge.core.proposal_store import add_proposal, set_proposal_action
from strataforge.core.apply_engine import apply_session, ApplyConflictError
from strataforge.core.topic_store import create_topic_scaffold


def test_apply_writes_only_accepted_scaffolds(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    p_accept = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Session Runtime",
        proposed_changes={
            "area_slug": "01-session-runtime",
            "topic_id": "topic:session-runtime",
            "title": "Session Runtime",
            "level": "area",
        },
    )
    p_reject = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Agent Runtime",
        proposed_changes={
            "area_slug": "09-agent",
            "topic_id": "topic:agent-runtime",
            "title": "Agent Runtime",
            "level": "area",
        },
    )
    set_proposal_action(paths, p_accept.id, action="accept", note="", reviewed_at=now)
    set_proposal_action(paths, p_reject.id, action="reject", note="defer v1", reviewed_at=now)
    created = apply_session(paths, session.id, force=False)
    assert len(created) == 1
    assert created[0].id == "topic:session-runtime"


def test_apply_refuses_overwrite_expanded_without_force(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    topic = create_topic_scaffold(
        paths,
        topic_id="topic:session-runtime",
        title="Session Runtime",
        area_slug="01-session-runtime",
        parent_id=None,
        level="area",
    )
    topic_path = paths.root / topic.path
    text = topic_path.read_text().replace("status: scaffolded", "status: expanded")
    topic_path.write_text(text)
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Session Runtime",
        proposed_changes={
            "area_slug": "01-session-runtime",
            "topic_id": "topic:session-runtime",
            "title": "Session Runtime",
            "level": "area",
        },
    )
    set_proposal_action(paths, proposal.id, action="accept", note="", reviewed_at=now)
    with pytest.raises(ApplyConflictError):
        apply_session(paths, session.id, force=False)
    apply_session(paths, session.id, force=True)
