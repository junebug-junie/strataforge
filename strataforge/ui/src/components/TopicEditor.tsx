import { useCallback, useEffect, useState } from "react";
import {
  getTopic,
  getTopicPrompt,
  updateTopic,
  type CoverageFlags,
  type TopicDetail,
} from "../api";
import { copyToClipboard } from "../lib/clipboard";
import { advanceStatusLabel, nextDesignStatus } from "../lib/status";
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
    void (async () => {
      try {
        await applyUpdate(patch, detail.topic.coverage);
        notify(`${label} ${nextVal ? "on" : "off"}.`, "success");
      } catch {
        /* applyUpdate already toasts */
      }
    })();
  };

  const handleAdvanceStatus = () => {
    if (!detail) {
      notify(loading ? "Still loading topic…" : "Topic not loaded yet", "error");
      return;
    }
    const next = nextDesignStatus(detail.topic.status);
    if (!next) {
      notify("Already at execution ready (MVP chain ends here).", "info");
      return;
    }
    void (async () => {
      try {
        await applyUpdate({ status: next }, detail.topic.coverage);
        notify(`Status advanced to ${next.replace("_", " ")}.`, "success");
      } catch {
        /* applyUpdate already toasts */
      }
    })();
  };

  const copyPrompt = async (command: "expand" | "reconcile-parent", label: string) => {
    setPromptMessage(null);
    setActionError(null);
    try {
      const prompt = await getTopicPrompt(projectId, topicId, command);
      const ok = await copyToClipboard(prompt);
      if (ok) {
        setPromptMessage(`${label} copied to clipboard.`);
        notify(`${label} copied to clipboard.`, "success");
      } else {
        notify("Could not copy — check browser clipboard permissions.", "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to copy prompt";
      setActionError(msg);
      notify(msg, "error");
    }
  };

  if (loading) {
    return <p className="sf-muted">Loading topic…</p>;
  }

  if (error) {
    return <p className="sf-error-text">{error}</p>;
  }

  if (!detail) {
    return null;
  }

  const { topic, body } = detail;

  return (
    <article>
      <header style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
          {topic.title}
        </h2>
        <p className="sf-muted" style={{ margin: 0, fontSize: "13px" }}>
          <span style={{ marginRight: "16px" }}>
            Status <span className="status-badge">{topic.status}</span>
          </span>
          <span>
            Review <span className="status-badge">{topic.review_state}</span>
          </span>
        </p>
      </header>

      <section className="sf-section">
        <h3 className="sf-section-title">Coverage flags</h3>
        <p className="sf-hint">Click a flag to turn it on or off (saved to topic file).</p>
        <div className="btn-group" style={{ marginTop: "10px" }}>
          {COVERAGE_FLAGS.map(({ key, label }) => {
            const active = topic.coverage[key];
            return (
              <button
                key={key}
                type="button"
                disabled={updating}
                aria-pressed={active}
                data-testid={`coverage-${key}`}
                title={active ? `Clear ${label}` : `Set ${label}`}
                onClick={() => toggleCoverage(key)}
                className="flag-pill"
              >
                {active ? "✓ " : ""}
                {label}
              </button>
            );
          })}
        </div>
        {actionError && <p className="sf-error-text" style={{ marginTop: "8px" }}>{actionError}</p>}
      </section>

      <section className="sf-section">
        <h3 className="sf-section-title">Status promotion</h3>
        <p className="sf-hint">
          scaffolded → expanded → reconciled → execution ready (one step per click)
        </p>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="advance-status"
          disabled={updating || nextDesignStatus(topic.status) === null}
          onClick={handleAdvanceStatus}
          style={{ marginTop: "8px" }}
        >
          {advanceStatusLabel(topic.status)}
        </button>
      </section>

      <section className="sf-section">
        <h3 className="sf-section-title">LLM prompts</h3>
        <p className="sf-hint">
          Copies a prompt to clipboard → paste in ChatGPT/Claude → use the reply in the topic body or notes.
          For structured changes (children, links), use Decompose / Add link in the toolbar above.
        </p>
        <div className="btn-group">
          <button
            type="button"
            className="btn"
            data-testid="copy-expand-prompt"
            disabled={updating}
            onClick={() => void copyPrompt("expand", "Expansion prompt")}
          >
            Copy expansion prompt
          </button>
          <button
            type="button"
            className="btn"
            data-testid="copy-reconcile-prompt"
            disabled={updating}
            onClick={() => void copyPrompt("reconcile-parent", "Reconciliation prompt")}
          >
            Copy reconcile prompt
          </button>
        </div>
        {promptMessage && (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--sf-success)" }}>{promptMessage}</p>
        )}
      </section>

      <section className="sf-section">
        <h3 className="sf-section-title">Body</h3>
        <pre className="sf-pre">{body || "(empty)"}</pre>
      </section>
    </article>
  );
}
