import re

from strataforge.core.manifest import load_manifest
from strataforge.core.paths import ProjectPaths
from strataforge.core.topic_store import get_topic
from strataforge.models import TopicRecord

EXPANSION_TEMPLATE = """You are expanding one StrataForge topic.

Topic:
- id
- title
- status

Read:
- strata.yaml
- current topic
- parent topic
- direct children
- sibling summaries

Do not:
- redesign unrelated areas
- create new top-level areas
- change statuses unless instructed

Task:
- fill purpose
- sharpen boundary
- list interfaces
- identify risks
- add open questions
- add parent-impact notes

Output:
- patch for current topic only
- proposals for other files only
- next recommended command"""

RECONCILIATION_TEMPLATE = """You are reconciling a parent topic with its children.

Read:
- parent topic
- all direct child summaries
- child open questions
- dependencies among children

Task:
- summarize what children imply
- identify conflicts
- identify missing interfaces
- identify stale sections
- propose parent updates

Do not:
- rewrite children unless explicitly requested"""


def _all_topics(manifest) -> list[TopicRecord]:
    return manifest.root_areas + manifest.topics


def _manifest_summary(manifest) -> str:
    lines = [f"- {topic.id}: {topic.title}" for topic in _all_topics(manifest)]
    return "\n".join(lines) if lines else "(none)"


def _first_heading(body: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return ""


def _section_heading(title: str) -> str:
    return f"## {title}\n"


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


def _load_expansion_context(paths: ProjectPaths, topic_id: str) -> dict[str, str]:
    manifest = load_manifest(paths)
    topic, body = get_topic(paths, topic_id)

    parent_block = "(none)"
    if topic.parent:
        parent, parent_body = get_topic(paths, topic.parent)
        parent_block = (
            f"- id: {parent.id}\n"
            f"- title: {parent.title}\n"
            f"- status: {parent.status.value}\n\n"
            f"{parent_body}"
        )

    children_lines = [
        f"- {child.id}: {child.title}"
        for child in _all_topics(manifest)
        if child.parent == topic_id
    ]
    children_block = "\n".join(children_lines) if children_lines else "(none)"

    sibling_lines: list[str] = []
    if topic.parent:
        for sibling in _all_topics(manifest):
            if sibling.parent == topic.parent and sibling.id != topic_id:
                _, sibling_body = get_topic(paths, sibling.id)
                one_liner = _first_heading(sibling_body) or sibling.title
                sibling_lines.append(f"- {sibling.id}: {one_liner}")
    siblings_block = "\n".join(sibling_lines) if sibling_lines else "(none)"

    return {
        "topic_id": topic.id,
        "topic_title": topic.title,
        "topic_status": topic.status.value,
        "manifest_summary": _manifest_summary(manifest),
        "current_topic_body": body,
        "parent_block": parent_block,
        "children_block": children_block,
        "siblings_block": siblings_block,
    }


def _load_reconciliation_context(paths: ProjectPaths, topic_id: str) -> dict[str, str]:
    manifest = load_manifest(paths)
    parent, parent_body = get_topic(paths, topic_id)
    children = [topic for topic in _all_topics(manifest) if topic.parent == topic_id]

    child_summaries: list[str] = []
    child_questions: list[str] = []
    dependency_lines: list[str] = []

    for child in children:
        _, child_body = get_topic(paths, child.id)
        summary = _first_heading(child_body) or child.title
        child_summaries.append(f"- {child.id} ({child.title}): {summary}")
        questions = _extract_section(child_body, "Open Questions")
        if questions:
            child_questions.append(f"### {child.id}\n{questions}")
        deps = child.depends_on
        if deps:
            dependency_lines.append(f"- {child.id} depends on: {', '.join(deps)}")

    return {
        "parent_id": parent.id,
        "parent_title": parent.title,
        "parent_status": parent.status.value,
        "parent_body": parent_body,
        "child_summaries": "\n".join(child_summaries) if child_summaries else "(none)",
        "child_questions": "\n\n".join(child_questions) if child_questions else "(none)",
        "child_dependencies": "\n".join(dependency_lines) if dependency_lines else "(none)",
    }


def build_expansion_prompt(paths: ProjectPaths, topic_id: str) -> str:
    context = _load_expansion_context(paths, topic_id)
    return "\n\n".join(
        [
            EXPANSION_TEMPLATE,
            "Do not redesign unrelated areas.",
            _section_heading("Topic under expansion").strip(),
            f"- id: {context['topic_id']}",
            f"- title: {context['topic_title']}",
            f"- status: {context['topic_status']}",
            _section_heading("Manifest summary (ids + titles)").strip(),
            context["manifest_summary"],
            _section_heading("Current topic body").strip(),
            context["current_topic_body"],
            _section_heading("Parent topic").strip(),
            context["parent_block"],
            _section_heading("Direct children titles").strip(),
            context["children_block"],
            _section_heading("Sibling one-liners").strip(),
            context["siblings_block"],
        ]
    )


def build_reconciliation_prompt(paths: ProjectPaths, topic_id: str) -> str:
    context = _load_reconciliation_context(paths, topic_id)
    return "\n\n".join(
        [
            RECONCILIATION_TEMPLATE,
            _section_heading("Parent topic").strip(),
            f"- id: {context['parent_id']}",
            f"- title: {context['parent_title']}",
            f"- status: {context['parent_status']}",
            context["parent_body"],
            _section_heading("Direct child summaries").strip(),
            context["child_summaries"],
            _section_heading("Child open questions").strip(),
            context["child_questions"],
            _section_heading("Dependencies among children").strip(),
            context["child_dependencies"],
        ]
    )
