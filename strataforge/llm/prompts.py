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

INTAKE_TEMPLATE = """You are an architecture design partner for StrataForge (manual paste / intake mode).

The human has described an architecture idea. Propose a bounded decomposition into top-level area components.

Do not:
- redesign unrelated areas
- duplicate existing atlas areas listed below
- treat proposals as accepted design
- accept or apply proposals — the human gates each card in the UI

Distinguish proposals from accepted design. Include rationale and risks for each proposal."""

INTAKE_JSON_SCHEMA = """{
  "session_mode": "intake",
  "summary": "Brief summary of proposed decomposition",
  "proposals": [
    {
      "kind": "create_component",
      "title": "Component Name",
      "summary": "One-line description",
      "rationale": "Why this component belongs in the architecture",
      "proposed_changes": {
        "area_slug": "01-component-slug",
        "topic_id": "topic:component-id",
        "title": "Component Name",
        "level": "area"
      }
    }
  ]
}"""

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


def build_intake_prompt(
    paths: ProjectPaths,
    session_id: str,
    source_prompt: str = "",
) -> str:
    manifest = load_manifest(paths)
    idea = source_prompt.strip()
    if not idea:
        idea = "(no architecture idea saved yet — the human should describe their idea in StrataForge first)"

    return "\n\n".join(
        [
            INTAKE_TEMPLATE,
            _section_heading("Architecture idea").strip(),
            idea,
            _section_heading("Project context").strip(),
            f"- project_id: {manifest.project_id}",
            f"- project_title: {manifest.title}",
            f"- session_id: {session_id}",
            "- mode: intake",
            _section_heading("Existing atlas (do not duplicate)").strip(),
            _manifest_summary(manifest),
            _section_heading("Output format (STRICT — required for machine import)").strip(),
            "Your ENTIRE reply must be ONE JSON object and NOTHING else.",
            "",
            "FORBIDDEN (import will fail if you include any of these):",
            "- Markdown code fences (no ``` or ```json)",
            '- Introductory text ("Sure!", "Here is the JSON:", "Below is...")',
            "- Explanations, summaries, or bullet lists outside the JSON",
            "- Trailing commentary after the closing brace",
            "",
            "REQUIRED:",
            "- The first character of your reply MUST be {",
            "- The last character of your reply MUST be }",
            "- Valid JSON only — the human copies your whole reply into an import field",
            "",
            "Schema to follow exactly:",
            "",
            INTAKE_JSON_SCHEMA,
            "",
            "Content rules:",
            "- Propose 3–8 create_component items for this intake.",
            "- Use snake-case area_slug prefixes like 01-session-runtime.",
            "- topic_id must start with topic: and be unique within the bundle.",
            "- Do not accept or apply proposals — the human gates each card in the UI.",
            "",
            "Reply with the JSON object now. No other text.",
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


BOUNDARY_TEMPLATE = """You are reviewing the boundary of one StrataForge topic.

Focus on the Includes / Excludes sections. Propose clarifications only for this topic."""

DECOMPOSE_TEMPLATE = """You are decomposing one StrataForge topic into child components.

Propose new child topics under the parent listed below. Each child must use create_component with parent_id set to the parent topic id.

Do not:
- create duplicate top-level areas
- propose changes to unrelated topics
- accept proposals yourself"""

LINK_TEMPLATE = """You are proposing dependency links between existing StrataForge topics.

Use add_dependency and/or add_feeds_into proposal kinds only. Reference existing topic ids from the atlas list.

depends_on: the subject topic depends on another (prerequisite).
feeds_into: the subject topic feeds information/events into another."""

DECOMPOSE_JSON_SCHEMA = """{
  "session_mode": "decompose",
  "summary": "Child components proposed under parent",
  "proposals": [
    {
      "kind": "create_component",
      "title": "Child Component",
      "summary": "One-line description",
      "rationale": "Why this child belongs under the parent",
      "topic_id": "topic:child-id",
      "proposed_changes": {
        "area_slug": "04-parent-slug-child-name",
        "topic_id": "topic:child-id",
        "title": "Child Component",
        "level": "topic",
        "parent_id": "topic:parent-id"
      }
    }
  ]
}"""

LINK_JSON_SCHEMA = """{
  "session_mode": "link",
  "summary": "Dependency links proposed",
  "proposals": [
    {
      "kind": "add_dependency",
      "title": "A depends on B",
      "summary": "Prerequisite relationship",
      "rationale": "Why A needs B first",
      "topic_id": "topic:subject",
      "proposed_changes": {
        "topic_id": "topic:subject",
        "depends_on_id": "topic:prerequisite"
      }
    },
    {
      "kind": "add_feeds_into",
      "title": "A feeds into B",
      "summary": "Downstream data/event flow",
      "rationale": "Why A sends into B",
      "topic_id": "topic:source",
      "proposed_changes": {
        "topic_id": "topic:source",
        "feeds_into_id": "topic:target"
      }
    }
  ]
}"""


def _strict_json_instructions(schema: str) -> list[str]:
    return [
        _section_heading("Output format (STRICT — required for machine import)").strip(),
        "Your ENTIRE reply must be ONE JSON object and NOTHING else.",
        "",
        "REQUIRED:",
        "- First character: {",
        "- Last character: }",
        "- Valid JSON only",
        "",
        "Schema:",
        "",
        schema,
        "",
        "Reply with the JSON object now. No other text.",
    ]


def build_boundary_prompt(paths: ProjectPaths, topic_id: str) -> str:
    context = _load_expansion_context(paths, topic_id)
    boundary = _extract_section(context["current_topic_body"], "Boundary")
    return "\n\n".join(
        [
            BOUNDARY_TEMPLATE,
            _section_heading("Topic").strip(),
            f"- id: {context['topic_id']}",
            f"- title: {context['topic_title']}",
            _section_heading("Current boundary section").strip(),
            boundary or "(empty — propose Includes/Excludes content as a patch in your reply text; import uses proposals only for structural changes)",
            _section_heading("Full topic body").strip(),
            context["current_topic_body"],
        ]
    )


def build_decompose_prompt(paths: ProjectPaths, topic_id: str, session_id: str) -> str:
    context = _load_expansion_context(paths, topic_id)
    manifest = load_manifest(paths)
    return "\n\n".join(
        [
            DECOMPOSE_TEMPLATE,
            _section_heading("Parent topic (decompose this)").strip(),
            f"- id: {context['topic_id']}",
            f"- title: {context['topic_title']}",
            f"- session_id: {session_id}",
            _section_heading("Existing children (do not duplicate)").strip(),
            context["children_block"],
            _section_heading("Atlas (ids + titles)").strip(),
            _manifest_summary(manifest),
            *_strict_json_instructions(DECOMPOSE_JSON_SCHEMA.replace("topic:parent-id", topic_id)),
            "",
            "Content rules:",
            f"- Every create_component MUST set parent_id to {topic_id}",
            "- area_slug should nest under parent area when sensible",
            "- topic_id must be unique and start with topic:",
        ]
    )


def build_link_prompt(paths: ProjectPaths, topic_id: str, session_id: str) -> str:
    manifest = load_manifest(paths)
    topic, _body = get_topic(paths, topic_id)
    return "\n\n".join(
        [
            LINK_TEMPLATE,
            _section_heading("Focus topic").strip(),
            f"- id: {topic.id}",
            f"- title: {topic.title}",
            f"- session_id: {session_id}",
            f"- current depends_on: {', '.join(topic.depends_on) or '(none)'}",
            f"- current feeds_into: {', '.join(topic.feeds_into) or '(none)'}",
            _section_heading("Atlas (use these ids only)").strip(),
            _manifest_summary(manifest),
            *_strict_json_instructions(LINK_JSON_SCHEMA),
            "",
            "Content rules:",
            "- Propose 1–5 links involving the focus topic where useful",
            "- Use only topic ids from the atlas list",
        ]
    )
