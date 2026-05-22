import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getTopicContext, type TopicContext } from "../api";

interface LocalGraphProps {
  projectId: string;
  topicId: string;
  onSelectTopic: (topicId: string) => void;
}

const REL_COLORS: Record<string, string> = {
  parent: "#6366f1",
  child: "#059669",
  depends: "#d97706",
  feeds: "#0284c7",
  blocks: "#dc2626",
};

function layoutNeighbors(
  centerId: string,
  centerTitle: string,
  neighbors: { id: string; title: string; rel: string }[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: centerId,
      data: { label: centerTitle },
      position: { x: 120, y: 80 },
      style: {
        fontWeight: 700,
        fontSize: 12,
        border: "2px solid var(--sf-accent)",
        borderRadius: 8,
        padding: 8,
        background: "var(--sf-accent-soft)",
        width: 140,
      },
    },
  ];
  const edges: Edge[] = [];

  const buckets: Record<string, typeof neighbors> = {
    parent: [],
    child: [],
    depends: [],
    feeds: [],
    blocks: [],
  };
  for (const n of neighbors) {
    (buckets[n.rel] ?? buckets.child).push(n);
  }

  const slots: { rel: string; x: number; y: number; dx: number; dy: number }[] = [
    { rel: "parent", x: 120, y: 0, dx: 0, dy: 55 },
    { rel: "child", x: 120, y: 160, dx: 0, dy: 55 },
    { rel: "depends", x: 0, y: 80, dx: 150, dy: 0 },
    { rel: "feeds", x: 280, y: 80, dx: 150, dy: 0 },
    { rel: "blocks", x: 120, y: 200, dx: 0, dy: 55 },
  ];

  for (const slot of slots) {
    const items = buckets[slot.rel];
    items.forEach((item, i) => {
      const offset = (i - (items.length - 1) / 2) * (slot.dx || slot.dy);
      nodes.push({
        id: item.id,
        data: { label: item.title },
        position: {
          x: slot.x + (slot.dx ? offset : 0),
          y: slot.y + (slot.dy ? offset : 0),
        },
        style: {
          fontSize: 11,
          border: `1px solid ${REL_COLORS[item.rel] ?? "#ccc"}`,
          borderRadius: 6,
          padding: 6,
          background: "var(--sf-surface)",
          width: 120,
          cursor: "pointer",
        },
      });
      const edgeEnds =
        item.rel === "parent" || item.rel === "depends"
          ? { source: item.id, target: centerId }
          : { source: centerId, target: item.id };
      edges.push({
        id: `${item.rel}-${centerId}-${item.id}`,
        ...edgeEnds,
        label: item.rel,
        labelStyle: { fontSize: 9, fill: REL_COLORS[item.rel] },
        style: { stroke: REL_COLORS[item.rel], strokeWidth: 1.5 },
        animated: item.rel === "feeds",
      });
    });
  }

  return { nodes, edges };
}

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

  const graph = useMemo(() => {
    if (!context) return { nodes: [] as Node[], edges: [] as Edge[] };
    const neighbors: { id: string; title: string; rel: string }[] = [];
    if (context.parent) neighbors.push({ ...context.parent, rel: "parent" });
    for (const c of context.children) neighbors.push({ ...c, rel: "child" });
    for (const d of context.depends_on) neighbors.push({ ...d, rel: "depends" });
    for (const f of context.feeds_into) neighbors.push({ ...f, rel: "feeds" });
    for (const b of context.blocks) neighbors.push({ ...b, rel: "blocks" });
    return layoutNeighbors(context.topic.id, context.topic.title, neighbors);
  }, [context]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (node.id !== topicId) onSelectTopic(node.id);
    },
    [onSelectTopic, topicId],
  );

  if (loading) {
    return <p className="sf-muted local-graph-placeholder">Loading graph…</p>;
  }
  if (error) {
    return <p className="sf-error-text local-graph-placeholder">{error}</p>;
  }
  if (!context) {
    return null;
  }

  if (graph.nodes.length <= 1) {
    return (
      <div className="local-graph-placeholder">
        <p className="sf-muted" style={{ margin: "0 0 8px" }}>
          <strong>{context.topic.title}</strong> — no neighbors yet
        </p>
        <p className="sf-hint" style={{ margin: 0 }}>
          Use Decompose for children or Add link for dependencies.
        </p>
      </div>
    );
  }

  return (
    <div className="local-graph-flow" data-testid="local-graph">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background gap={12} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
