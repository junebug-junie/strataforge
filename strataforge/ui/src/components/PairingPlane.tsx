import SessionPanel from "./SessionPanel";
import TopicEditor from "./TopicEditor";

interface PairingPlaneProps {
  projectId: string;
  selectedTopicId: string | null;
  onTopicsChanged: () => void;
}

export default function PairingPlane({
  projectId,
  selectedTopicId,
  onTopicsChanged,
}: PairingPlaneProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        borderRight: "1px solid #ddd",
        overflow: "auto",
      }}
    >
      <div style={{ padding: "16px", borderBottom: "1px solid #eee" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
          Active Pairing Session
        </h2>
        <SessionPanel projectId={projectId} onTopicsChanged={onTopicsChanged} />
      </div>

      {selectedTopicId && (
        <div style={{ padding: "16px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Topic Detail
          </h2>
          <TopicEditor
            projectId={projectId}
            topicId={selectedTopicId}
            onUpdated={onTopicsChanged}
          />
        </div>
      )}
    </div>
  );
}
