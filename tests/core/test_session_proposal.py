from pathlib import Path
from datetime import datetime, timezone
from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.session_store import create_session, load_session
from strataforge.core.proposal_store import add_proposal, set_proposal_action

def test_proposal_accept_records_human_review(tmp_path: Path):
    init_project(tmp_path / "p", "P")
    paths = ProjectPaths(tmp_path / "p")
    now = datetime.now(timezone.utc)
    session = create_session(paths, title="Intake", mode="intake", created_at=now)
    proposal = add_proposal(
        paths,
        session_id=session.id,
        kind="create_component",
        title="Session Runtime",
        proposed_changes={"create_topics": [{"id": "topic:session-runtime", "title": "Session Runtime"}]},
    )
    updated = set_proposal_action(paths, proposal.id, action="accept", note="looks good", reviewed_at=now)
    assert updated.state.value == "accepted"
    assert updated.human_review["action"] == "accept"
