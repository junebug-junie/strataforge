import { useState } from "react";
import { createProject, listProjects, type ProjectSummary } from "../api";

interface ProjectOnboardingProps {
  onCreated: (project: ProjectSummary) => void;
}

export default function ProjectOnboarding({ onCreated }: ProjectOnboardingProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (projectTitle: string) => {
    const trimmed = projectTitle.trim();
    if (!trimmed) {
      setError("Enter a project title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const project = await createProject(trimmed);
      onCreated(project);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create project";
      if (message.includes("already exists") && trimmed.toLowerCase() === "demo") {
        const projects = await listProjects();
        const existing = projects.find((p) => p.title === "Demo" || p.project_id === "project:demo");
        if (existing) {
          onCreated(existing);
          return;
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>StrataForge</h1>
        <p className="sf-muted" style={{ margin: "0 0 24px", lineHeight: 1.55 }}>
          Create a design workspace to capture architecture ideas, review LLM proposals, and
          build your topic atlas.
        </p>

        <label className="sf-label" htmlFor="project-title">
          Project title
        </label>
        <input
          id="project-title"
          type="text"
          className="sf-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate(title);
          }}
          placeholder="e.g. Payment Platform Redesign"
          disabled={busy}
          style={{ width: "100%", marginTop: "6px", boxSizing: "border-box" }}
        />

        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void handleCreate(title)}
          style={{ width: "100%", marginTop: "12px" }}
        >
          {busy ? "Creating…" : "Create project"}
        </button>

        <div className="onboarding-divider">
          <span />
          or
          <span />
        </div>

        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void handleCreate("Demo")}
          style={{ width: "100%" }}
        >
          Quick start with Demo
        </button>

        {error && <p className="sf-error-text" style={{ marginTop: "12px" }}>{error}</p>}
      </div>
    </div>
  );
}
