import json
from pathlib import Path

from strataforge.llm.manual_import import parse_proposal_bundle


def test_parse_intake_proposal_bundle():
    raw = Path("fixtures/intake_proposals.json").read_text()
    bundle = parse_proposal_bundle(json.loads(raw))
    assert bundle["session_mode"] == "intake"
    assert len(bundle["proposals"]) >= 2
    assert bundle["proposals"][0]["kind"] == "create_component"
