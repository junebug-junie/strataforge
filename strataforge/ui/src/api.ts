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
