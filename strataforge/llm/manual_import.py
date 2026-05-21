from typing import Any


class ProposalBundleError(ValueError):
    """Raised when pasted proposal JSON is malformed or incomplete."""


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
