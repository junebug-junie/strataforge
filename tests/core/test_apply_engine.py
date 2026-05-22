from pathlib import Path

from strataforge.core.apply_engine import apply_session
from strataforge.core.paths import ProjectPaths
from datetime import datetime, timezone

from strataforge.core.proposal_store import add_proposal, set_proposal_action
from strataforge.core.session_store import create_session
from strataforge.core.topic_store import create_topic_scaffold, get_topic


def _setup(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "proj")
    from strataforge.core.manifest import init_project

    init_project(paths.root, "Test")
    parent = create_topic_scaffold(
        paths,
        topic_id="topic:parent",
        title="Parent",
        area_slug="01-parent",
        parent_id=None,
        level="area",
    )
    other = create_topic_scaffold(
        paths,
        topic_id="topic:other",
        title="Other",
        area_slug="02-other",
        parent_id=None,
        level="area",
    )
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Link", mode="link", created_at=now, topic_id=parent.id)
    return paths, parent, other, session


def test_apply_add_dependency(tmp_path: Path):
    paths, parent, other, session = _setup(tmp_path)
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="add_dependency",
        title="Parent depends on Other",
        proposed_changes={"topic_id": parent.id, "depends_on_id": other.id},
        topic_id=parent.id,
    )
    set_proposal_action(paths, proposal.id, action="accept", reviewed_at=datetime.now(timezone.utc))
    apply_session(paths, session.id)
    updated, _ = get_topic(paths, parent.id)
    assert other.id in updated.depends_on


def test_apply_add_feeds_into(tmp_path: Path):
    paths, parent, other, session = _setup(tmp_path)
    session = create_session(
        paths,
        title="Feed",
        mode="link",
        created_at=datetime.now(timezone.utc),
        topic_id=parent.id,
    )
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="add_feeds_into",
        title="Parent feeds Other",
        proposed_changes={"topic_id": parent.id, "feeds_into_id": other.id},
        topic_id=parent.id,
    )
    set_proposal_action(paths, proposal.id, action="accept", reviewed_at=datetime.now(timezone.utc))
    apply_session(paths, session.id)
    updated, _ = get_topic(paths, parent.id)
    assert other.id in updated.feeds_into


def test_apply_decompose_child(tmp_path: Path):
    paths, parent, _other, session = _setup(tmp_path)
    session = create_session(
        paths,
        title="Decompose",
        mode="decompose",
        created_at=datetime.now(timezone.utc),
        topic_id=parent.id,
    )
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Child A",
        proposed_changes={
            "area_slug": "01-parent-child-a",
            "topic_id": "topic:child-a",
            "title": "Child A",
            "level": "topic",
            "parent_id": parent.id,
        },
        topic_id="topic:child-a",
    )
    set_proposal_action(paths, proposal.id, action="accept", reviewed_at=datetime.now(timezone.utc))
    created = apply_session(paths, session.id)
    assert len(created) == 1
    assert created[0].parent == parent.id
