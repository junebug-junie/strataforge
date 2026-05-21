import { useCallback, type CSSProperties } from "react";
import { getTopicPrompt } from "../api";
import { copyToClipboard } from "../lib/clipboard";
import LocalGraph from "./LocalGraph";
import TopicContextPanel from "./TopicContextPanel";
import TopicEditor from "./TopicEditor";
import { useToast } from "./Toast";

interface TopicWorkspaceProps {
  projectId: string;
  topicId: string;
  topicTitle: string;
  onUpdated: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function TopicWorkspace({
  projectId,
  topicId,
  topicTitle,
  onUpdated,
  onSelectTopic,
}: TopicWorkspaceProps) {
  const notify = useToast();

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

  const copyReconcile = useCallback(async () => {
    try {
      const prompt = await getTopicPrompt(projectId, topicId, "reconcile-parent");
      const ok = await copyToClipboard(prompt);
      notify(
        ok ? "Reconciliation prompt copied to clipboard." : "Could not copy — check clipboard permissions.",
        ok ? "success" : "error",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to copy prompt", "error");
    }
  }, [projectId, topicId, notify]);

  return (
    <div className="topic-workspace" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <header className="topic-workspace-header">
        <h2 className="topic-workspace-title">{topicTitle}</h2>
        <p className="topic-workspace-subtitle">
          Topic workspace · <code style={{ fontSize: "11px" }}>{topicId}</code>
        </p>
      </header>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          background: "#fff",
        }}
      >
        <span style={{ fontSize: "12px", color: "#6b7280", alignSelf: "center", marginRight: "4px" }}>
          Next actions
        </span>
        <button type="button" data-testid="action-expand" onClick={() => void copyExpand()} style={actionBtnStyle}>
          Expand
        </button>
        <button
          type="button"
          onClick={() =>
            notify("Decompose: start a link/decompose session (coming soon). Use Expand for now.", "info")
          }
          style={actionBtnStyle}
        >
          Decompose
        </button>
        <button
          type="button"
          onClick={() =>
            notify("Add link: use intake/link session after expansion (coming soon).", "info")
          }
          style={actionBtnStyle}
        >
          Add link
        </button>
        <button type="button" data-testid="action-boundary" onClick={() => void copyReconcile()} style={actionBtnStyle}>
          Boundary check
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "280px",
            flexShrink: 0,
            borderRight: "1px solid #eee",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: "12px", fontWeight: 600 }}>
            Local graph (1-hop)
          </div>
          <div
            className="topic-workspace-graph"
            style={{ flex: "0 0 auto", maxHeight: "220px", overflowY: "auto" }}
          >
            <LocalGraph
              projectId={projectId}
              topicId={topicId}
              onSelectTopic={onSelectTopic}
            />
          </div>
          <TopicContextPanel
            projectId={projectId}
            topicId={topicId}
            onSelectTopic={onSelectTopic}
          />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px", minWidth: 0 }}>
          <TopicEditor projectId={projectId} topicId={topicId} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: "13px",
  cursor: "pointer",
};
