import { useState } from "react";
import SessionPanel from "./SessionPanel";
import TopicWorkspace from "./TopicWorkspace";

export type PairingViewMode = "atlas-only" | "topic-focus" | "session-focus";

interface PairingPlaneProps {
  projectId: string;
  selectedTopicId: string | null;
  onTopicsChanged: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function PairingPlane({
  projectId,
  selectedTopicId,
  onTopicsChanged,
  onSelectTopic,
}: PairingPlaneProps) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const viewMode: PairingViewMode = selectedTopicId ? "topic-focus" : "session-focus";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        borderRight: "1px solid #ddd",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {viewMode === "topic-focus" && selectedTopicId && (
        <TopicWorkspace
          projectId={projectId}
          topicId={selectedTopicId}
          onUpdated={onTopicsChanged}
          onSelectTopic={onSelectTopic}
        />
      )}

      {viewMode === "session-focus" && (
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Active Pairing Session
          </h2>
          <SessionPanel
            projectId={projectId}
            onTopicsChanged={onTopicsChanged}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}

      {viewMode === "topic-focus" && (
        <div style={{ borderTop: "1px solid #eee", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setSessionOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              background: "#f9fafb",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "10px" }}>{sessionOpen ? "▼" : "▶"}</span>
            Session history
            <span style={{ fontWeight: 400, fontSize: "12px", color: "#6b7280" }}>
              — intake proposals and gates
            </span>
          </button>
          {sessionOpen && (
            <div style={{ padding: "0 16px 16px", maxHeight: "40vh", overflow: "auto" }}>
              <SessionPanel
                projectId={projectId}
                onTopicsChanged={onTopicsChanged}
                onSelectTopic={onSelectTopic}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
