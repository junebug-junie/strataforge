from strataforge.core.paths import ProjectPaths
from strataforge.core.proposal_store import load_proposal, promote_proposal
from strataforge.core.session_store import load_session
from strataforge.core.status import DesignStatus, ProposalState
from strataforge.core.topic_store import (
    append_topic_link,
    create_topic_scaffold,
    try_get_topic,
)
from strataforge.models import TopicRecord


class ApplyConflictError(Exception):
    pass


def _apply_create_component(
    paths: ProjectPaths,
    proposal,
    *,
    force: bool,
) -> TopicRecord:
    changes = proposal.proposed_changes
    topic_id = changes["topic_id"]
    existing = try_get_topic(paths, topic_id)
    if existing and existing.status != DesignStatus.scaffolded and not force:
        raise ApplyConflictError(f"{topic_id} is {existing.status}, use --force")
    topic = create_topic_scaffold(
        paths,
        topic_id=topic_id,
        title=changes["title"],
        area_slug=changes["area_slug"],
        parent_id=changes.get("parent_id"),
        level=changes.get("level", "topic"),
    )
    return topic


def _apply_add_dependency(paths: ProjectPaths, proposal) -> TopicRecord:
    changes = proposal.proposed_changes
    topic_id = changes.get("topic_id") or proposal.topic_id
    depends_on_id = changes["depends_on_id"]
    if not topic_id:
        raise ApplyConflictError("add_dependency requires topic_id")
    if try_get_topic(paths, topic_id) is None:
        raise ApplyConflictError(f"Topic not found: {topic_id}")
    if try_get_topic(paths, depends_on_id) is None:
        raise ApplyConflictError(f"Dependency topic not found: {depends_on_id}")
    return append_topic_link(paths, topic_id, depends_on_id=depends_on_id)


def _apply_add_feeds_into(paths: ProjectPaths, proposal) -> TopicRecord:
    changes = proposal.proposed_changes
    topic_id = changes.get("topic_id") or proposal.topic_id
    feeds_into_id = changes["feeds_into_id"]
    if not topic_id:
        raise ApplyConflictError("add_feeds_into requires topic_id")
    if try_get_topic(paths, topic_id) is None:
        raise ApplyConflictError(f"Topic not found: {topic_id}")
    if try_get_topic(paths, feeds_into_id) is None:
        raise ApplyConflictError(f"Feeds-into topic not found: {feeds_into_id}")
    return append_topic_link(paths, topic_id, feeds_into_id=feeds_into_id)


def apply_session(
    paths: ProjectPaths,
    session_id: str,
    *,
    force: bool = False,
) -> list[TopicRecord]:
    session = load_session(paths, session_id)
    created: list[TopicRecord] = []
    for proposal_id in session.proposals:
        proposal = load_proposal(paths, proposal_id)
        if proposal.state != ProposalState.accepted:
            continue
        if proposal.kind == "create_component":
            topic = _apply_create_component(paths, proposal, force=force)
            promote_proposal(paths, proposal.id)
            created.append(topic)
        elif proposal.kind == "add_dependency":
            topic = _apply_add_dependency(paths, proposal)
            promote_proposal(paths, proposal.id)
            created.append(topic)
        elif proposal.kind == "add_feeds_into":
            topic = _apply_add_feeds_into(paths, proposal)
            promote_proposal(paths, proposal.id)
            created.append(topic)
    return created
