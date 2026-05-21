import { useCallback, useEffect, useState } from "react";
import { getTopicContext, type TopicContext } from "../api";

interface LocalGraphProps {
  projectId: string;
  topicId: string;
  onSelectTopic: (topicId: string) => void;
}

/** Lightweight 1-hop view — avoids React Flow overlay / pointer-event issues. */
export default function LocalGraph({ projectId, topicId, onSelectTopic }: LocalGraphProps) {
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

  if (loading) {
    return <p style={{ margin: 0, padding: "12px", fontSize: "12px", color: "#9ca3af" }}>Loading…</p>;
  }
  if (error) {
    return <p style={{ margin: 0, padding: "12px", fontSize: "12px", color: "#b91c1c" }}>{error}</p>;
  }
  if (!context) {
    return null;
  }

  const neighbors: { id: string; title: string; rel: string }[] = [];
  if (context.parent) neighbors.push({ ...context.parent, rel: "parent" });
  for (const c of context.children) neighbors.push({ ...c, rel: "child" });
  for (const d of context.depends_on) neighbors.push({ ...d, rel: "depends" });
  for (const f of context.feeds_into) neighbors.push({ ...f, rel: "feeds" });
  for (const b of context.blocks) neighbors.push({ ...b, rel: "blocks" });

  return (
    <div style={{ padding: "10px 12px", fontSize: "12px" }}>
      <div
        style={{
          padding: "8px 10px",
          marginBottom: "8px",
          borderRadius: "6px",
          border: "2px solid #2563eb",
          background: "#eff6ff",
          fontWeight: 600,
        }}
      >
        ● {context.topic.title}
      </div>
      {neighbors.length === 0 ? (
        <p style={{ margin: 0, color: "#9ca3af" }}>No neighbors yet</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {neighbors.map((n) => (
            <li key={`${n.rel}-${n.id}`} style={{ marginBottom: "6px" }}>
              <button
                type="button"
                onClick={() => onSelectTopic(n.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  background: "#fff",
                }}
              >
                <span style={{ color: "#6b7280", marginRight: "6px" }}>{n.rel}</span>
                {n.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
