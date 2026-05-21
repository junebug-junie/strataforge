// Same-origin subpath: UI at /strataforge/, API proxied at /strataforge/api/
const API_BASE = import.meta.env.VITE_STRATA_API_BASE ?? "/strataforge";

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

export interface ProposalRecord {
  id: string;
  session_id: string;
  topic_id: string | null;
  kind: string;
  state: string;
  title: string;
  summary: string;
  rationale: string;
  proposed_changes: Record<string, unknown>;
  human_review: Record<string, unknown>;
}

export interface SessionDetail {
  id: string;
  project_id: string;
  title: string;
  topic_id: string | null;
  mode: string;
  current_gate: string;
  created_at: string;
  updated_at: string;
  inputs: Record<string, unknown>;
  proposals: ProposalRecord[];
  outputs: Record<string, unknown>;
}

export interface ImportProposalsResult {
  count: number;
  proposals: ProposalRecord[];
}

export interface ApplySessionResult {
  created: TopicRecord[];
}

export interface RadarItem {
  id: string;
  topic_id: string;
  title: string;
  severity: string;
  score: number;
  reason_codes: string[];
  summary: string;
  recommended_commands: string[];
  created_at: string;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const text = await r.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if (parsed.detail) message = parsed.detail;
    } catch {
      // use raw text
    }
    throw new Error(message);
  }
  return r;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const r = await apiFetch(`${API_BASE}/api/projects`);
  return r.json();
}

export async function createProject(title: string, slug?: string): Promise<ProjectSummary> {
  const r = await apiFetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, slug }),
  });
  const created = (await r.json()) as { project_id: string; title: string; path: string };
  return {
    project_id: created.project_id,
    title: created.title,
    path: created.path,
    status: "active",
  };
}

export async function listTopics(projectId: string): Promise<TopicNode[]> {
  const r = await apiFetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics`);
  return r.json();
}

export async function getTopic(projectId: string, topicId: string): Promise<TopicDetail> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}`,
  );
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
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return r.json();
}

export async function startSession(
  projectId: string,
  title: string,
  mode = "intake",
): Promise<SessionDetail> {
  const r = await apiFetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, mode }),
  });
  return r.json();
}

export async function getSession(projectId: string, sessionId: string): Promise<SessionDetail> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`,
  );
  return r.json();
}

export async function updateSessionInputs(
  projectId: string,
  sessionId: string,
  inputs: Record<string, unknown>,
): Promise<SessionDetail> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs }),
    },
  );
  return r.json();
}

export async function importProposals(
  projectId: string,
  sessionId: string,
  bundle: Record<string, unknown>,
): Promise<ImportProposalsResult> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    },
  );
  return r.json();
}

export async function applySession(
  projectId: string,
  sessionId: string,
  force = false,
): Promise<ApplySessionResult> {
  const query = force ? "?force=true" : "";
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/apply${query}`,
    { method: "POST" },
  );
  return r.json();
}

async function proposalAction(
  projectId: string,
  proposalId: string,
  action: "accept" | "reject" | "defer" | "out-of-scope" | "revise",
  note = "",
): Promise<ProposalRecord> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    },
  );
  return r.json();
}

export function acceptProposal(projectId: string, proposalId: string, note = "") {
  return proposalAction(projectId, proposalId, "accept", note);
}

export function rejectProposal(projectId: string, proposalId: string, note = "") {
  return proposalAction(projectId, proposalId, "reject", note);
}

export function deferProposal(projectId: string, proposalId: string, note = "") {
  return proposalAction(projectId, proposalId, "defer", note);
}

export function outOfScopeProposal(projectId: string, proposalId: string, note = "") {
  return proposalAction(projectId, proposalId, "out-of-scope", note);
}

export function reviseProposal(projectId: string, proposalId: string, note = "") {
  return proposalAction(projectId, proposalId, "revise", note);
}

export async function listSessions(
  projectId: string,
  mode?: string,
): Promise<SessionDetail[]> {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions${query}`,
  );
  return r.json();
}

export async function getSessionIntakePrompt(
  projectId: string,
  sessionId: string,
  sourcePrompt?: string,
): Promise<string> {
  const query =
    sourcePrompt !== undefined
      ? `?source_prompt=${encodeURIComponent(sourcePrompt)}`
      : "";
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/prompts/intake${query}`,
  );
  const data = (await r.json()) as { prompt: string };
  return data.prompt;
}

export async function getTopicPrompt(
  projectId: string,
  topicId: string,
  command: "expand" | "reconcile-parent",
): Promise<string> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}/prompts/${command}`,
  );
  const data = (await r.json()) as { prompt: string };
  return data.prompt;
}

export async function listRadar(projectId: string): Promise<RadarItem[]> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/radar`,
  );
  return r.json();
}

export async function scanRadar(projectId: string): Promise<RadarItem[]> {
  const r = await apiFetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/radar/scan`,
    { method: "POST" },
  );
  return r.json();
}
