from pathlib import Path
from datetime import date
from strataforge.core.paths import ProjectPaths
from strataforge.core.manifest import load_manifest, save_manifest
from strataforge.models import CoverageFlags, TopicRecord, ProjectManifest
from strataforge.parser.frontmatter import dump_topic_file, load_topic_file
from strataforge.core.status import DesignStatus, ReviewState, ProposalState

_TOPIC_TEMPLATE = """# {title}

## Purpose

What this topic/component is responsible for.

## Boundary

### Includes

- TBD

### Excludes

- TBD

## Current Design

## Children

## Open Questions

## Agent Next Actions

- Run `/boundary-check`
"""

def create_topic_scaffold(
    paths: ProjectPaths,
    *,
    topic_id: str,
    title: str,
    area_slug: str,
    parent_id: str | None,
    level: str,
) -> TopicRecord:
    area_dir = paths.areas_dir / area_slug
    area_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{area_slug.split('-', 1)[0]}-{topic_id.split('.')[-1]}.md" if parent_id else "index.md"
    rel_path = f"areas/{area_slug}/{filename}"
    file_path = paths.root / rel_path
    topic = TopicRecord(
        id=topic_id,
        title=title,
        level=level,
        parent=parent_id,
        path=rel_path,
        status=DesignStatus.scaffolded,
        review_state=ReviewState.accepted,
        proposal_state=ProposalState.promoted_to_scaffold,
        created_at=date.today(),
        updated_at=date.today(),
    )
    body = _TOPIC_TEMPLATE.format(title=title)
    file_path.write_text(dump_topic_file(topic, body))
    manifest = load_manifest(paths)
    manifest.topics.append(topic)
    if parent_id is None:
        manifest.root_areas.append(topic)
    save_manifest(paths, manifest)
    return topic

def list_topics(paths: ProjectPaths) -> list[TopicRecord]:
    manifest = load_manifest(paths)
    seen: dict[str, TopicRecord] = {}
    for topic in manifest.root_areas + manifest.topics:
        if topic.id not in seen:
            seen[topic.id] = topic
    result: list[TopicRecord] = []
    for topic in seen.values():
        file_path = paths.root / topic.path
        if file_path.exists():
            file_topic, _body = load_topic_file(file_path.read_text())
            result.append(file_topic)
        else:
            result.append(topic)
    return result

def try_get_topic(paths: ProjectPaths, topic_id: str) -> TopicRecord | None:
    manifest = load_manifest(paths)
    for t in manifest.root_areas + manifest.topics:
        if t.id == topic_id:
            text = (paths.root / t.path).read_text()
            topic, _body = load_topic_file(text)
            return topic
    return None


def get_topic(paths: ProjectPaths, topic_id: str) -> tuple[TopicRecord, str]:
    manifest = load_manifest(paths)
    for t in manifest.root_areas + manifest.topics:
        if t.id == topic_id:
            text = (paths.root / t.path).read_text()
            topic, body = load_topic_file(text)
            return topic, body
    raise KeyError(topic_id)


def _sync_manifest_topic(manifest: ProjectManifest, topic: TopicRecord) -> None:
    for index, existing in enumerate(manifest.topics):
        if existing.id == topic.id:
            manifest.topics[index] = topic
            return
    for index, existing in enumerate(manifest.root_areas):
        if existing.id == topic.id:
            manifest.root_areas[index] = topic
            return


def _persist_topic(paths: ProjectPaths, topic: TopicRecord, body: str) -> TopicRecord:
    topic.updated_at = date.today()
    file_path = paths.root / topic.path
    file_path.write_text(dump_topic_file(topic, body))
    manifest = load_manifest(paths)
    _sync_manifest_topic(manifest, topic)
    save_manifest(paths, manifest)
    return topic


def append_topic_link(
    paths: ProjectPaths,
    topic_id: str,
    *,
    depends_on_id: str | None = None,
    feeds_into_id: str | None = None,
    blocks_id: str | None = None,
) -> TopicRecord:
    topic, body = get_topic(paths, topic_id)
    if depends_on_id and depends_on_id not in topic.depends_on:
        topic.depends_on = [*topic.depends_on, depends_on_id]
    if feeds_into_id and feeds_into_id not in topic.feeds_into:
        topic.feeds_into = [*topic.feeds_into, feeds_into_id]
    if blocks_id and blocks_id not in topic.blocks:
        topic.blocks = [*topic.blocks, blocks_id]
    return _persist_topic(paths, topic, body)


def update_topic(
    paths: ProjectPaths,
    topic_id: str,
    *,
    review_state: ReviewState | None = None,
    status: DesignStatus | None = None,
    coverage: CoverageFlags | None = None,
    body: str | None = None,
) -> TopicRecord:
    from strataforge.core.status import assert_status_promotion_allowed
    topic, existing_body = get_topic(paths, topic_id)
    if status is not None and status != topic.status:
        assert_status_promotion_allowed(topic.status, status)
        topic.status = status
    if review_state is not None:
        topic.review_state = review_state
    if coverage is not None:
        topic.coverage = coverage
    markdown = body if body is not None else existing_body
    return _persist_topic(paths, topic, markdown)
