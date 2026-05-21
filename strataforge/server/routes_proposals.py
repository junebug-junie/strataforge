from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from strataforge.core.proposal_store import load_proposal, set_proposal_action
from strataforge.server.deps import resolve_project_paths

router = APIRouter(prefix="/api/projects/{project_id}/proposals", tags=["proposals"])


class ProposalActionRequest(BaseModel):
    note: str = ""


def _proposal_action(project_id: str, proposal_id: str, action: str, body: ProposalActionRequest) -> dict:
    paths = resolve_project_paths(project_id)
    try:
        load_proposal(paths, proposal_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Proposal not found: {proposal_id}") from None
    try:
        updated = set_proposal_action(
            paths,
            proposal_id,
            action=action,
            note=body.note,
            reviewed_at=datetime.now(timezone.utc),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return updated.model_dump(mode="json")


@router.post("/{proposal_id}/accept")
def accept_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalActionRequest | None = None,
) -> dict:
    return _proposal_action(project_id, proposal_id, "accept", body or ProposalActionRequest())


@router.post("/{proposal_id}/reject")
def reject_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalActionRequest | None = None,
) -> dict:
    return _proposal_action(project_id, proposal_id, "reject", body or ProposalActionRequest())


@router.post("/{proposal_id}/defer")
def defer_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalActionRequest | None = None,
) -> dict:
    return _proposal_action(project_id, proposal_id, "defer", body or ProposalActionRequest())


@router.post("/{proposal_id}/out-of-scope")
def out_of_scope_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalActionRequest | None = None,
) -> dict:
    return _proposal_action(project_id, proposal_id, "out-of-scope", body or ProposalActionRequest())
