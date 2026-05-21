import json
from datetime import datetime, timezone
from pathlib import Path

from typer.testing import CliRunner

from strataforge.cli import app
from strataforge.core.paths import ProjectPaths
from strataforge.core.proposal_store import load_proposal, set_proposal_action
from strataforge.core.session_store import load_session
from strataforge.core.topic_store import get_topic, list_topics
from strataforge.core.validation import validate_project
from strataforge.llm.coherence import scan_project
from strataforge.llm.prompts import build_expansion_prompt

runner = CliRunner()


def _parse_session_id(stdout: str) -> str:
    for line in stdout.splitlines():
        if line.startswith("Started "):
            return line.removeprefix("Started ").strip()
    raise AssertionError(f"Session id not found in output: {stdout!r}")


def _build_proposal_bundle() -> dict:
    base = json.loads(Path("fixtures/intake_proposals.json").read_text())
    base["proposals"].extend(
        [
            {
                "kind": "create_component",
                "title": "Agent Runtime",
                "summary": "Autonomous agent loop",
                "rationale": "Out of MVP scope",
                "proposed_changes": {
                    "area_slug": "09-agent-runtime",
                    "topic_id": "topic:agent-runtime",
                    "title": "Agent Runtime",
                    "level": "area",
                },
            },
            {
                "kind": "create_component",
                "title": "Vector Search",
                "summary": "Semantic retrieval",
                "rationale": "Deferred post-MVP",
                "proposed_changes": {
                    "area_slug": "10-vector-search",
                    "topic_id": "topic:vector-search",
                    "title": "Vector Search",
                    "level": "area",
                },
            },
        ]
    )
    return base


def test_mvp_walkthrough(tmp_path: Path):
    project = tmp_path / "demo"
    now = datetime.now(timezone.utc)

    # 1. init project
    result = runner.invoke(app, ["init", str(project), "--title", "MVP Walkthrough"])
    assert result.exit_code == 0, result.stdout

    paths = ProjectPaths(project)

    # 2. start intake session, set source prompt
    result = runner.invoke(
        app,
        [
            "session",
            "start",
            "--project",
            str(project),
            "--title",
            "Initial decomposition",
            "--mode",
            "intake",
        ],
    )
    assert result.exit_code == 0, result.stdout
    session_id = _parse_session_id(result.stdout)

    prompt_file = tmp_path / "intake-idea.md"
    prompt_file.write_text(
        "A local-first HITL architecture design pairing plane with gated sessions."
    )
    result = runner.invoke(
        app,
        [
            "session",
            "set-input",
            session_id,
            "--project",
            str(project),
            "--prompt-file",
            str(prompt_file),
        ],
    )
    assert result.exit_code == 0, result.stdout
    session = load_session(paths, session_id)
    assert session.inputs["source_prompt"] == prompt_file.read_text()

    # 3. import proposals from fixtures/intake_proposals.json (+ extra for reject/defer)
    bundle_path = tmp_path / "intake_proposals.json"
    bundle_path.write_text(json.dumps(_build_proposal_bundle(), indent=2))
    result = runner.invoke(
        app,
        [
            "session",
            "import-proposals",
            session_id,
            "--project",
            str(project),
            "--file",
            str(bundle_path),
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert "Imported 4 proposals" in result.stdout

    session = load_session(paths, session_id)
    assert len(session.proposals) == 4
    proposals = [load_proposal(paths, pid) for pid in session.proposals]
    by_topic = {p.proposed_changes["topic_id"]: p for p in proposals}

    # 4. accept 2, reject 1, defer 1
    set_proposal_action(
        paths, by_topic["topic:session-runtime"].id, action="accept", note="core", reviewed_at=now
    )
    set_proposal_action(
        paths, by_topic["topic:topic-store"].id, action="accept", note="core", reviewed_at=now
    )
    set_proposal_action(
        paths,
        by_topic["topic:agent-runtime"].id,
        action="reject",
        note="out of MVP",
        reviewed_at=now,
    )
    set_proposal_action(
        paths,
        by_topic["topic:vector-search"].id,
        action="defer",
        note="post-MVP",
        reviewed_at=now,
    )

    # 5. apply session -> exactly 2 topic files
    result = runner.invoke(
        app,
        ["apply", session_id, "--project", str(project)],
    )
    assert result.exit_code == 0, result.stdout
    topics = list_topics(paths)
    assert len(topics) == 2
    topic_files = list(project.glob("areas/**/*.md"))
    assert len(topic_files) == 2

    # 6. validate passes
    result = runner.invoke(app, ["validate", "--path", str(project)])
    assert result.exit_code == 0, result.stdout
    assert validate_project(paths) == []

    expanded_topic_id = "topic:session-runtime"
    expanded_marker = "EXPANDED_WORK_MARKER: detailed runtime design"
    expanded_topic = next(t for t in topics if t.id == expanded_topic_id)
    topic_path = project / expanded_topic.path

    # Mark one topic expanded + needs_reconciliation for radar
    text = topic_path.read_text()
    text = text.replace("status: scaffolded", "status: expanded")
    text = text.replace("needs_reconciliation: false", "needs_reconciliation: true")
    text = text.replace(
        "## Current Design\n",
        f"## Current Design\n\n{expanded_marker}\n",
    )
    topic_path.write_text(text)

    # 7. radar returns >=1 item after marking one topic expanded+needs_reconciliation
    result = runner.invoke(app, ["radar", "--path", str(project)])
    assert result.exit_code == 0, result.stdout
    assert "No coherence pressure detected." not in result.stdout
    items = scan_project(paths)
    assert len(items) >= 1
    assert any(item.topic_id == expanded_topic_id for item in items)

    # 8. expansion prompt contains topic id
    prompt = build_expansion_prompt(paths, expanded_topic_id)
    assert expanded_topic_id in prompt
    result = runner.invoke(
        app,
        ["prompt", "expand", expanded_topic_id, "--project", str(project)],
    )
    assert result.exit_code == 0, result.stdout
    assert expanded_topic_id in result.stdout

    # 9. apply again without force does NOT truncate expanded body
    set_proposal_action(
        paths,
        by_topic[expanded_topic_id].id,
        action="accept",
        note="re-accept after expansion",
        reviewed_at=now,
    )
    result = runner.invoke(
        app,
        ["apply", session_id, "--project", str(project)],
    )
    assert result.exit_code == 1, result.stdout
    _, body = get_topic(paths, expanded_topic_id)
    assert expanded_marker in body
