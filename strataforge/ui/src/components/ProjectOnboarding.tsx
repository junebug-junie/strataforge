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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "28px",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700 }}>StrataForge</h1>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#4b5563", lineHeight: 1.5 }}>
          Create a design workspace to capture architecture ideas, review LLM proposals, and
          build your topic atlas.
        </p>

        <label htmlFor="project-title" style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
          Project title
        </label>
        <input
          id="project-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate(title);
          }}
          placeholder="e.g. Payment Platform Redesign"
          disabled={busy}
          style={{
            width: "100%",
            marginTop: "6px",
            padding: "10px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            boxSizing: "border-box",
          }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate(title)}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "10px 14px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            background: "#1e40af",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
          }}
        >
          {busy ? "Creating…" : "Create project"}
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "20px 0",
            color: "#9ca3af",
            fontSize: "12px",
          }}
        >
          <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
          or
          <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate("Demo")}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: "14px",
            cursor: busy ? "wait" : "pointer",
            background: "#f9fafb",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
          }}
        >
          Quick start with Demo
        </button>

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#b91c1c" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
