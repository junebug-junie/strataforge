"""JSON shapes for structured LLM outputs."""

PROPOSAL_BUNDLE_JSON_HINT = """
Respond with a single JSON object only (no markdown prose). Required shape:
{
  "session_mode": "intake|decompose|link",
  "summary": "short string",
  "proposals": [
    {
      "kind": "create_component|add_dependency|add_feeds_into",
      "title": "string",
      "summary": "string",
      "rationale": "string",
      "topic_id": "optional topic:id",
      "proposed_changes": { }
    }
  ]
}
""".strip()
