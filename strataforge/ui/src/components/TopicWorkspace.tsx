import { useCallback, useState, type CSSProperties } from "react";
import { getTopicPrompt } from "../api";
import LocalGraph from "./LocalGraph";
import TopicContextPanel from "./TopicContextPanel";
import TopicEditor from "./TopicEditor";

interface TopicWorkspaceProps {
  projectId: string;
  topicId: string;
  onUpdated: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function TopicWorkspace({
  projectId,
  topicId,
  onUpdated,
  onSelectTopic,
}: TopicWorkspaceProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const copyExpand = useCallback(async () => {
    setActionMessage(null);
    setActionError(null);
    try {
      const prompt = await getTopicPrompt(projectId, topicId, "expand");
      await navigator.clipboard.writeText(prompt);
      setActionMessage("Expansion prompt copied to clipboard.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to copy prompt");
    }
  }, [projectId, topicId]);

  const stubAction = (label: string) => {
    setActionError(null);
    setActionMessage(`${label} — coming soon (use expansion + link session).`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
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
        <button type="button" onClick={() => void copyExpand()} style={actionBtnStyle}>
          Expand
        </button>
        <button type="button" onClick={() => stubAction("Decompose")} style={actionBtnStyle}>
          Decompose
        </button>
        <button type="button" onClick={() => stubAction("Add link")} style={actionBtnStyle}>
          Add link
        </button>
        <button type="button" onClick={() => stubAction("Boundary check")} style={actionBtnStyle}>
          Boundary check
        </button>
        {actionMessage && (
          <span style={{ fontSize: "12px", color: "#059669", alignSelf: "center" }}>{actionMessage}</span>
        )}
        {actionError && (
          <span style={{ fontSize: "12px", color: "#b91c1c", alignSelf: "center" }}>{actionError}</span>
        )}
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
          <div style={{ flex: 1, minHeight: "200px" }}>
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
