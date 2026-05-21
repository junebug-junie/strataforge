import { useCallback, useEffect, useState } from "react";
import {
  getTopic,
  updateTopic,
  type CoverageFlags,
  type TopicDetail,
} from "../api";

const COVERAGE_BADGES: { key: keyof CoverageFlags; label: string }[] = [
  { key: "concept_addressed", label: "Concept addressed" },
  { key: "concept_solved", label: "Concept solved" },
  { key: "out_of_scope", label: "Out of scope" },
  { key: "needs_design", label: "Needs design" },
  { key: "needs_reconciliation", label: "Needs reconciliation" },
  { key: "needs_code_review", label: "Needs code review" },
  { key: "needs_implementation", label: "Needs implementation" },
];

interface TopicEditorProps {
  projectId: string;
  topicId: string;
  onUpdated?: () => void;
}

export default function TopicEditor({ projectId, topicId, onUpdated }: TopicEditorProps) {
  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadTopic = useCallback(() => {
    setLoading(true);
    setError(null);
    getTopic(projectId, topicId)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, topicId]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  const applyUpdate = async (
    patch: Parameters<typeof updateTopic>[2],
    currentCoverage?: CoverageFlags,
  ) => {
    setActionError(null);
    setUpdating(true);
    try {
      const updated = await updateTopic(projectId, topicId, patch, currentCoverage);
      setDetail((prev) => (prev ? { ...prev, topic: updated } : prev));
      onUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const handleOutOfScope = () => {
    if (!detail) return;
    void applyUpdate(
      {
        review_state: "out_of_scope",
        coverage: { ...detail.topic.coverage, out_of_scope: true },
      },
      detail.topic.coverage,
    );
  };

  const handleNeedsDesign = () => {
    if (!detail) return;
    void applyUpdate(
      { coverage: { ...detail.topic.coverage, needs_design: true } },
      detail.topic.coverage,
    );
  };

  const handleExecutionReady = () => {
    void applyUpdate({ status: "execution_ready" });
  };

  if (loading) {
    return <p style={{ color: "#666" }}>Loading topic…</p>;
  }

  if (error) {
    return <p style={{ color: "#b91c1c" }}>{error}</p>;
  }

  if (!detail) {
    return null;
  }

  const { topic, body } = detail;

  return (
    <article style={{ textAlign: "left" }}>
      <header style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 600 }}>{topic.title}</h2>
        <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#666" }}>
          <span style={{ marginRight: "12px" }}>
            Status: <strong>{topic.status}</strong>
          </span>
          <span>
            Review: <strong>{topic.review_state}</strong>
          </span>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {COVERAGE_BADGES.map(({ key, label }) => {
            const active = topic.coverage[key];
            return (
              <span
                key={key}
                style={{
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: active ? "#dbeafe" : "#f3f4f6",
                  color: active ? "#1e40af" : "#9ca3af",
                  border: `1px solid ${active ? "#93c5fd" : "#e5e7eb"}`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </header>

      <section style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Gates</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            disabled={updating}
            onClick={handleOutOfScope}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Mark out of scope
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={handleNeedsDesign}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Needs design
          </button>
          <button
            type="button"
            disabled={updating || topic.status === "execution_ready"}
            onClick={handleExecutionReady}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Execution ready
          </button>
        </div>
        {actionError && (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#b91c1c" }}>{actionError}</p>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Body</h3>
        <pre
          style={{
            margin: 0,
            padding: "12px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "13px",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            overflow: "auto",
            maxHeight: "60vh",
          }}
        >
          {body || "(empty)"}
        </pre>
      </section>
    </article>
  );
}
