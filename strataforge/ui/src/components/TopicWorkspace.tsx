import { useCallback, useState } from "react";
import { getTopicPrompt, runTopicLlm, updateTopic } from "../api";
import type { TopicCommand } from "../lib/topicCommands";
import ExpandLlmModal from "./ExpandLlmModal";
import LlmRunButton from "./LlmRunButton";
import { copyToClipboard } from "../lib/clipboard";
import LocalGraph from "./LocalGraph";
import TopicActionSessionPanel from "./TopicActionSessionPanel";
import TopicContextPanel from "./TopicContextPanel";
import TopicEditor from "./TopicEditor";
import { useToast } from "./Toast";
import WorkflowCallout from "./WorkflowCallout";
import { TOPIC_ACTION_OPTIONS } from "../workflowGuides";

interface TopicWorkspaceProps {
  projectId: string;
  topicId: string;
  topicTitle: string;
  onUpdated: () => void;
  onSelectTopic: (topicId: string) => void;
  activeSessionMode: "decompose" | "link" | null;
  onOpenSession: (mode: "decompose" | "link" | null) => void;
  onOpenSessionHistory?: () => void;
}

export default function TopicWorkspace({
  projectId,
  topicId,
  topicTitle,
  onUpdated,
  onSelectTopic,
  activeSessionMode,
  onOpenSession,
  onOpenSessionHistory,
}: TopicWorkspaceProps) {
  const notify = useToast();
  const [expandResult, setExpandResult] = useState<string | null>(null);

  const copyExpand = useCallback(async () => {
    try {
      const prompt = await getTopicPrompt(projectId, topicId, "expand");
      const ok = await copyToClipboard(prompt);
      notify(
        ok ? "Expansion prompt copied to clipboard." : "Could not copy — check clipboard permissions.",
        ok ? "success" : "error",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to copy prompt", "error");
    }
  }, [projectId, topicId, notify]);

  const copyBoundary = useCallback(async () => {
    try {
      const prompt = await getTopicPrompt(projectId, topicId, "boundary-check");
      const ok = await copyToClipboard(prompt);
      notify(
        ok ? "Boundary check prompt copied." : "Could not copy — check clipboard permissions.",
        ok ? "success" : "error",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to copy prompt", "error");
    }
  }, [projectId, topicId, notify]);

  const toggleSession = (mode: "decompose" | "link") => {
    if (activeSessionMode === mode) {
      onOpenSession(null);
      notify(`Closed ${mode} session panel.`, "info");
    } else {
      onOpenSession(mode);
    }
  };

  const runCommand = (command: TopicCommand) => {
    switch (command) {
      case "expand":
        void copyExpand();
        break;
      case "boundary-check":
        void copyBoundary();
        break;
      case "decompose":
        toggleSession("decompose");
        break;
      case "link":
        toggleSession("link");
        break;
      case "reconcile-parent":
        void getTopicPrompt(projectId, topicId, "reconcile-parent")
          .then((p) => copyToClipboard(p))
          .then((ok) =>
            notify(
              ok ? "Reconcile prompt copied." : "Copy failed.",
              ok ? "success" : "error",
            ),
          )
          .catch((err: Error) => notify(err.message, "error"));
        break;
      default:
        break;
    }
  };

  return (
    <div className="topic-workspace">
      <header className="topic-workspace-header">
        <h2 className="topic-workspace-title">{topicTitle}</h2>
        <p className="topic-workspace-subtitle">
          Topic workspace · <code className="sf-code">{topicId}</code>
          {onOpenSessionHistory && (
            <>
              {" "}
              ·{" "}
              <button type="button" className="ref-list__link" onClick={onOpenSessionHistory}>
                Session history
              </button>
            </>
          )}
        </p>
      </header>

      {!activeSessionMode && (
        <div style={{ padding: "0 20px", paddingTop: "12px" }}>
          <WorkflowCallout
            testId="workflow-topic-actions"
            compact
            title="What you can do on this topic"
            summary="Use Run with LLM when configured, or copy prompts manually. Expand saves to body; Decompose / Add link import proposals — you still Accept → Apply before disk writes."
            options={TOPIC_ACTION_OPTIONS}
          />
        </div>
      )}

      <div className="topic-toolbar">
        <span className="topic-toolbar__label">Next actions</span>
        <button type="button" className="btn" data-testid="action-expand" onClick={() => void copyExpand()}>
          Copy expand
        </button>
        <LlmRunButton
          testId="run-expand-llm"
          variant="primary"
          label="Run expand"
          onRun={async () => {
            const result = await runTopicLlm(projectId, topicId, "expand");
            setExpandResult(result.text);
            notify("Expansion ready — review and save to body.", "success");
          }}
        />
        <button
          type="button"
          className={`btn${activeSessionMode === "decompose" ? " is-active" : ""}`}
          data-testid="action-decompose"
          onClick={() => toggleSession("decompose")}
        >
          {activeSessionMode === "decompose" ? "Decompose ▾" : "Decompose"}
        </button>
        <button
          type="button"
          className={`btn${activeSessionMode === "link" ? " is-active" : ""}`}
          data-testid="action-link"
          onClick={() => toggleSession("link")}
        >
          {activeSessionMode === "link" ? "Add link ▾" : "Add link"}
        </button>
        <button type="button" className="btn" data-testid="action-boundary" onClick={() => void copyBoundary()}>
          Copy boundary
        </button>
        <LlmRunButton
          testId="run-boundary-llm"
          label="Run boundary"
          onRun={async () => {
            const result = await runTopicLlm(projectId, topicId, "boundary-check");
            setExpandResult(result.text);
            notify("Boundary check result ready.", "success");
          }}
        />
      </div>

      {expandResult && (
        <ExpandLlmModal
          text={expandResult}
          onClose={() => setExpandResult(null)}
          onApply={async (text) => {
            await updateTopic(projectId, topicId, { body: text });
            setExpandResult(null);
            onUpdated();
            notify("Topic body updated.", "success");
          }}
        />
      )}

      {activeSessionMode && (
        <div className="topic-session-panel">
          <TopicActionSessionPanel
            key={`${activeSessionMode}-${topicId}`}
            projectId={projectId}
            topicId={topicId}
            topicTitle={topicTitle}
            mode={activeSessionMode}
            onTopicsChanged={onUpdated}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}

      <div className="topic-layout">
        <aside className="topic-sidebar">
          <div className="topic-sidebar__heading">Local graph (1-hop)</div>
          <div className="topic-sidebar__graph">
            <LocalGraph projectId={projectId} topicId={topicId} onSelectTopic={onSelectTopic} />
          </div>
          <TopicContextPanel
            projectId={projectId}
            topicId={topicId}
            onSelectTopic={onSelectTopic}
            onRunCommand={(cmd) => runCommand(cmd as TopicCommand)}
          />
        </aside>

        <div className="topic-editor-pane">
          <TopicEditor projectId={projectId} topicId={topicId} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}
