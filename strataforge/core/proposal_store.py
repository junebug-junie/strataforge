import json
from datetime import datetime
from typing import Any

from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import (
    PROPOSAL_RECORDS_KEY,
    get_proposal_records,
    load_session,
    save_session,
)
from strataforge.core.status import ProposalState
from strataforge.models import Proposal

_ACTION_TO_STATE: dict[str, ProposalState] = {
    "accept": ProposalState.accepted,
    "reject": ProposalState.rejected,
    "defer": ProposalState.deferred,
    "out-of-scope": ProposalState.out_of_scope,
    "revise": ProposalState.revised,
}


def _make_proposal_id(session_id: str, index: int) -> str:
    slug = session_id.split(":", 1)[-1]
    return f"proposal:{slug}-{index:03d}"


def _find_session_for_proposal(paths: ProjectPaths, proposal_id: str) -> str | None:
    if not paths.sessions_dir.exists():
        return None
    for path in paths.sessions_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        records = data.get(PROPOSAL_RECORDS_KEY, {})
        if proposal_id in records:
            return data["id"]
    return None


def add_proposal(
    paths: ProjectPaths,
    *,
    session_id: str,
    kind: str,
    title: str,
    proposed_changes: dict[str, Any] | None = None,
    topic_id: str | None = None,
    summary: str = "",
    rationale: str = "",
) -> Proposal:
    session = load_session(paths, session_id)
    records = get_proposal_records(paths, session_id)
    proposal_id = _make_proposal_id(session_id, len(session.proposals) + 1)
    proposal = Proposal(
        id=proposal_id,
        session_id=session_id,
        topic_id=topic_id,
        kind=kind,
        title=title,
        summary=summary,
        rationale=rationale,
        proposed_changes=proposed_changes or {},
    )
    records[proposal_id] = proposal.model_dump(mode="json")
    session.proposals.append(proposal_id)
    save_session(paths, session, records)
    return proposal


def load_proposal(paths: ProjectPaths, proposal_id: str) -> Proposal:
    session_id = _find_session_for_proposal(paths, proposal_id)
    if session_id is None:
        raise KeyError(f"Proposal not found: {proposal_id}")
    records = get_proposal_records(paths, session_id)
    return Proposal.model_validate(records[proposal_id])


def set_proposal_action(
    paths: ProjectPaths,
    proposal_id: str,
    *,
    action: str,
    note: str = "",
    reviewed_at: datetime,
) -> Proposal:
    if action not in _ACTION_TO_STATE:
        raise ValueError(f"Unknown action: {action}")
    session_id = _find_session_for_proposal(paths, proposal_id)
    if session_id is None:
        raise KeyError(f"Proposal not found: {proposal_id}")
    session = load_session(paths, session_id)
    records = get_proposal_records(paths, session_id)
    proposal = Proposal.model_validate(records[proposal_id])
    proposal.state = _ACTION_TO_STATE[action]
    proposal.human_review = {
        "action": action,
        "note": note,
        "reviewed_at": reviewed_at.isoformat(),
    }
    records[proposal_id] = proposal.model_dump(mode="json")
    session.updated_at = reviewed_at
    save_session(paths, session, records)
    return proposal


def promote_proposal(paths: ProjectPaths, proposal_id: str) -> Proposal:
    session_id = _find_session_for_proposal(paths, proposal_id)
    if session_id is None:
        raise KeyError(f"Proposal not found: {proposal_id}")
    records = get_proposal_records(paths, session_id)
    proposal = Proposal.model_validate(records[proposal_id])
    proposal.state = ProposalState.promoted_to_scaffold
    records[proposal_id] = proposal.model_dump(mode="json")
    session = load_session(paths, session_id)
    save_session(paths, session, records)
    return proposal
