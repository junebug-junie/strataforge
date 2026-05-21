"""Session-scoped LLM run + import pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from strataforge.core.apply_engine import apply_session
from strataforge.core.paths import ProjectPaths
from strataforge.core.proposal_store import add_proposal, load_proposal, set_proposal_action
from strataforge.core.status import ProposalState
from strataforge.core.session_store import load_session
from strataforge.llm.manual_import import ProposalBundleError, parse_llm_paste_text, parse_proposal_bundle
from strataforge.llm.prompts import build_decompose_prompt, build_intake_prompt, build_link_prompt
from strataforge.llm.providers import complete_text
from strataforge.llm.schemas import PROPOSAL_BUNDLE_JSON_HINT


@dataclass
class SessionLlmResult:
    text: str
    model: str
    command: str
    imported: bool
    proposal_count: int
    parse_error: str | None
    accepted_count: int
    applied: bool
    created: list[dict]


def _build_session_prompt(
    paths: ProjectPaths,
    session_id: str,
    command: str,
    source_prompt: str | None,
) -> str:
    session = load_session(paths, session_id)
    if command == "intake":
        saved = session.inputs.get("source_prompt", "")
        idea = source_prompt if source_prompt is not None else str(saved or "")
        base = build_intake_prompt(paths, session_id=session_id, source_prompt=idea)
    elif command == "decompose":
        if not session.topic_id:
            raise ValueError("Session has no topic_id for decompose")
        base = build_decompose_prompt(paths, session.topic_id, session_id=session_id)
    elif command == "link":
        if not session.topic_id:
            raise ValueError("Session has no topic_id for link")
        base = build_link_prompt(paths, session.topic_id, session_id=session_id)
    else:
        raise ValueError(f"Unknown command: {command}")
    return f"{base}\n\n{PROPOSAL_BUNDLE_JSON_HINT}"


def _import_bundle(paths: ProjectPaths, session_id: str, bundle: dict) -> int:
    count = 0
    for item in bundle["proposals"]:
        add_proposal(
            paths,
            session_id=session_id,
            kind=item["kind"],
            title=item["title"],
            summary=item.get("summary", ""),
            rationale=item.get("rationale", ""),
            proposed_changes=item.get("proposed_changes", {}),
            topic_id=item.get("topic_id"),
        )
        count += 1
    return count


def _accept_all_proposed(paths: ProjectPaths, session_id: str) -> int:
    session = load_session(paths, session_id)
    now = datetime.now(timezone.utc)
    accepted = 0
    for proposal_id in session.proposals:
        try:
            proposal = load_proposal(paths, proposal_id)
        except KeyError:
            continue
        if proposal.state == ProposalState.proposed:
            set_proposal_action(
                paths,
                proposal_id,
                action="accept",
                note="Accepted via LLM pipeline",
                reviewed_at=now,
            )
            accepted += 1
    return accepted


def _count_accepted(paths: ProjectPaths, session_id: str) -> int:
    session = load_session(paths, session_id)
    count = 0
    for proposal_id in session.proposals:
        try:
            if load_proposal(paths, proposal_id).state == ProposalState.accepted:
                count += 1
        except KeyError:
            continue
    return count


def run_session_llm_pipeline(
    paths: ProjectPaths,
    session_id: str,
    command: str,
    *,
    source_prompt: str | None = None,
    accept_all: bool = False,
    apply: bool = False,
    structured: bool = True,
) -> SessionLlmResult:
    from strataforge.config import settings

    prompt = _build_session_prompt(paths, session_id, command, source_prompt)
    text = complete_text(prompt, json_mode=structured)
    result = SessionLlmResult(
        text=text,
        model=settings.openai_model,
        command=command,
        imported=False,
        proposal_count=0,
        parse_error=None,
        accepted_count=0,
        applied=False,
        created=[],
    )

    try:
        raw = parse_llm_paste_text(text)
        bundle = parse_proposal_bundle(raw)
        result.proposal_count = _import_bundle(paths, session_id, bundle)
        result.imported = result.proposal_count > 0
    except ProposalBundleError as exc:
        result.parse_error = str(exc)
        return result

    if accept_all:
        result.accepted_count = _accept_all_proposed(paths, session_id)

    if apply:
        if _count_accepted(paths, session_id) == 0:
            return result
        created = apply_session(paths, session_id, force=False)
        result.applied = True
        result.created = [t.model_dump(mode="json") for t in created]
    elif accept_all:
        result.accepted_count = _count_accepted(paths, session_id)

    return result
