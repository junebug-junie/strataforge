"""UI-facing recommended next commands for a topic workspace."""

from __future__ import annotations

from strataforge.core.paths import ProjectPaths
from strataforge.core.status import DesignStatus
from strataforge.core.topic_store import get_topic
from strataforge.llm.coherence import count_open_questions, days_since_review, score_topic


def recommended_ui_commands(paths: ProjectPaths, topic_id: str) -> list[str]:
    """Return action ids matching topic workspace buttons (expand, decompose, link, …)."""
    topic, body = get_topic(paths, topic_id)
    score, reasons = score_topic(
        topic,
        open_question_count=count_open_questions(body),
        days_since_review=days_since_review(topic),
    )

    ordered: list[str] = []

    def add(cmd: str) -> None:
        if cmd not in ordered:
            ordered.append(cmd)

    if topic.status == DesignStatus.scaffolded:
        add("expand")
    if topic.status in (DesignStatus.expanded, DesignStatus.reconciled):
        add("expand")
        add("decompose")
    if topic.status == DesignStatus.execution_ready:
        add("decompose")

    add("link")
    add("boundary-check")

    if topic.coverage.needs_reconciliation or "expanded_without_reconciliation" in reasons:
        add("reconcile-parent")
    if "needs_revision" in reasons or score >= 8:
        add("expand")
    if not topic.depends_on and topic.status != DesignStatus.scaffolded:
        add("link")

    return ordered
