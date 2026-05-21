import { useCallback, useState } from "react";
import {
  getSession,
  importProposals,
  runSessionLlm,
  runSessionLlmPipeline,
  type SessionDetail,
} from "../api";
import { extractJsonFromLlmPaste } from "../lib/llmPaste";
import LlmRunButton from "./LlmRunButton";
import { useToast } from "./Toast";

type SessionCommand = "intake" | "decompose" | "link";

interface SessionLlmToolbarProps {
  projectId: string;
  sessionId: string;
  command: SessionCommand;
  session: SessionDetail;
  sourcePrompt?: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  proposalJson: string;
  setProposalJson: (v: string) => void;
  onSessionUpdated: (s: SessionDetail) => void;
  onTopicsChanged?: () => void;
  onSelectTopic?: (topicId: string) => void;
  testIdPrefix?: string;
}

export default function SessionLlmToolbar({
  projectId,
  sessionId,
  command,
  session,
  sourcePrompt,
  busy,
  setBusy,
  proposalJson,
  setProposalJson,
  onSessionUpdated,
  onTopicsChanged,
  onSelectTopic,
  testIdPrefix = command,
}: SessionLlmToolbarProps) {
  const notify = useToast();
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastStep, setLastStep] = useState<string | null>(null);

  const acceptedCount = session.proposals.filter((p) => p.state === "accepted").length;
  const proposedCount = session.proposals.filter((p) => p.state === "proposed").length;

  const refreshSession = useCallback(async () => {
    const detail = await getSession(projectId, sessionId);
    onSessionUpdated(detail);
    return detail;
  }, [projectId, sessionId, onSessionUpdated]);

  const handleRunImport = useCallback(async () => {
    setBusy(true);
    setParseError(null);
    setLastStep("Running LLM…");
    try {
      const result = await runSessionLlm(projectId, sessionId, command, sourcePrompt);
      setProposalJson(result.text);
      if (result.parse_error) {
        setParseError(result.parse_error);
        setLastStep("Parse failed — edit JSON or retry");
        notify(result.parse_error, "error");
        return;
      }
      if (result.imported) {
        await refreshSession();
        setLastStep(`Imported ${result.proposal_count} proposal(s)`);
        notify(`Imported ${result.proposal_count} proposal(s). Review cards below.`, "success");
      } else {
        setLastStep("No proposals imported");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LLM run failed";
      setParseError(msg);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }, [
    projectId,
    sessionId,
    command,
    sourcePrompt,
    setBusy,
    setProposalJson,
    refreshSession,
    notify,
  ]);

  const handleFullFlow = useCallback(async () => {
    const ok = window.confirm(
      "Run LLM → import → accept all → apply to disk?\n\nYou can still review proposal cards afterward; applied topics are written to the atlas.",
    );
    if (!ok) return;

    setBusy(true);
    setParseError(null);
    setLastStep("Full flow: LLM → import → accept → apply…");
    try {
      const result = await runSessionLlmPipeline(projectId, sessionId, {
        command,
        source_prompt: sourcePrompt,
        accept_all: true,
        apply: true,
      });
      setProposalJson(result.text);
      if (result.parse_error) {
        setParseError(result.parse_error);
        notify(result.parse_error, "error");
        setLastStep("Parse failed");
        return;
      }
      await refreshSession();
      onTopicsChanged?.();
      if (result.created.length > 0 && onSelectTopic) {
        onSelectTopic(result.created[0].id);
      }
      setLastStep(
        `Done: ${result.proposal_count} imported, ${result.accepted_count} accepted, applied ${result.created.length} topic(s)`,
      );
      notify(
        `Applied ${result.created.length} change(s) to the atlas.`,
        "success",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline failed";
      setParseError(msg);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }, [
    projectId,
    sessionId,
    command,
    sourcePrompt,
    setBusy,
    setProposalJson,
    refreshSession,
    onTopicsChanged,
    onSelectTopic,
    notify,
  ]);

  const handleManualImport = useCallback(async () => {
    setParseError(null);
    try {
      const bundle = extractJsonFromLlmPaste(proposalJson);
      await importProposals(projectId, sessionId, bundle);
      await refreshSession();
      notify("Imported proposals.", "success");
      setLastStep("Imported from paste");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setParseError(msg);
      notify(msg, "error");
    }
  }, [proposalJson, projectId, sessionId, refreshSession, notify]);

  return (
    <div className="session-llm-toolbar" data-testid={`session-llm-toolbar-${testIdPrefix}`}>
      <div className="session-llm-toolbar__steps" data-testid="llm-workflow-step">
        {lastStep ? (
          <span>{lastStep}</span>
        ) : (
          <span className="sf-muted">
            Step 1: Run LLM · Step 2: Review · Step 3: Accept · Step 4: Apply
          </span>
        )}
      </div>

      <div className="btn-group" style={{ marginBottom: "8px", flexWrap: "wrap" }}>
        <LlmRunButton
          testId={`run-${testIdPrefix}-llm`}
          variant="primary"
          label="Run & import"
          runningLabel="Running LLM…"
          disabled={busy}
          onRun={handleRunImport}
        />
        <button
          type="button"
          className="btn btn--primary"
          data-testid={`full-flow-${testIdPrefix}`}
          disabled={busy}
          onClick={() => void handleFullFlow()}
        >
          Run full flow
        </button>
        <button
          type="button"
          className="btn"
          data-testid={`import-${testIdPrefix}`}
          disabled={busy || !proposalJson.trim()}
          onClick={() => void handleManualImport()}
        >
          Import paste
        </button>
      </div>

      {parseError && (
        <div className="sf-banner sf-banner--error" style={{ marginBottom: "8px" }}>
          <p style={{ margin: "0 0 8px" }}>{parseError}</p>
          <button type="button" className="btn" disabled={busy} onClick={() => void handleRunImport()}>
            Retry LLM
          </button>
        </div>
      )}

      {session.proposals.length > 0 && (
        <div className="btn-group" style={{ marginBottom: "8px" }}>
          <span className="sf-muted" style={{ fontSize: "12px", alignSelf: "center" }}>
            {proposedCount} proposed · {acceptedCount} accepted
          </span>
        </div>
      )}
    </div>
  );
}
