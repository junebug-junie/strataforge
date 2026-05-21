import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySession,
  getSession,
  importProposals,
  startSession,
  updateSessionInputs,
  type SessionDetail,
} from "../api";
import ProposalCard from "./ProposalCard";

const INTAKE_JSON_SCHEMA = `{
  "session_mode": "intake",
  "summary": "Brief summary of proposed decomposition",
  "proposals": [
    {
      "kind": "create_component",
      "title": "Component Name",
      "summary": "One-line description",
      "rationale": "Why this component belongs in the architecture",
      "proposed_changes": {
        "area_slug": "01-component-slug",
        "topic_id": "topic:component-id",
        "title": "Component Name",
        "level": "area"
      }
    }
  ]
}`;

function buildIntakePrompt(sourcePrompt: string, sessionId: string, projectId: string): string {
  return `You are an architecture design partner for StrataForge (manual paste / intake mode).

The human has described an architecture idea. Propose a bounded decomposition into top-level area components. Do not redesign unrelated areas. Distinguish proposals from accepted design. Include rationale and risks.

## Architecture idea

${sourcePrompt.trim() || "(no source prompt saved yet — paste the idea in the UI first)"}

## Session context

- project_id: ${projectId}
- session_id: ${sessionId}
- mode: intake

## CLI-equivalent workflow

1. Save the idea: \`strata session set-input ${sessionId} --prompt-file intake.md --project <project-path>\`
2. Run this prompt in your external LLM.
3. Paste the JSON response: \`strata session import-proposals ${sessionId} --file proposals.json --project <project-path>\`

## Required output

Return ONLY valid JSON matching this schema (no markdown fences):

${INTAKE_JSON_SCHEMA}

Rules:
- Propose 3–8 create_component items for a new project intake.
- Use snake-case area_slug prefixes like 01-session-runtime.
- topic_id must start with topic: and be unique within the bundle.
- Do not accept or apply proposals — the human gates each card in the UI.`;
}

interface SessionPanelProps {
  projectId: string;
  onTopicsChanged: () => void;
}

export default function SessionPanel({ projectId, onTopicsChanged }: SessionPanelProps) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [proposalJson, setProposalJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const created = await startSession(projectId, "Intake", "intake");
        if (cancelled) return;
        await loadSession(created.id);
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

  const handleGenerateIntakePrompt = async () => {
    if (!session) return;
    const text = buildIntakePrompt(sourcePrompt, session.id, projectId);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Intake prompt copied to clipboard.");
    } catch {
      setCopyMessage("Could not copy — select and copy manually from the console.");
      console.log(text);
    }
  };

  const handleImportProposals = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const bundle = JSON.parse(proposalJson) as Record<string, unknown>;
      await importProposals(projectId, session.id, bundle);
      await loadSession(session.id);
      setProposalJson("");
      setStatusMessage("Proposals imported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApplySession = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await applySession(projectId, session.id);
      onTopicsChanged();
      setStatusMessage(`Applied session — created ${result.created.length} topic scaffold(s).`);
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
        <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>{session.title}</h2>
        <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
          {session.id} · {session.mode}
        </p>
      </header>

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="source-prompt" style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
          Architecture idea
        </label>
        <textarea
          id="source-prompt"
          value={sourcePrompt}
          onChange={(e) => scheduleSaveSourcePrompt(e.target.value)}
          rows={4}
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
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void handleGenerateIntakePrompt()}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
          >
            Generate intake prompt
          </button>
        </div>
        {copyMessage && (
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#059669" }}>{copyMessage}</p>
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="proposal-json" style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
          Paste proposal JSON
        </label>
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
        <button
          type="button"
          disabled={busy || !proposalJson.trim()}
          onClick={() => void handleImportProposals()}
          style={{ marginTop: "8px", padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}
        >
          Import proposals
        </button>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
            Proposals ({session.proposals.length})
          </h3>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleApplySession()}
            style={{ padding: "6px 12px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}
          >
            Apply session
          </button>
        </div>
        {session.proposals.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>
            No proposals yet. Import JSON from your external LLM.
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
        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#059669" }}>{statusMessage}</p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      )}
    </section>
  );
}
