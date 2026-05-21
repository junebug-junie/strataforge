import { useCallback, useEffect, useState } from "react";
import { getTopicContext, type TopicContext, type TopicRef } from "../api";

interface TopicContextPanelProps {
  projectId: string;
  topicId: string;
  onSelectTopic: (topicId: string) => void;
}

function RefList({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: TopicRef[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>{label}</div>
      <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "12px" }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: "2px" }}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#1e40af",
                cursor: "pointer",
                fontSize: "12px",
                textAlign: "left",
              }}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TopicContextPanel({
  projectId,
  topicId,
  onSelectTopic,
}: TopicContextPanelProps) {
  const [context, setContext] = useState<TopicContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTopicContext(projectId, topicId)
      .then(setContext)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, topicId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasLinks =
    context &&
    (context.depends_on.length > 0 ||
      context.feeds_into.length > 0 ||
      context.blocks.length > 0);

  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: "1px solid #eee",
        fontSize: "12px",
        maxHeight: "220px",
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>Structure</div>
      {loading && <p style={{ margin: 0, color: "#9ca3af" }}>Loading…</p>}
      {error && <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>}
      {!loading && !error && context && (
        <>
          {context.parent ? (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>Parent</div>
              <button
                type="button"
                onClick={() => onSelectTopic(context.parent!.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#1e40af",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {context.parent.title}
              </button>
            </div>
          ) : (
            <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: "11px" }}>No parent (root area)</p>
          )}
          <RefList label="Children" items={context.children} onSelect={onSelectTopic} />
          {!hasLinks && (
            <p style={{ margin: "8px 0 0", color: "#9ca3af", fontSize: "11px" }}>
              No links yet — use Add link after expansion.
            </p>
          )}
          <RefList label="Depends on" items={context.depends_on} onSelect={onSelectTopic} />
          <RefList label="Feeds into" items={context.feeds_into} onSelect={onSelectTopic} />
          <RefList label="Blocks" items={context.blocks} onSelect={onSelectTopic} />
        </>
      )}
    </div>
  );
}
