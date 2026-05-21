from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from strataforge.core.session_store import load_session
from strataforge.core.topic_store import try_get_topic
from strataforge.llm.prompts import (
    build_boundary_prompt,
    build_decompose_prompt,
    build_expansion_prompt,
    build_intake_prompt,
    build_link_prompt,
    build_reconciliation_prompt,
)
from strataforge.llm.providers import (
    LLMCompletionError,
    LLMNotConfiguredError,
    complete_text,
    llm_status,
)
from strataforge.llm.session_llm import run_session_llm_pipeline
from strataforge.server.deps import resolve_project_paths

router = APIRouter(tags=["llm"])


class LlmStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str
    base_url: str


class LlmRunResponse(BaseModel):
    text: str
    model: str
    command: str
    imported: bool = False
    proposal_count: int = 0
    parse_error: str | None = None
    accepted_count: int = 0
    applied: bool = False
    created: list[dict] = Field(default_factory=list)


class LlmPipelineRequest(BaseModel):
    command: str
    source_prompt: str | None = None
    accept_all: bool = False
    apply: bool = False
    structured: bool = True


@router.get("/api/llm/status", response_model=LlmStatusResponse)
def get_llm_status() -> LlmStatusResponse:
    s = llm_status()
    return LlmStatusResponse(
        configured=bool(s["configured"]),
        provider=str(s["provider"]),
        model=str(s["model"]),
        base_url=str(s["base_url"]),
    )


def _run_prompt(prompt: str, command: str, *, json_mode: bool = False) -> LlmRunResponse:
    from strataforge.config import settings

    try:
        text = complete_text(prompt, json_mode=json_mode)
    except LLMNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMCompletionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return LlmRunResponse(text=text, model=settings.openai_model, command=command)


def _pipeline_response(result) -> LlmRunResponse:
    return LlmRunResponse(
        text=result.text,
        model=result.model,
        command=result.command,
        imported=result.imported,
        proposal_count=result.proposal_count,
        parse_error=result.parse_error,
        accepted_count=result.accepted_count,
        applied=result.applied,
        created=result.created,
    )


@router.post(
    "/api/projects/{project_id}/sessions/{session_id}/llm/pipeline",
    response_model=LlmRunResponse,
)
def run_session_llm_pipeline_route(
    project_id: str,
    session_id: str,
    body: LlmPipelineRequest,
) -> LlmRunResponse:
    paths = resolve_project_paths(project_id)
    try:
        load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None

    if body.command not in ("intake", "decompose", "link"):
        raise HTTPException(status_code=400, detail=f"Unknown command: {body.command}")

    try:
        result = run_session_llm_pipeline(
            paths,
            session_id,
            body.command,
            source_prompt=body.source_prompt,
            accept_all=body.accept_all,
            apply=body.apply,
            structured=body.structured,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMCompletionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return _pipeline_response(result)


@router.post(
    "/api/projects/{project_id}/sessions/{session_id}/llm/run",
    response_model=LlmRunResponse,
)
def run_session_llm(
    project_id: str,
    session_id: str,
    command: str = Query(..., pattern="^(intake|decompose|link)$"),
    source_prompt: str | None = None,
    structured: bool = Query(True),
) -> LlmRunResponse:
    """Run LLM, import proposals when JSON parses (no accept/apply)."""
    paths = resolve_project_paths(project_id)
    try:
        load_session(paths, session_id)
    except (FileNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from None

    try:
        result = run_session_llm_pipeline(
            paths,
            session_id,
            command,
            source_prompt=source_prompt,
            accept_all=False,
            apply=False,
            structured=structured,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMCompletionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return _pipeline_response(result)


@router.post(
    "/api/projects/{project_id}/topics/{topic_id}/llm/run",
    response_model=LlmRunResponse,
)
def run_topic_llm(
    project_id: str,
    topic_id: str,
    command: str = Query(
        ...,
        pattern="^(expand|reconcile-parent|boundary-check|decompose|link)$",
    ),
) -> LlmRunResponse:
    paths = resolve_project_paths(project_id)
    if try_get_topic(paths, topic_id) is None:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}")

    session_stub = f"topic-session:{topic_id}"
    if command == "expand":
        prompt = build_expansion_prompt(paths, topic_id)
    elif command == "reconcile-parent":
        prompt = build_reconciliation_prompt(paths, topic_id)
    elif command == "boundary-check":
        prompt = build_boundary_prompt(paths, topic_id)
    elif command == "decompose":
        prompt = build_decompose_prompt(paths, topic_id, session_id=session_stub)
    elif command == "link":
        prompt = build_link_prompt(paths, topic_id, session_id=session_stub)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown command: {command}")

    return _run_prompt(prompt, command, json_mode=False)
