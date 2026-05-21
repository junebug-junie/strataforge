import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptProposal,
  applySession,
  getSession,
  getSessionIntakePrompt,
  importProposals,
  listSessions,
  startSession,
  updateSessionInputs,
  type SessionDetail,
} from "../api";
import { INTAKE_WORKFLOW } from "../workflowGuides";
import { SAMPLE_INTAKE_BUNDLE } from "../sampleIntakeBundle";
import SessionLlmToolbar from "./SessionLlmToolbar";
import ProposalCard from "./ProposalCard";
import { useToast } from "./Toast";
import WorkflowCallout, { SectionPhaseHint } from "./WorkflowCallout";

interface SessionPanelProps {
  projectId: string;
  onTopicsChanged: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function SessionPanel({
  projectId,
  onTopicsChanged,
  onSelectTopic,
}: SessionPanelProps) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [proposalJson, setProposalJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [appliedTopics, setAppliedTopics] = useState<{ id: string; title: string }[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [augmentedPrompt, setAugmentedPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useToast();

  const loadSession = useCallback(async (sessionId: string) => {
    const detail = await getSession(projectId, sessionId);
    setSession(detail);
    const saved = detail.inputs.source_prompt;
    setSourcePrompt(typeof saved === "string" ? saved : "");
    return detail;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const existing = await listSessions(projectId, "intake");
        const sessionToLoad =
          existing.length > 0 ? existing[0] : (await startSession(projectId, "Intake", "intake"));
        if (cancelled) return;
        await loadSession(sessionToLoad.id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load session");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadSession]);

  useEffect(() => {
    if (!session) return;
    if (promptTimer.current) clearTimeout(promptTimer.current);
    setPromptLoading(true);
    promptTimer.current = setTimeout(() => {
      void getSessionIntakePrompt(projectId, session.id, sourcePrompt)
        .then((prompt) => {
          setAugmentedPrompt(prompt);
        })
        .catch((err: Error) => {
          setAugmentedPrompt("");
          setStatusMessage(err.message);
        })
        .finally(() => {
          setPromptLoading(false);
        });
    }, 400);
    return () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    };
  }, [projectId, session, sourcePrompt]);

  const acceptedCount =
    session?.proposals.filter((p) => p.state === "accepted").length ?? 0;

  const handleStartNewSession = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const created = await startSession(projectId, "Intake", "intake");
      await loadSession(created.id);
      setProposalJson("");
      setStatusMessage("Started new intake session.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setBusy(false);
    }
  };

  const scheduleSaveSourcePrompt = (value: string) => {
    setSourcePrompt(value);
    if (!session) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateSessionInputs(projectId, session.id, { source_prompt: value })
        .then((updated) => {
          setSession((prev) => (prev ? { ...prev, inputs: updated.inputs } : prev));
        })
        .catch((err: Error) => setStatusMessage(err.message));
    }, 600);
  };

  const handleCopyIntakePrompt = async () => {
    if (!session || !augmentedPrompt) return;
    try {
      await navigator.clipboard.writeText(augmentedPrompt);
      setCopyMessage("Augmented prompt copied — paste into ChatGPT/Claude.");
    } catch {
      setCopyMessage("Could not copy — select the prompt text below and copy manually.");
      console.log(augmentedPrompt);
    }
  };

  const handleImportProposals = async (bundle: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await importProposals(projectId, session.id, bundle);
      await loadSession(session.id);
      setProposalJson("");
      setStatusMessage("Proposals imported — review each card, then Apply.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSampleProposals = () => {
    void handleImportProposals({ ...SAMPLE_INTAKE_BUNDLE, proposals: [...SAMPLE_INTAKE_BUNDLE.proposals] });
  };

  const handleRunSampleDemo = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await importProposals(projectId, session.id, {
        ...SAMPLE_INTAKE_BUNDLE,
        proposals: [...SAMPLE_INTAKE_BUNDLE.proposals],
      });
      let detail = await getSession(projectId, session.id);
      for (const proposal of detail.proposals) {
        await acceptProposal(projectId, proposal.id);
      }
      detail = await getSession(projectId, session.id);
      setSession(detail);
      const result = await applySession(projectId, session.id);
      onTopicsChanged();
      setAppliedTopics(result.created.map((topic) => ({ id: topic.id, title: topic.title })));
      if (result.created.length > 0) {
        onSelectTopic(result.created[0].id);
      }
      setStatusMessage(
        `Demo complete — imported ${detail.proposals.length} proposals, applied ${result.created.length} topic scaffold(s). Pick a topic below to expand it.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApplySession = async () => {
    if (!session || acceptedCount === 0) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await applySession(projectId, session.id);
      onTopicsChanged();
      setAppliedTopics(result.created.map((topic) => ({ id: topic.id, title: topic.title })));
      if (result.created.length > 0) {
        onSelectTopic(result.created[0].id);
      }
      setStatusMessage(
        `Applied session — created ${result.created.length} topic scaffold(s). Click a topic in Atlas above to expand it.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const refreshProposals = () => {
    if (!session) return;
    void loadSession(session.id).catch((err: Error) => setError(err.message));
  };

  if (loading) {
    return <p className="sf-muted">Starting session…</p>;
  }

  if (error && !session) {
    return <p className="sf-error-text">{error}</p>;
  }

  if (!session) {
    return null;
  }

  return (
    <section className="session-panel sf-panel">
      <header className="session-panel__header">
        <div>
          <h2 className="session-panel__title">{session.title}</h2>
          <p className="session-panel__meta">
            {session.id} · {session.mode}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void handleStartNewSession()}
        >
          New session
        </button>
      </header>

      <WorkflowCallout
        testId="workflow-intake"
        title="Intake workflow (manual LLM pairing)"
        summary="Manual paste always works. With OPENAI_API_KEY set, use Run with LLM to fill the paste area — you still Import, gate proposals, and Apply before anything hits disk."
        steps={INTAKE_WORKFLOW}
      />

      <div className="session-callout">
        <p className="session-callout__title">New here?</p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void handleRunSampleDemo()}
        >
          Run sample demo (import → accept → apply)
        </button>
        <p className="sf-hint" style={{ marginTop: "8px" }}>
          Populates the atlas tree instantly with two sample areas.
        </p>
      </div>

      <div className="session-field">
        <div className="session-field__label-row">
          <label className="sf-section-title" htmlFor="source-prompt" style={{ margin: 0 }}>
            1. Architecture idea
          </label>
          <SectionPhaseHint phase="strataforge" />
        </div>
        <textarea
          id="source-prompt"
          className="sf-textarea"
          value={sourcePrompt}
          onChange={(e) => scheduleSaveSourcePrompt(e.target.value)}
          rows={3}
          placeholder="Describe the architecture you want to decompose…"
          style={{ fontFamily: "inherit", marginTop: "6px" }}
        />
        <div className="session-field__label-row" style={{ marginTop: "14px" }}>
          <label className="sf-section-title" htmlFor="augmented-prompt" style={{ margin: 0 }}>
            2. Augmented prompt
          </label>
          <SectionPhaseHint phase="strataforge" text="copy from here" />
          <SectionPhaseHint phase="external" text="paste in LLM" />
        </div>
        <p className="sf-hint">
          Includes your idea, project context, existing atlas areas, and strict JSON-only output rules.
        </p>
        <textarea
          id="augmented-prompt"
          className="sf-textarea"
          readOnly
          value={promptLoading ? "Building augmented prompt…" : augmentedPrompt}
          rows={12}
          style={{ marginTop: "6px", background: "var(--sf-surface-2)" }}
        />
        <div className="btn-group" style={{ marginTop: "8px" }}>
          <button
            type="button"
            className="btn"
            disabled={!augmentedPrompt || promptLoading}
            onClick={() => void handleCopyIntakePrompt()}
          >
            Copy augmented prompt
          </button>
        </div>
        {copyMessage && (
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--sf-success)" }}>{copyMessage}</p>
        )}
      </div>

      <div className="session-field">
        <div className="session-field__label-row">
          <label className="sf-section-title" htmlFor="proposal-json" style={{ margin: 0 }}>
            3. Paste the LLM&apos;s reply
          </label>
          <SectionPhaseHint phase="return" text="paste JSON here" />
        </div>
        <p className="sf-hint">
          Use Run &amp; import below (structured JSON), or paste manually.
        </p>
        {session && (
          <SessionLlmToolbar
            projectId={projectId}
            sessionId={session.id}
            command="intake"
            session={session}
            sourcePrompt={sourcePrompt}
            busy={busy}
            setBusy={setBusy}
            proposalJson={proposalJson}
            setProposalJson={setProposalJson}
            onSessionUpdated={setSession}
            onTopicsChanged={onTopicsChanged}
            onSelectTopic={onSelectTopic}
            testIdPrefix="intake"
          />
        )}
        <textarea
          id="proposal-json"
          className="sf-textarea"
          value={proposalJson}
          onChange={(e) => setProposalJson(e.target.value)}
          rows={5}
          placeholder='{"session_mode":"intake","proposals":[...]}'
          style={{ marginTop: "6px" }}
        />
        <div className="btn-group" style={{ marginTop: "8px" }}>
          <button type="button" className="btn" disabled={busy} onClick={handleLoadSampleProposals}>
            Load sample JSON
          </button>
        </div>
      </div>

      <div className="session-field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div className="session-field__label-row" style={{ flex: 1 }}>
            <h3 className="sf-section-title" style={{ margin: 0 }}>
              4. Proposals ({session.proposals.length}
              {acceptedCount > 0 ? `, ${acceptedCount} accepted` : ""})
            </h3>
            <SectionPhaseHint phase="strataforge" text="gates + apply" />
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || acceptedCount === 0}
            title={acceptedCount === 0 ? "Accept at least one proposal first" : "Write accepted scaffolds to disk"}
            onClick={() => void handleApplySession()}
          >
            Apply session
          </button>
        </div>
        {session.proposals.length === 0 ? (
          <p className="sf-hint" style={{ marginTop: "8px" }}>
            No proposals yet — import JSON or run the sample demo above.
          </p>
        ) : (
          <div style={{ marginTop: "10px" }}>
            {session.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                projectId={projectId}
                proposal={proposal}
                onUpdated={refreshProposals}
              />
            ))}
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="sf-banner sf-banner--success" style={{ marginBottom: "12px" }}>
          <p style={{ margin: 0 }}>{statusMessage}</p>
          {appliedTopics.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 600 }}>
                Created topics — click to open:
              </p>
              <div className="btn-group">
                {appliedTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className="btn btn--pill"
                    onClick={() => onSelectTopic(topic.id)}
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="sf-error-text" style={{ margin: 0 }}>{error}</p>}
    </section>
  );
}
