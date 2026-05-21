from pathlib import Path
from datetime import date
from strataforge.core.paths import ProjectPaths
from strataforge.core.manifest import load_manifest, save_manifest
from strataforge.models import TopicRecord, ProjectManifest
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
    return manifest.topics

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
