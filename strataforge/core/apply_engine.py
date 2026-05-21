from strataforge.core.paths import ProjectPaths
from strataforge.core.proposal_store import load_proposal, promote_proposal
from strataforge.core.session_store import load_session
from strataforge.core.status import DesignStatus, ProposalState
from strataforge.core.topic_store import create_topic_scaffold, try_get_topic
from strataforge.models import TopicRecord


class ApplyConflictError(Exception):
    pass


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
        if proposal.kind != "create_component":
            continue
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
            level=changes.get("level", "area"),
        )
        promote_proposal(paths, proposal.id)
        created.append(topic)
    return created
