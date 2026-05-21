from typing import Any


def parse_proposal_bundle(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize pasted LLM proposal JSON into internal proposal dicts."""
    proposals: list[dict[str, Any]] = []
    for item in raw.get("proposals", []):
        proposed_changes = dict(item.get("proposed_changes") or {})
        topic_id = item.get("topic_id") or proposed_changes.get("topic_id")
        proposals.append(
            {
                "kind": item["kind"],
                "title": item["title"],
                "summary": item.get("summary", ""),
                "rationale": item.get("rationale", ""),
                "proposed_changes": proposed_changes,
                "topic_id": topic_id,
            }
        )
    return {
        "session_mode": raw.get("session_mode", "intake"),
        "summary": raw.get("summary", ""),
        "proposals": proposals,
    }
