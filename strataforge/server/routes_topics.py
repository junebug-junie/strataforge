from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from strataforge.core.status import DesignStatus, ReviewState
from strataforge.core.topic_store import get_topic, list_topics, try_get_topic, update_topic
from strataforge.llm.prompts import build_expansion_prompt, build_reconciliation_prompt
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


class PromptResponse(BaseModel):
    command: str
    topic_id: str
    prompt: str


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
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown prompt command: {command}",
            )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Topic not found: {topic_id}") from None
    return PromptResponse(command=command, topic_id=topic_id, prompt=prompt)
