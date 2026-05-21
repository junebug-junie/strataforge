from pathlib import Path

from strataforge.core.manifest import init_project
from strataforge.core.paths import ProjectPaths
from strataforge.core.status import DesignStatus, ReviewState
from strataforge.core.topic_store import create_topic_scaffold
from strataforge.llm.coherence import score_topic, scan_project
from strataforge.models import CoverageFlags, TopicRecord


def test_score_increases_with_open_questions_and_dependency():
    topic = TopicRecord(
        id="topic:x",
        title="X",
        path="areas/x.md",
        level="leaf",
        status=DesignStatus.expanded,
        review_state=ReviewState.needs_revision,
        coverage=CoverageFlags(needs_reconciliation=True),
        depends_on=["topic:a", "topic:b", "topic:c"],
    )
    score, reasons = score_topic(topic, open_question_count=3, days_since_review=20)
    assert score >= 10
    assert "expanded_without_reconciliation" in reasons
    assert "needs_revision" in reasons
    assert "stale_review" in reasons
    assert "high_dependency_degree" in reasons


def test_scan_project_returns_ranked_radar_items(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    init_project(paths.root, "P")
    hot = create_topic_scaffold(
        paths,
        topic_id="topic:hot",
        title="Hot Topic",
        area_slug="01-hot",
        parent_id=None,
        level="area",
    )
    cold = create_topic_scaffold(
        paths,
        topic_id="topic:cold",
        title="Cold Topic",
        area_slug="02-cold",
        parent_id=None,
        level="area",
    )
    hot_path = paths.root / hot.path
    text = hot_path.read_text()
    text = text.replace("status: scaffolded", "status: expanded")
    text = text.replace(
        "needs_reconciliation: false",
        "needs_reconciliation: true",
    )
    text = text.replace("review_state: accepted", "review_state: needs_revision")
    text = text.replace(
        "depends_on: []",
        'depends_on: ["topic:a", "topic:b", "topic:c"]',
    )
    text = text.replace(
        "## Open Questions\n",
        "## Open Questions\n\n- Q1?\n- Q2?\n- Q3?\n",
    )
    hot_path.write_text(text)

    items = scan_project(paths, max_items=10)
    assert len(items) >= 1
    assert items[0].topic_id == "topic:hot"
    assert items[0].score >= items[-1].score if len(items) > 1 else True
    cold_scores = [i for i in items if i.topic_id == "topic:cold"]
    if cold_scores:
        assert cold_scores[0].score < items[0].score


def test_scan_project_respects_max_items(tmp_path: Path):
    paths = ProjectPaths(tmp_path / "p")
    manifest = init_project(paths.root, "P")
    manifest.settings["radar"] = {"max_items": 2}
    from strataforge.core.manifest import save_manifest

    save_manifest(paths, manifest)
    for idx in range(4):
        create_topic_scaffold(
            paths,
            topic_id=f"topic:t{idx}",
            title=f"T{idx}",
            area_slug=f"0{idx}-area",
            parent_id=None,
            level="area",
        )
    items = scan_project(paths)
    assert len(items) <= 2
