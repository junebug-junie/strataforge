import { useEffect, useState } from "react";
import SessionPanel from "./SessionPanel";
import TopicWorkspace from "./TopicWorkspace";
import WorkflowCallout from "./WorkflowCallout";

export type PairingViewMode = "atlas-only" | "topic-focus" | "session-focus";

interface PairingPlaneProps {
  projectId: string;
  selectedTopicId: string | null;
  selectedTopicTitle: string | null;
  onTopicsChanged: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function PairingPlane({
  projectId,
  selectedTopicId,
  selectedTopicTitle,
  onTopicsChanged,
  onSelectTopic,
}: PairingPlaneProps) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const [activeSessionMode, setActiveSessionMode] = useState<"decompose" | "link" | null>(null);
  const viewMode: PairingViewMode = selectedTopicId ? "topic-focus" : "session-focus";

  useEffect(() => {
    setActiveSessionMode(null);
  }, [selectedTopicId]);

  return (
    <div className="pairing-plane">
      {viewMode === "topic-focus" && selectedTopicId && (
        <TopicWorkspace
          key={selectedTopicId}
          projectId={projectId}
          topicId={selectedTopicId}
          topicTitle={selectedTopicTitle ?? selectedTopicId}
          onUpdated={onTopicsChanged}
          onSelectTopic={onSelectTopic}
          activeSessionMode={activeSessionMode}
          onOpenSession={(mode) => {
            setActiveSessionMode(mode);
            if (mode) setSessionOpen(false);
          }}
          onOpenSessionHistory={() => setSessionOpen(true)}
        />
      )}

      {viewMode === "session-focus" && (
        <div className="session-focus-wrap">
          <h2>Active pairing session</h2>
          <WorkflowCallout
            testId="workflow-session-focus"
            compact
            title="You are in intake mode"
            summary="This is where flat atlas areas are born. After Apply, click a topic pill above — the center panel switches to topic workspace, and this session moves to Session history."
          />
          <div className="sf-panel">
          <SessionPanel
            projectId={projectId}
            onTopicsChanged={onTopicsChanged}
            onSelectTopic={onSelectTopic}
          />
          </div>
        </div>
      )}

      {viewMode === "topic-focus" && (
        <div style={{ flexShrink: 0 }}>
          <button
            type="button"
            className="session-drawer-toggle"
            onClick={() => setSessionOpen((o) => !o)}
          >
            <span style={{ fontSize: "10px" }}>{sessionOpen ? "▼" : "▶"}</span>
            Session history
            <span style={{ fontWeight: 400, fontSize: "12px", color: "var(--sf-text-subtle)" }}>
              — past intake / provenance (not your main workspace)
            </span>
          </button>
          {sessionOpen && (
            <div className="session-drawer-body">
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
