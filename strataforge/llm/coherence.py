import re
from datetime import date, datetime, timezone

from strataforge.core.manifest import load_manifest
from strataforge.core.paths import ProjectPaths
from strataforge.core.status import DesignStatus, ReviewState
from strataforge.core.topic_store import get_topic
from strataforge.models import RadarItem, TopicRecord


def score_topic(
    topic: TopicRecord,
    *,
    open_question_count: int,
    days_since_review: int | None,
) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    dep_degree = len(topic.depends_on)
    score += dep_degree * 2
    if dep_degree >= 3:
        reasons.append("high_dependency_degree")
    score += open_question_count
    if topic.status == DesignStatus.expanded and topic.coverage.needs_reconciliation:
        score += 5
        reasons.append("expanded_without_reconciliation")
    if topic.review_state == ReviewState.needs_revision:
        score += 5
        reasons.append("needs_revision")
    if days_since_review and days_since_review > 14:
        score += 4
        reasons.append("stale_review")
    return score, reasons


def _extract_section(body: str, heading: str) -> str:
    pattern = rf"^## {re.escape(heading)}\s*$"
    lines = body.splitlines()
    start = None
    for index, line in enumerate(lines):
        if re.match(pattern, line.strip()):
            start = index + 1
            break
    if start is None:
        return ""
    collected: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        collected.append(line)
    return "\n".join(collected).strip()


def count_open_questions(body: str) -> int:
    section = _extract_section(body, "Open Questions")
    if not section:
        return 0
    count = 0
    for line in section.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ") and stripped != "- TBD":
            count += 1
    return count


def days_since_review(topic: TopicRecord, *, today: date | None = None) -> int | None:
    reference = today or date.today()
    if topic.last_reviewed:
        return (reference - topic.last_reviewed).days
    if topic.updated_at:
        return (reference - topic.updated_at).days
    return None


def _severity_for_score(score: int) -> str:
    if score >= 15:
        return "high"
    if score >= 8:
        return "medium"
    return "low"


def _summary_for(topic: TopicRecord, reasons: list[str]) -> str:
    if not reasons:
        return f"{topic.title}: no coherence pressure signals."
    joined = ", ".join(reasons)
    return f"{topic.title}: {joined}"


def _recommended_commands(reasons: list[str]) -> list[str]:
    commands: list[str] = []
    if "expanded_without_reconciliation" in reasons:
        commands.append("strata prompt reconcile-parent")
    if "needs_revision" in reasons or "high_dependency_degree" in reasons:
        commands.append("strata prompt expand")
    if "stale_review" in reasons:
        commands.append("strata show")
    return commands


def _radar_max_items(manifest_settings: dict) -> int:
    radar = manifest_settings.get("radar") or {}
    return int(radar.get("max_items", 10))


def _all_topic_refs(paths: ProjectPaths) -> list[TopicRecord]:
    manifest = load_manifest(paths)
    return manifest.root_areas + manifest.topics


def scan_project(paths: ProjectPaths, *, max_items: int | None = None) -> list[RadarItem]:
    manifest = load_manifest(paths)
    limit = max_items if max_items is not None else _radar_max_items(manifest.settings)
    scored: list[tuple[int, list[str], TopicRecord]] = []

    for ref in _all_topic_refs(paths):
        topic, body = get_topic(paths, ref.id)
        score, reasons = score_topic(
            topic,
            open_question_count=count_open_questions(body),
            days_since_review=days_since_review(topic),
        )
        if score > 0:
            scored.append((score, reasons, topic))

    scored.sort(key=lambda row: (-row[0], row[2].id))
    now = datetime.now(timezone.utc)
    today = date.today().isoformat()
    items: list[RadarItem] = []
    for score, reasons, topic in scored[:limit]:
        items.append(
            RadarItem(
                id=f"radar:{topic.id}:{today}",
                topic_id=topic.id,
                title=topic.title,
                severity=_severity_for_score(score),
                score=score,
                reason_codes=reasons,
                summary=_summary_for(topic, reasons),
                recommended_commands=_recommended_commands(reasons),
                created_at=now,
            )
        )
    return items


def project_status_counts(paths: ProjectPaths) -> dict[str, int]:
    counts: dict[str, int] = {}
    for ref in _all_topic_refs(paths):
        topic, _body = get_topic(paths, ref.id)
        key = topic.status.value
        counts[key] = counts.get(key, 0) + 1
    return counts


def project_gaps(paths: ProjectPaths) -> dict[str, list[str]]:
    gaps: dict[str, list[str]] = {
        "needs_reconciliation": [],
        "needs_code_review": [],
        "needs_design": [],
        "out_of_scope": [],
        "execution_ready": [],
        "stale": [],
    }
    for ref in _all_topic_refs(paths):
        topic, _body = get_topic(paths, ref.id)
        if topic.coverage.needs_reconciliation:
            gaps["needs_reconciliation"].append(topic.id)
        if topic.coverage.needs_code_review:
            gaps["needs_code_review"].append(topic.id)
        if topic.coverage.needs_design:
            gaps["needs_design"].append(topic.id)
        if topic.coverage.out_of_scope:
            gaps["out_of_scope"].append(topic.id)
        if topic.status == DesignStatus.execution_ready:
            gaps["execution_ready"].append(topic.id)
        if topic.status == DesignStatus.stale:
            gaps["stale"].append(topic.id)
    return {key: ids for key, ids in gaps.items() if ids}
