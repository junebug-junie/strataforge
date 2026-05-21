const API_BASE = import.meta.env.VITE_STRATA_API_BASE ?? "http://127.0.0.1:8787";

export async function listProjects() {
  const r = await fetch(`${API_BASE}/api/projects`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
