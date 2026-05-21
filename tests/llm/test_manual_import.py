import json
from pathlib import Path

import pytest

from strataforge.llm.manual_import import ProposalBundleError, parse_llm_paste_text, parse_proposal_bundle


def test_parse_intake_proposal_bundle():
    raw = Path("fixtures/intake_proposals.json").read_text()
    bundle = parse_proposal_bundle(json.loads(raw))
    assert bundle["session_mode"] == "intake"
    assert len(bundle["proposals"]) >= 2
    assert bundle["proposals"][0]["kind"] == "create_component"


def test_parse_proposal_bundle_requires_kind_and_title():
    with pytest.raises(ProposalBundleError, match="kind"):
        parse_proposal_bundle({"proposals": [{"title": "Missing kind"}]})
    with pytest.raises(ProposalBundleError, match="title"):
        parse_proposal_bundle({"proposals": [{"kind": "create_component"}]})


def test_parse_llm_paste_text_accepts_fenced_json():
    raw = """Sure! Here you go:

```json
{"session_mode": "intake", "proposals": [{"kind": "create_component", "title": "A", "proposed_changes": {}}]}
```

Hope that helps!"""
    bundle = parse_llm_paste_text(raw)
    assert bundle["session_mode"] == "intake"
    assert bundle["proposals"][0]["title"] == "A"


def test_parse_llm_paste_text_accepts_embedded_object():
    raw = 'Some intro {"session_mode": "intake", "proposals": [{"kind": "create_component", "title": "B", "proposed_changes": {}}]} trailing'
    bundle = parse_llm_paste_text(raw)
    assert bundle["proposals"][0]["title"] == "B"
