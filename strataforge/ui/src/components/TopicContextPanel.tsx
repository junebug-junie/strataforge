import { useCallback, useEffect, useState } from "react";
import { getTopicContext, type TopicContext, type TopicRef } from "../api";

const COMMAND_LABELS: Record<string, string> = {
  expand: "Expand",
  decompose: "Decompose",
  link: "Add link",
  "boundary-check": "Boundary check",
  "reconcile-parent": "Reconcile parent",
};

interface TopicContextPanelProps {
  projectId: string;
  topicId: string;
  onSelectTopic: (topicId: string) => void;
  onRunCommand?: (command: string) => void;
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
  const testId = `ref-list-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div style={{ marginBottom: "8px" }} data-testid={testId}>
      <div className="ref-list__label">{label}</div>
      <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "12px" }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: "2px" }}>
            <button type="button" className="ref-list__link" onClick={() => onSelect(item.id)}>
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
  onRunCommand,
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

  const commands = context?.recommended_commands ?? [];

  return (
    <div className="topic-context-panel">
      <h3>Structure</h3>
      {loading && <p className="sf-muted" style={{ margin: 0 }}>Loading…</p>}
      {error && <p className="sf-error-text" style={{ margin: 0 }}>{error}</p>}
      {!loading && !error && context && (
        <>
          {commands.length > 0 && onRunCommand && (
            <div style={{ marginBottom: "12px" }} data-testid="recommended-commands">
              <div className="ref-list__label">Suggested next</div>
              <div className="btn-group">
                {commands.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    className="btn btn--pill"
                    data-testid={`cmd-${cmd}`}
                    onClick={() => onRunCommand(cmd)}
                  >
                    {COMMAND_LABELS[cmd] ?? cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
          {context.parent ? (
            <div style={{ marginBottom: "8px" }}>
              <div className="ref-list__label">Parent</div>
              <button type="button" className="ref-list__link" onClick={() => onSelectTopic(context.parent!.id)}>
                {context.parent.title}
              </button>
            </div>
          ) : (
            <p className="sf-muted" style={{ margin: "0 0 8px", fontSize: "11px" }}>
              No parent (root area)
            </p>
          )}
          <RefList label="Children" items={context.children} onSelect={onSelectTopic} />
          {!hasLinks && (
            <p className="sf-muted" style={{ margin: "8px 0 0", fontSize: "11px" }}>
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
