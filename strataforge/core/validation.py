from dataclasses import dataclass

from strataforge.core.manifest import load_manifest
from strataforge.core.paths import ProjectPaths
from strataforge.core.status import DesignStatus, ProposalState, ReviewState
from strataforge.parser.frontmatter import load_topic_file

@dataclass
class ValidationIssue:
    code: str
    message: str
    topic_id: str | None = None

_VALID_STATUS = {s.value for s in DesignStatus}
_VALID_REVIEW = {s.value for s in ReviewState}
_VALID_PROPOSAL = {s.value for s in ProposalState}


def validate_project(paths: ProjectPaths) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    manifest = load_manifest(paths)
    all_topics = {t.id: t for t in manifest.root_areas + manifest.topics}
    seen_ids: set[str] = set()

    for topic in all_topics.values():
        if topic.id in seen_ids:
            issues.append(ValidationIssue("duplicate_id", f"Duplicate topic id {topic.id}", topic.id))
        seen_ids.add(topic.id)
        file_path = paths.root / topic.path
        if not file_path.exists():
            issues.append(ValidationIssue("path_missing", f"Missing file {topic.path}", topic.id))
            continue
        if topic.parent and topic.parent not in all_topics:
            issues.append(ValidationIssue("parent_not_found", f"Parent {topic.parent} not found", topic.id))
        if topic.status.value not in _VALID_STATUS:
            issues.append(ValidationIssue("invalid_status", f"Invalid status {topic.status}", topic.id))
        for dep in topic.depends_on:
            if dep not in all_topics and not dep.startswith("external:"):
                issues.append(ValidationIssue("dependency_missing", f"Dependency {dep} missing", topic.id))

        try:
            file_topic, _body = load_topic_file(file_path.read_text())
        except Exception as exc:
            issues.append(
                ValidationIssue(
                    "frontmatter_parse_error",
                    f"Could not parse frontmatter in {topic.path}: {exc}",
                    topic.id,
                )
            )
            continue

        if file_topic.id != topic.id:
            issues.append(
                ValidationIssue(
                    "frontmatter_id_mismatch",
                    f"File id {file_topic.id} does not match manifest {topic.id}",
                    topic.id,
                )
            )
        if file_topic.path != topic.path:
            issues.append(
                ValidationIssue(
                    "frontmatter_path_mismatch",
                    f"File path {file_topic.path} does not match manifest {topic.path}",
                    topic.id,
                )
            )
        if file_topic.status != topic.status:
            issues.append(
                ValidationIssue(
                    "frontmatter_status_drift",
                    f"File status {file_topic.status.value} differs from manifest {topic.status.value}",
                    topic.id,
                )
            )
        if file_topic.review_state != topic.review_state:
            issues.append(
                ValidationIssue(
                    "frontmatter_review_drift",
                    f"File review_state {file_topic.review_state.value} differs from manifest {topic.review_state.value}",
                    topic.id,
                )
            )
        if file_topic.parent != topic.parent:
            issues.append(
                ValidationIssue(
                    "frontmatter_parent_mismatch",
                    f"File parent {file_topic.parent} differs from manifest {topic.parent}",
                    topic.id,
                )
            )
    return issues
