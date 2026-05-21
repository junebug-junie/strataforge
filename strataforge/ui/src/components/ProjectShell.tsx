import { useCallback, useEffect, useState } from "react";
import { listProjects, listTopics, type ProjectSummary, type TopicNode } from "../api";
import AtlasTree from "./AtlasTree";
import CoherenceRadar from "./CoherenceRadar";
import PairingPlane from "./PairingPlane";

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listProjects()
      .then((data) => {
        if (cancelled) return;
        setProjects(data);
        if (data.length > 0) {
          setProjectId((current) => current ?? data[0].project_id);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (selectedTopicId && !topics.some((t) => t.id === selectedTopicId)) {
      onSelectTopic(null);
    }
  }, [topics, selectedTopicId, onSelectTopic]);

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    onSelectTopic(null);
  };

  if (loading) {
    return <p style={{ padding: "16px" }}>Loading projects…</p>;
  }

  if (error) {
    return <p style={{ padding: "16px", color: "#b91c1c" }}>{error}</p>;
  }

  if (projects.length === 0) {
    return <p style={{ padding: "16px" }}>No projects found. Run strata init to create one.</p>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside
        style={{
          width: "260px",
          flexShrink: 0,
          borderRight: "1px solid #ddd",
          padding: "12px",
          background: "#fafafa",
        }}
      >
        <header style={{ marginBottom: "12px" }}>
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
        </header>

        <h2 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Atlas Tree</h2>
        <AtlasTree
          topics={topics}
          selectedTopicId={selectedTopicId}
          onSelect={onSelectTopic}
        />
      </aside>

      {projectId && (
        <PairingPlane
          projectId={projectId}
          selectedTopicId={selectedTopicId}
          onTopicsChanged={refreshTopics}
        />
      )}

      {projectId && (
        <aside
          style={{
            width: "260px",
            flexShrink: 0,
            padding: "16px",
            background: "#fafafa",
            borderLeft: "1px solid #ddd",
            overflowY: "auto",
          }}
        >
          <CoherenceRadar
            projectId={projectId}
            onSelectTopic={(topicId) => onSelectTopic(topicId)}
          />
        </aside>
      )}
    </div>
  );
}
