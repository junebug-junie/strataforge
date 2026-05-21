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
import { SAMPLE_INTAKE_BUNDLE } from "../sampleIntakeBundle";
import ProposalCard from "./ProposalCard";

function extractJsonFromLlmPaste(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste is empty");

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const parsed: unknown = JSON.parse(fence[1].trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error(
    "Could not find a JSON object. Paste the LLM's answer, not the prompt you sent it.",
  );
}

interface SessionPanelProps {
  projectId: string;
  onTopicsChanged: () => void;
  onSelectTopic: (topicId: string) => void;
}

const STEPS = [
  "Describe your architecture idea",
  "Copy the augmented prompt below → paste into ChatGPT/Claude",
  "Copy the LLM's entire reply back here (```json fences are OK)",
  "Accept proposals, then Apply session",
];

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
    return <p style={{ color: "#666", fontSize: "13px" }}>Starting session…</p>;
  }

  if (error && !session) {
    return <p style={{ color: "#b91c1c", fontSize: "13px" }}>{error}</p>;
  }

  if (!session) {
    return null;
  }

  return (
    <section style={{ textAlign: "left" }}>
      <header style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>{session.title}</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
              {session.id} · {session.mode}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStartNewSession()}
            style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
          >
            New session
          </button>
        </div>
      </header>

      <ol
        style={{
          margin: "0 0 16px",
          padding: "12px 12px 12px 28px",
          fontSize: "12px",
          color: "#4b5563",
          background: "#f3f4f6",
          borderRadius: "8px",
          lineHeight: 1.5,
        }}
      >
        {STEPS.map((step) => (
          <li key={step} style={{ marginBottom: "4px" }}>
            {step}
          </li>
        ))}
      </ol>

      <div
        style={{
          marginBottom: "16px",
          padding: "12px",
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#1e3a8a" }}>
          New here?
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleRunSampleDemo()}
          style={{
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            background: "#1e40af",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
          }}
        >
          Run sample demo (import → accept → apply)
        </button>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#1e40af" }}>
          Populates the atlas tree instantly with two sample areas.
        </p>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="source-prompt" style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
          1. Architecture idea
        </label>
        <textarea
          id="source-prompt"
          value={sourcePrompt}
          onChange={(e) => scheduleSaveSourcePrompt(e.target.value)}
          rows={3}
          placeholder="Describe the architecture you want to decompose…"
          style={{
            width: "100%",
            marginTop: "6px",
            padding: "8px",
            fontSize: "13px",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <label htmlFor="augmented-prompt" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginTop: "14px" }}>
          2. Augmented prompt (for external LLM)
        </label>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
          Includes your idea, project context, existing atlas areas, and strict JSON-only output rules.
        </p>
        <textarea
          id="augmented-prompt"
          readOnly
          value={promptLoading ? "Building augmented prompt…" : augmentedPrompt}
          rows={12}
          style={{
            width: "100%",
            marginTop: "6px",
            padding: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            boxSizing: "border-box",
            background: "#f9fafb",
            color: "#374151",
          }}
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!augmentedPrompt || promptLoading}
            onClick={() => void handleCopyIntakePrompt()}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Copy augmented prompt
          </button>
        </div>
        {copyMessage && (
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#059669" }}>{copyMessage}</p>
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="proposal-json" style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
          3. Paste the LLM&apos;s reply
        </label>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
          Copy the LLM&apos;s whole answer here — the prompt tells it to respond with JSON only.
          If it wraps output in ```json fences anyway, that&apos;s fine.
        </p>
        <textarea
          id="proposal-json"
          value={proposalJson}
          onChange={(e) => setProposalJson(e.target.value)}
          rows={5}
          placeholder='{"session_mode":"intake","proposals":[...]}'
          style={{
            width: "100%",
            marginTop: "6px",
            padding: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || !proposalJson.trim()}
            onClick={() => {
              try {
                const bundle = extractJsonFromLlmPaste(proposalJson);
                void handleImportProposals(bundle);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Import failed");
              }
            }}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Import proposals
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleLoadSampleProposals}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Load sample JSON
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
            4. Proposals ({session.proposals.length}
            {acceptedCount > 0 ? `, ${acceptedCount} accepted` : ""})
          </h3>
          <button
            type="button"
            disabled={busy || acceptedCount === 0}
            title={acceptedCount === 0 ? "Accept at least one proposal first" : "Write accepted scaffolds to disk"}
            onClick={() => void handleApplySession()}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              cursor: acceptedCount === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: acceptedCount === 0 ? 0.5 : 1,
            }}
          >
            Apply session
          </button>
        </div>
        {session.proposals.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>
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
        <div
          style={{
            margin: "0 0 12px",
            padding: "12px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "8px",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#065f46" }}>{statusMessage}</p>
          {appliedTopics.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 600, color: "#047857" }}>
                Created topics — click to open:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {appliedTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => onSelectTopic(topic.id)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      cursor: "pointer",
                      background: "#fff",
                      border: "1px solid #6ee7b7",
                      borderRadius: "999px",
                      color: "#047857",
                    }}
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      )}
    </section>
  );
}
