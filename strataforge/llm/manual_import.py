import json
import re
from typing import Any


class ProposalBundleError(ValueError):
    """Raised when pasted proposal JSON is malformed or incomplete."""


def parse_llm_paste_text(text: str) -> dict[str, Any]:
    """Extract a proposal bundle object from raw LLM paste (JSON, fenced, or embedded)."""
    trimmed = text.strip()
    if not trimmed:
        raise ProposalBundleError("Paste is empty")

    try:
        parsed = json.loads(trimmed)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed, re.IGNORECASE)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1).strip())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            raise ProposalBundleError(f"JSON inside markdown fence is invalid: {exc}") from exc

    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(trimmed[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            raise ProposalBundleError(f"Could not parse JSON object from paste: {exc}") from exc

    raise ProposalBundleError(
        "Could not find a JSON object. Paste the LLM response (JSON only), not the prompt you sent."
    )


def parse_proposal_bundle(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize pasted LLM proposal JSON into internal proposal dicts."""
    if not isinstance(raw, dict):
        raise ProposalBundleError("Proposal bundle must be a JSON object")

    proposals_raw = raw.get("proposals")
    if proposals_raw is None:
        raise ProposalBundleError("Missing required field: proposals")
    if not isinstance(proposals_raw, list):
        raise ProposalBundleError("Field 'proposals' must be an array")

    proposals: list[dict[str, Any]] = []
    for index, item in enumerate(proposals_raw):
        if not isinstance(item, dict):
            raise ProposalBundleError(f"proposals[{index}] must be an object")
        kind = item.get("kind")
        title = item.get("title")
        if not kind or not isinstance(kind, str):
            raise ProposalBundleError(f"proposals[{index}] missing required string field: kind")
        if not title or not isinstance(title, str):
            raise ProposalBundleError(f"proposals[{index}] missing required string field: title")

        proposed_changes = item.get("proposed_changes") or {}
        if not isinstance(proposed_changes, dict):
            raise ProposalBundleError(f"proposals[{index}].proposed_changes must be an object")

        topic_id = item.get("topic_id") or proposed_changes.get("topic_id")
        proposals.append(
            {
                "kind": kind,
                "title": title,
                "summary": item.get("summary", "") if isinstance(item.get("summary"), str) else "",
                "rationale": item.get("rationale", "") if isinstance(item.get("rationale"), str) else "",
                "proposed_changes": dict(proposed_changes),
                "topic_id": topic_id if isinstance(topic_id, str) else None,
            }
        )
    return {
        "session_mode": raw.get("session_mode", "intake"),
        "summary": raw.get("summary", "") if isinstance(raw.get("summary"), str) else "",
        "proposals": proposals,
    }
