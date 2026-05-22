from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from strataforge.core.status import DesignStatus, ReviewState
from strataforge.core.topic_store import get_topic, list_topics, try_get_topic, update_topic
from strataforge.llm.topic_commands import recommended_ui_commands
from strataforge.llm.prompts import (
    build_boundary_prompt,
    build_decompose_prompt,
    build_expansion_prompt,
    build_link_prompt,
    build_reconciliation_prompt,
)
from strataforge.models import CoverageFlags
from strataforge.server.deps import resolve_project_paths

router = APIRouter(prefix="/api/projects/{project_id}/topics", tags=["topics"])


class TopicNode(BaseModel):
    id: str
    title: str
    kind: str
    level: str
    parent: str | None
    path: str
    status: str
    review_state: str


class TopicDetailResponse(BaseModel):
    topic: dict
    body: str


class TopicUpdateRequest(BaseModel):
    review_state: ReviewState | None = None
    status: DesignStatus | None = None
    coverage: CoverageFlags | None = None
    body: str | None = None


class PromptResponse(BaseModel):
    command: str
    topic_id: str
    prompt: str


class TopicRef(BaseModel):
    id: str
    title: str


class TopicContextResponse(BaseModel):
    topic: TopicRef
    parent: TopicRef | None
    children: list[TopicRef]
    depends_on: list[TopicRef]
    feeds_into: list[TopicRef]
    blocks: list[TopicRef]
    recommended_commands: list[str] = Field(default_factory=list)


def _resolve_refs(paths, topic_ids: list[str]) -> list[TopicRef]:
    refs: list[TopicRef] = []
    for tid in topic_ids:
        topic = try_get_topic(paths, tid)
        if topic is not None:
            refs.append(TopicRef(id=topic.id, title=topic.title))
    return refs


@router.get("", response_model=list[TopicNode])
def list_topic_nodes(project_id: str) -> list[TopicNode]:
    paths = resolve_project_paths(project_id)
    nodes: list[TopicNode] = []
    for topic in list_topics(paths):
        nodes.append(
            TopicNode(
                id=topic.id,
                title=topic.title,
                kind=topic.kind,
                level=topic.level,
                parent=topic.parent,
                path=topic.path,
                status=topic.status.value,
                review_state=topic.review_state.value,
            )
        )
    return nodes


@router.get("/{topic_id}", response_model=TopicDetailResponse)
def get_topic_detail(project_id: str, topic_id: str) -> TopicDetailResponse:
    paths = resolve_project_paths(project_id)
    try:
        topic, body = get_topic(paths, topic_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}") from None
    return TopicDetailResponse(topic=topic.model_dump(mode="json"), body=body)


@router.get("/{topic_id}/context", response_model=TopicContextResponse)
def get_topic_context(project_id: str, topic_id: str) -> TopicContextResponse:
    paths = resolve_project_paths(project_id)
    topic = try_get_topic(paths, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}")

    parent_ref: TopicRef | None = None
    if topic.parent:
        parent = try_get_topic(paths, topic.parent)
        if parent is not None:
            parent_ref = TopicRef(id=parent.id, title=parent.title)

    children = [
        TopicRef(id=t.id, title=t.title)
        for t in list_topics(paths)
        if t.parent == topic_id
    ]

    return TopicContextResponse(
        topic=TopicRef(id=topic.id, title=topic.title),
        parent=parent_ref,
        children=children,
        depends_on=_resolve_refs(paths, topic.depends_on),
        feeds_into=_resolve_refs(paths, topic.feeds_into),
        blocks=_resolve_refs(paths, topic.blocks),
        recommended_commands=recommended_ui_commands(paths, topic_id),
    )


@router.put("/{topic_id}")
def update_topic_fields(
    project_id: str,
    topic_id: str,
    body: TopicUpdateRequest,
) -> dict:
    paths = resolve_project_paths(project_id)
    if try_get_topic(paths, topic_id) is None:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}")
    try:
        topic = update_topic(
            paths,
            topic_id,
            review_state=body.review_state,
            status=body.status,
            coverage=body.coverage,
            body=body.body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return topic.model_dump(mode="json")


@router.get("/{topic_id}/prompts/{command}", response_model=PromptResponse)
def get_topic_prompt(project_id: str, topic_id: str, command: str) -> PromptResponse:
    paths = resolve_project_paths(project_id)
    if try_get_topic(paths, topic_id) is None:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}")
    try:
        if command == "expand":
            prompt = build_expansion_prompt(paths, topic_id)
        elif command == "reconcile-parent":
            prompt = build_reconciliation_prompt(paths, topic_id)
        elif command == "boundary-check":
            prompt = build_boundary_prompt(paths, topic_id)
        elif command == "decompose":
            prompt = build_decompose_prompt(paths, topic_id, session_id=f"topic-session:{topic_id}")
        elif command == "link":
            prompt = build_link_prompt(paths, topic_id, session_id=f"topic-session:{topic_id}")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown prompt command: {command}",
            )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}") from None
    return PromptResponse(command=command, topic_id=topic_id, prompt=prompt)
