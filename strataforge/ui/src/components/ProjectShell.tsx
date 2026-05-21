import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProject,
  listProjects,
  listTopics,
  type ProjectSummary,
  type TopicNode,
} from "../api";
import AtlasTree from "./AtlasTree";
import CoherenceRadar from "./CoherenceRadar";
import PairingPlane from "./PairingPlane";
import ProjectOnboarding from "./ProjectOnboarding";
import { useToast } from "./Toast";

interface ProjectShellProps {
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string | null) => void;
}

export default function ProjectShell({ selectedTopicId, onSelectTopic }: ProjectShellProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const notify = useToast();

  const handleSelectTopic = useCallback(
    (topicId: string | null) => {
      onSelectTopic(topicId);
      if (topicId) {
        const title = topics.find((t) => t.id === topicId)?.title ?? topicId;
        notify(`Opened topic: ${title}`, "success");
      }
    },
    [onSelectTopic, topics, notify],
  );

  useEffect(() => {
    if (!selectedTopicId || !workspaceRef.current) return;
    workspaceRef.current.scrollTop = 0;
  }, [selectedTopicId]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);
      setProjectId((current) => {
        if (current && data.some((p) => p.project_id === current)) return current;
        return data.length > 0 ? data[0].project_id : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const refreshTopics = useCallback(() => {
    if (!projectId) return;
    listTopics(projectId)
      .then(setTopics)
      .catch((err: Error) => setError(err.message));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setTopics([]);
      return;
    }

    let cancelled = false;
    setError(null);
    setTopics([]);

    listTopics(projectId)
      .then((data) => {
        if (cancelled) return;
        setTopics(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!selectedTopicId || topics.length === 0) return;
    if (!topics.some((t) => t.id === selectedTopicId)) {
      handleSelectTopic(null);
    }
  }, [topics, selectedTopicId, handleSelectTopic]);

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    handleSelectTopic(null);
  };

  const handleProjectCreated = (project: ProjectSummary) => {
    setProjects((prev) => {
      if (prev.some((p) => p.project_id === project.project_id)) return prev;
      return [...prev, project];
    });
    setProjectId(project.project_id);
    setShowNewProject(false);
    setNewTitle("");
    handleSelectTopic(null);
  };

  const handleCreateAnother = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(trimmed);
      handleProjectCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <p style={{ padding: "16px" }}>Loading projects…</p>;
  }

  if (projects.length === 0) {
    return <ProjectOnboarding onCreated={handleProjectCreated} />;
  }

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div style={{ minWidth: "200px", flex: "1 1 220px" }}>
          <label htmlFor="project-select" style={{ display: "block", fontSize: "12px", color: "#666" }}>
            Project
          </label>
          <select
            id="project-select"
            value={projectId ?? ""}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{ width: "100%", marginTop: "4px", padding: "6px" }}
          >
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        {!showNewProject ? (
          <button
            type="button"
            onClick={() => setShowNewProject(true)}
            style={{
              padding: "6px 0",
              fontSize: "12px",
              color: "#1e40af",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            + New project
          </button>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateAnother();
              }}
              placeholder="Project title"
              disabled={creating}
              style={{ padding: "6px", fontSize: "12px", minWidth: "180px" }}
            />
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreateAnother()}
              style={{ fontSize: "12px", padding: "4px 8px", cursor: "pointer" }}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewProject(false);
                setNewTitle("");
              }}
              style={{ fontSize: "12px", padding: "4px 8px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        )}
      </header>

      <div className="app-body">
        <main className="app-main">
          <section className={`app-atlas${selectedTopicId ? " app-atlas--compact" : ""}`}>
            <div className="app-atlas-header">
              <h2>Atlas</h2>
              {selectedTopicId && (
                <button
                  type="button"
                  className="app-atlas-back"
                  onClick={() => handleSelectTopic(null)}
                >
                  ← Intake session
                </button>
              )}
            </div>
            {!selectedTopicId && (
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
                {topics.length === 0
                  ? "No topics yet — complete intake and Apply session to populate the atlas."
                  : `${topics.length} topic(s) — select a topic to open its workspace.`}
              </p>
            )}
            <AtlasTree
              topics={topics}
              selectedTopicId={selectedTopicId}
              onSelect={handleSelectTopic}
            />
          </section>

          {projectId && (
            <div
              ref={workspaceRef}
              className={`app-main-body${selectedTopicId ? " app-main-body--focus" : " app-main-body--session"}`}
            >
              <PairingPlane
                projectId={projectId}
                selectedTopicId={selectedTopicId}
                selectedTopicTitle={selectedTopic?.title ?? null}
                onTopicsChanged={refreshTopics}
                onSelectTopic={handleSelectTopic}
              />
            </div>
          )}
        </main>

        {projectId && (
          <aside className="app-radar">
            <CoherenceRadar
              projectId={projectId}
              onSelectTopic={handleSelectTopic}
            />
          </aside>
        )}
      </div>

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            right: "16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            maxWidth: "320px",
            zIndex: 10,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
