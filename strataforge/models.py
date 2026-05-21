from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from strataforge.core.status import DesignStatus, ProposalState, ReviewState


class CoverageFlags(BaseModel):
    concept_addressed: bool = False
    concept_solved: bool = False
    out_of_scope: bool = False
    needs_design: bool = True
    needs_reconciliation: bool = False
    needs_code_review: bool = False
    needs_implementation: bool = False


class TopicRecord(BaseModel):
    id: str
    title: str
    kind: str = "topic"
    level: str = "area"
    parent: str | None = None
    path: str
    status: DesignStatus = DesignStatus.scaffolded
    review_state: ReviewState = ReviewState.unreviewed
    proposal_state: ProposalState = ProposalState.promoted_to_scaffold
    coverage: CoverageFlags = Field(default_factory=CoverageFlags)
    depends_on: list[str] = Field(default_factory=list)
    feeds_into: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    created_at: date | None = None
    updated_at: date | None = None
    last_reviewed: date | None = None


class ProjectManifest(BaseModel):
    project_id: str
    title: str
    version: str = "0.1.0"
    status: str = "active"
    levels: list[str] = Field(default_factory=lambda: ["area", "topic", "subtopic", "leaf"])
    root_areas: list[TopicRecord] = Field(default_factory=list)
    topics: list[TopicRecord] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)


class Proposal(BaseModel):
    id: str
    session_id: str
    topic_id: str | None = None
    kind: str
    state: ProposalState = ProposalState.proposed
    title: str
    summary: str = ""
    rationale: str = ""
    proposed_changes: dict[str, Any] = Field(default_factory=dict)
    human_review: dict[str, Any] = Field(default_factory=dict)


class DesignSession(BaseModel):
    id: str
    project_id: str
    title: str
    topic_id: str | None = None
    mode: str = "intake"
    current_gate: str = "intake_accepted"
    created_at: datetime
    updated_at: datetime
    inputs: dict[str, Any] = Field(default_factory=dict)
    proposals: list[str] = Field(default_factory=list)
    outputs: dict[str, Any] = Field(default_factory=dict)


class RadarItem(BaseModel):
    id: str
    topic_id: str
    title: str
    severity: str
    score: int
    reason_codes: list[str] = Field(default_factory=list)
    summary: str = ""
    recommended_commands: list[str] = Field(default_factory=list)
    created_at: datetime
