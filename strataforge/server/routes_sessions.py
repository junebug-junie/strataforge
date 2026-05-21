from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from strataforge.core.apply_engine import ApplyConflictError, apply_session
from strataforge.core.proposal_store import add_proposal, load_proposal
from strataforge.core.session_store import create_session, list_sessions, load_session, save_session
from strataforge.llm.manual_import import ProposalBundleError, parse_proposal_bundle
from strataforge.llm.prompts import build_intake_prompt
from strataforge.server.deps import resolve_project_paths

router = APIRouter(prefix="/api/projects/{project_id}/sessions", tags=["sessions"])


class StartSessionRequest(BaseModel):
    title: str
    mode: str = "intake"
    topic_id: str | None = None


class ImportProposalsRequest(BaseModel):
    session_mode: str | None = None
    summary: str = ""
    proposals: list[dict] = Field(default_factory=list)


class ImportProposalsResponse(BaseModel):
    count: int
    proposals: list[dict]


class ApplySessionResponse(BaseModel):
    created: list[dict]


class IntakePromptResponse(BaseModel):
    command: str = "intake"
    session_id: str
    prompt: str


class UpdateSessionRequest(BaseModel):
    inputs: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


@router.get("")
def list_project_sessions(project_id: str, mode: str | None = None) -> list[dict]:
    paths = resolve_project_paths(project_id)
    sessions = list_sessions(paths)
    if mode is not None:
        sessions = [session for session in sessions if session.mode == mode]
    return [session.model_dump(mode="json") for session in sessions]


@router.post("", status_code=201)
def start_session(project_id: str, body: StartSessionRequest) -> dict:
    paths = resolve_project_paths(project_id)
    now = datetime.now(timezone.utc)
    session = create_session(
        paths,
        title=body.title,
        mode=body.mode,
        created_at=now,
        topic_id=body.topic_id,
    )
    return session.model_dump(mode="json")


@router.get("/{session_id}")
def get_session_detail(project_id: str, session_id: str) -> dict:
    paths = resolve_project_paths(project_id)
    try:
        session = load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None
    proposals = []
    for proposal_id in session.proposals:
        try:
            proposal = load_proposal(paths, proposal_id)
            proposals.append(proposal.model_dump(mode="json"))
        except KeyError:
            continue
    data = session.model_dump(mode="json")
    data["proposals"] = proposals
    return data


@router.get("/{session_id}/prompts/intake", response_model=IntakePromptResponse)
def get_intake_prompt(
    project_id: str,
    session_id: str,
    source_prompt: str | None = None,
) -> IntakePromptResponse:
    paths = resolve_project_paths(project_id)
    try:
        session = load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None

    saved_prompt = session.inputs.get("source_prompt", "")
    idea = source_prompt if source_prompt is not None else str(saved_prompt or "")
    prompt = build_intake_prompt(paths, session_id=session_id, source_prompt=idea)
    return IntakePromptResponse(session_id=session_id, prompt=prompt)


@router.put("/{session_id}")
def update_session(project_id: str, session_id: str, body: UpdateSessionRequest) -> dict:
    paths = resolve_project_paths(project_id)
    try:
        session = load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None
    session.inputs.update(body.inputs)
    session.updated_at = datetime.now(timezone.utc)
    save_session(paths, session)
    return session.model_dump(mode="json")


@router.post("/{session_id}/import", response_model=ImportProposalsResponse)
def import_proposals(
    project_id: str,
    session_id: str,
    body: ImportProposalsRequest,
) -> ImportProposalsResponse:
    paths = resolve_project_paths(project_id)
    try:
        load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None

    try:
        bundle = parse_proposal_bundle(body.model_dump())
    except ProposalBundleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    created: list[dict] = []
    for item in bundle["proposals"]:
        proposal = add_proposal(
            paths,
            session_id=session_id,
            kind=item["kind"],
            title=item["title"],
            summary=item.get("summary", ""),
            rationale=item.get("rationale", ""),
            proposed_changes=item.get("proposed_changes", {}),
            topic_id=item.get("topic_id"),
        )
        created.append(proposal.model_dump(mode="json"))
    return ImportProposalsResponse(count=len(created), proposals=created)


@router.post("/{session_id}/apply", response_model=ApplySessionResponse)
def apply_session_route(
    project_id: str,
    session_id: str,
    force: bool = False,
) -> ApplySessionResponse:
    paths = resolve_project_paths(project_id)
    try:
        load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None
    try:
        created = apply_session(paths, session_id, force=force)
    except ApplyConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ApplySessionResponse(
        created=[topic.model_dump(mode="json") for topic in created],
    )
