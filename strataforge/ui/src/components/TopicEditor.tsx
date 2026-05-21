import { useCallback, useEffect, useState } from "react";
import {
  getTopic,
  getTopicPrompt,
  updateTopic,
  type CoverageFlags,
  type TopicDetail,
} from "../api";
import { useToast } from "./Toast";

const COVERAGE_FLAGS: { key: keyof CoverageFlags; label: string }[] = [
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
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const notify = useToast();

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
      const msg = err instanceof Error ? err.message : "Update failed";
      setActionError(msg);
      notify(msg, "error");
    } finally {
      setUpdating(false);
    }
  };

  const toggleCoverage = (key: keyof CoverageFlags) => {
    if (!detail) {
      notify(loading ? "Still loading topic…" : "Topic not loaded yet", "error");
      return;
    }
    const current = detail.topic.coverage[key];
    const nextVal = !current;
    const nextCoverage = { ...detail.topic.coverage, [key]: nextVal };
    const patch: Parameters<typeof updateTopic>[2] = { coverage: nextCoverage };

    if (key === "out_of_scope") {
      patch.review_state = nextVal ? "out_of_scope" : "accepted";
    }

    const label = COVERAGE_FLAGS.find((f) => f.key === key)?.label ?? key;
    notify(`${nextVal ? "Set" : "Cleared"} ${label}.`, "info");
    void applyUpdate(patch, detail.topic.coverage).then(() => {
      notify(`${label} ${nextVal ? "on" : "off"}.`, "success");
    });
  };

  const handleExecutionReady = () => {
    if (!detail) {
      notify(loading ? "Still loading topic…" : "Topic not loaded yet", "error");
      return;
    }
    if (detail.topic.status === "execution_ready") {
      notify("Already execution ready (status is one-way in MVP).", "info");
      return;
    }
    notify("Promoting to execution ready…", "info");
    void applyUpdate({ status: "execution_ready" }, detail.topic.coverage).then(() => {
      notify("Status set to execution ready.", "success");
    });
  };

  const copyPrompt = async (command: "expand" | "reconcile-parent", label: string) => {
    setPromptMessage(null);
    setActionError(null);
    notify(`Copying ${label.toLowerCase()}…`, "info");
    try {
      const prompt = await getTopicPrompt(projectId, topicId, command);
      await navigator.clipboard.writeText(prompt);
      setPromptMessage(`${label} copied to clipboard.`);
      notify(`${label} copied to clipboard.`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to copy prompt";
      setActionError(msg);
      notify(msg, "error");
    }
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
      </header>

      <section style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600 }}>Coverage flags</h3>
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#6b7280" }}>
          Click a flag to turn it on or off (saved to topic file).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {COVERAGE_FLAGS.map(({ key, label }) => {
            const active = topic.coverage[key];
            return (
              <button
                key={key}
                type="button"
                disabled={updating}
                aria-pressed={active}
                title={active ? `Clear ${label}` : `Set ${label}`}
                onClick={() => toggleCoverage(key)}
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  cursor: updating ? "wait" : "pointer",
                  background: active ? "#dbeafe" : "#fff",
                  color: active ? "#1e40af" : "#6b7280",
                  border: `1px solid ${active ? "#6366f1" : "#d1d5db"}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {active ? "✓ " : ""}
                {label}
              </button>
            );
          })}
        </div>
        {actionError && (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#b91c1c" }}>{actionError}</p>
        )}
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Status promotion</h3>
        <button
          type="button"
          disabled={updating || topic.status === "execution_ready"}
          onClick={handleExecutionReady}
          style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
        >
          {topic.status === "execution_ready" ? "Execution ready ✓" : "Mark execution ready"}
        </button>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>LLM prompts</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            disabled={updating}
            onClick={() => void copyPrompt("expand", "Expansion prompt")}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Copy expansion prompt
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => void copyPrompt("reconcile-parent", "Reconciliation prompt")}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Copy reconcile prompt
          </button>
        </div>
        {promptMessage && (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#059669" }}>{promptMessage}</p>
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
