const API_BASE = import.meta.env.VITE_STRATA_API_BASE ?? "http://127.0.0.1:8787";

export interface ProjectSummary {
  project_id: string;
  title: string;
  path: string;
  status: string;
}

export interface TopicNode {
  id: string;
  title: string;
  kind: string;
  level: string;
  parent: string | null;
  path: string;
  status: string;
  review_state: string;
}

export interface CoverageFlags {
  concept_addressed: boolean;
  concept_solved: boolean;
  out_of_scope: boolean;
  needs_design: boolean;
  needs_reconciliation: boolean;
  needs_code_review: boolean;
  needs_implementation: boolean;
}

export interface TopicRecord {
  id: string;
  title: string;
  kind: string;
  level: string;
  parent: string | null;
  path: string;
  status: string;
  review_state: string;
  proposal_state: string;
  coverage: CoverageFlags;
}

export interface TopicDetail {
  topic: TopicRecord;
  body: string;
}

export interface TopicUpdatePatch {
  review_state?: string;
  status?: string;
  coverage?: Partial<CoverageFlags>;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const r = await fetch(`${API_BASE}/api/projects`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listTopics(projectId: string): Promise<TopicNode[]> {
  const r = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTopic(projectId: string, topicId: string): Promise<TopicDetail> {
  const r = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}`,
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateTopic(
  projectId: string,
  topicId: string,
  patch: TopicUpdatePatch,
  currentCoverage?: CoverageFlags,
): Promise<TopicRecord> {
  const body: Record<string, unknown> = {};
  if (patch.review_state !== undefined) body.review_state = patch.review_state;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.coverage !== undefined) {
    body.coverage = { ...(currentCoverage ?? {}), ...patch.coverage };
  }
  const r = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
