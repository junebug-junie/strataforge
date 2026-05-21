import frontmatter
from strataforge.models import TopicRecord, CoverageFlags
from strataforge.core.status import DesignStatus, ReviewState, ProposalState

def _meta_to_topic(meta: dict) -> TopicRecord:
    coverage_raw = meta.pop("coverage", {}) or {}
    return TopicRecord(
        id=meta["id"],
        title=meta["title"],
        kind=meta.get("kind", "topic"),
        level=meta.get("level", "leaf"),
        parent=meta.get("parent"),
        path=meta["path"],
        status=DesignStatus(meta.get("status", "scaffolded")),
        review_state=ReviewState(meta.get("review_state", "unreviewed")),
        proposal_state=ProposalState(meta.get("proposal_state", "promoted_to_scaffold")),
        coverage=CoverageFlags(**coverage_raw),
        depends_on=meta.get("depends_on", []) or [],
        feeds_into=meta.get("feeds_into", []) or [],
        blocks=meta.get("blocks", []) or [],
        created_at=meta.get("created_at"),
        updated_at=meta.get("updated_at"),
        last_reviewed=meta.get("last_reviewed"),
    )

def load_topic_file(text: str) -> tuple[TopicRecord, str]:
    post = frontmatter.loads(text)
    topic = _meta_to_topic(dict(post.metadata))
    return topic, post.content

def dump_topic_file(topic: TopicRecord, body: str) -> str:
    meta = topic.model_dump(mode="json")
    meta["coverage"] = topic.coverage.model_dump()
    post = frontmatter.Post(body, **meta)
    return frontmatter.dumps(post)
