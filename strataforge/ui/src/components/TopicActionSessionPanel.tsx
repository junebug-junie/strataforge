import { useCallback, useEffect, useState } from "react";
import {
  acceptProposal,
  applySession,
  getSession,
  getSessionPrompt,
  startSession,
  type SessionDetail,
} from "../api";
import { copyToClipboard } from "../lib/clipboard";
import ProposalCard from "./ProposalCard";
import SessionLlmToolbar from "./SessionLlmToolbar";
import { DECOMPOSE_WORKFLOW, LINK_WORKFLOW } from "../workflowGuides";
import { useToast } from "./Toast";
import WorkflowCallout from "./WorkflowCallout";

interface TopicActionSessionPanelProps {
  projectId: string;
  topicId: string;
  topicTitle: string;
  mode: "decompose" | "link";
  onTopicsChanged: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function TopicActionSessionPanel({
  projectId,
  topicId,
  topicTitle,
  mode,
  onTopicsChanged,
  onSelectTopic,
}: TopicActionSessionPanelProps) {
  const notify = useToast();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [proposalJson, setProposalJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const created = await startSession(
        projectId,
        `${mode}: ${topicTitle}`,
        mode,
        topicId,
      );
      const detail = await getSession(projectId, created.id);
      setSession(detail);
      const prompt = await getSessionPrompt(projectId, created.id, mode);
      const ok = await copyToClipboard(prompt);
      notify(
        ok
          ? `${mode} prompt copied — paste into your LLM, then import the JSON reply below.`
          : "Session started — copy prompt from the button below.",
        ok ? "success" : "info",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  }, [projectId, topicId, topicTitle, mode, notify]);

  useEffect(() => {
    void init();
  }, [init]);

  const handleCopyPrompt = async () => {
    if (!session) return;
    try {
      const prompt = await getSessionPrompt(projectId, session.id, mode);
      const ok = await copyToClipboard(prompt);
      notify(ok ? `${mode} prompt copied.` : "Copy failed.", ok ? "success" : "error");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to load prompt", "error");
    }
  };

  const handleAcceptAll = async () => {
    if (!session) return;
    setBusy(true);
    try {
      for (const p of session.proposals) {
        if (p.state === "proposed") {
          await acceptProposal(projectId, p.id);
        }
      }
      setSession(await getSession(projectId, session.id));
      notify("All proposals accepted.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Accept failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await applySession(projectId, session.id);
      onTopicsChanged();
      if (result.created.length > 0) {
        onSelectTopic(result.created[0].id);
      }
      notify(`Applied — ${result.created.length} change(s) written.`, "success");
      setSession(await getSession(projectId, session.id));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Apply failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="sf-muted">Starting {mode} session…</p>;
  }

  if (error && !session) {
    return <p className="sf-error-text">{error}</p>;
  }

  if (!session) {
    return null;
  }

  const acceptedCount = session.proposals.filter((p) => p.state === "accepted").length;
  const workflowSteps = mode === "decompose" ? DECOMPOSE_WORKFLOW : LINK_WORKFLOW;

  return (
    <section data-testid={`topic-session-${mode}`} className="session-panel">
      <h3 className="session-panel__title" style={{ fontSize: "15px" }}>
        {mode === "decompose" ? "Decompose session" : "Link session"} — {topicTitle}
      </h3>
      <WorkflowCallout
        testId={`workflow-${mode}`}
        compact
        title={mode === "decompose" ? "Decompose workflow" : "Add link workflow"}
        summary={
          mode === "decompose"
            ? "Split this area into child topics (tree). Same HITL loop as intake: external LLM → paste JSON → gates → apply."
            : "Add depends_on / feeds_into / blocks edges (graph). External LLM proposes links; you gate before apply."
        }
        steps={workflowSteps}
      />
      <button
        type="button"
        className="btn btn--ghost"
        disabled={busy}
        data-testid={`copy-${mode}-prompt`}
        onClick={() => void handleCopyPrompt()}
        style={{ marginBottom: "8px" }}
      >
        Copy {mode} prompt (manual)
      </button>
      <SessionLlmToolbar
        projectId={projectId}
        sessionId={session.id}
        command={mode}
        session={session}
        busy={busy}
        setBusy={setBusy}
        proposalJson={proposalJson}
        setProposalJson={setProposalJson}
        onSessionUpdated={setSession}
        onTopicsChanged={onTopicsChanged}
        onSelectTopic={onSelectTopic}
        testIdPrefix={mode}
      />
      <div className="btn-group" style={{ margin: "8px 0" }}>
        <button
          type="button"
          className="btn"
          data-testid={`accept-all-${mode}`}
          disabled={busy || session.proposals.length === 0}
          onClick={() => void handleAcceptAll()}
        >
          Accept all
        </button>
        <button
          type="button"
          className="btn btn--primary"
          data-testid={`apply-${mode}`}
          disabled={busy || acceptedCount === 0}
          onClick={() => void handleApply()}
        >
          Apply session ({acceptedCount} accepted)
        </button>
      </div>
      <textarea
        data-testid={`${mode}-paste`}
        className="sf-textarea"
        value={proposalJson}
        onChange={(e) => setProposalJson(e.target.value)}
        placeholder='Raw LLM JSON (editable) — use Import paste if Run & import failed'
        style={{ minHeight: "80px", marginBottom: "8px" }}
      />
      {error && <p className="sf-error-text" style={{ marginTop: "8px" }}>{error}</p>}
      {session.proposals.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          {session.proposals.map((p) => (
            <ProposalCard
              key={p.id}
              projectId={projectId}
              proposal={p}
              onUpdated={() => void getSession(projectId, session.id).then(setSession)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
