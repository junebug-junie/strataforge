import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getTopicContext, type TopicContext } from "../api";

interface LocalGraphProps {
  projectId: string;
  topicId: string;
  onSelectTopic: (topicId: string) => void;
}

function buildGraph(context: TopicContext, selectedId: string): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, { title: string; role: "selected" | "neighbor" }>();

  const add = (id: string, title: string, role: "selected" | "neighbor") => {
    if (!nodeMap.has(id)) nodeMap.set(id, { title, role });
    else if (role === "selected") nodeMap.set(id, { title, role: "selected" });
  };

  add(selectedId, context.topic.title, "selected");
  if (context.parent) add(context.parent.id, context.parent.title, "neighbor");
  for (const c of context.children) add(c.id, c.title, "neighbor");
  for (const d of context.depends_on) add(d.id, d.title, "neighbor");
  for (const f of context.feeds_into) add(f.id, f.title, "neighbor");
  for (const b of context.blocks) add(b.id, b.title, "neighbor");

  const ids = [...nodeMap.keys()];
  const centerX = 120;
  const centerY = 100;
  const radius = 72;

  const nodes: Node[] = ids.map((id, index) => {
    const meta = nodeMap.get(id)!;
    const isSelected = id === selectedId;
    let x = centerX;
    let y = centerY;
    if (!isSelected) {
      const angle = (2 * Math.PI * index) / Math.max(ids.length, 1);
      x = centerX + radius * Math.cos(angle);
      y = centerY + radius * Math.sin(angle);
    }
    return {
      id,
      position: { x, y },
      data: { label: meta.title },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        fontSize: "11px",
        padding: "6px 8px",
        borderRadius: "6px",
        border: isSelected ? "2px solid #2563eb" : "1px solid #d1d5db",
        background: isSelected ? "#eff6ff" : "#fff",
        maxWidth: "120px",
        textAlign: "center" as const,
      },
    };
  });

  const edges: Edge[] = [];
  if (context.parent) {
    edges.push({
      id: `parent-${context.parent.id}`,
      source: context.parent.id,
      target: selectedId,
      label: "contains",
      style: { stroke: "#9ca3af" },
      labelStyle: { fontSize: 9 },
    });
  }
  for (const child of context.children) {
    edges.push({
      id: `child-${child.id}`,
      source: selectedId,
      target: child.id,
      label: "contains",
      style: { stroke: "#9ca3af" },
      labelStyle: { fontSize: 9 },
    });
  }
  for (const dep of context.depends_on) {
    edges.push({
      id: `dep-${dep.id}`,
      source: dep.id,
      target: selectedId,
      label: "depends",
      style: { stroke: "#f59e0b" },
      labelStyle: { fontSize: 9 },
    });
  }
  for (const feed of context.feeds_into) {
    edges.push({
      id: `feed-${feed.id}`,
      source: selectedId,
      target: feed.id,
      label: "feeds",
      style: { stroke: "#10b981" },
      labelStyle: { fontSize: 9 },
    });
  }
  for (const block of context.blocks) {
    edges.push({
      id: `block-${block.id}`,
      source: block.id,
      target: selectedId,
      label: "blocks",
      style: { stroke: "#ef4444" },
      labelStyle: { fontSize: 9 },
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

  const { nodes, edges } = useMemo(() => {
    if (!context) return { nodes: [], edges: [] };
    return buildGraph(context, topicId);
  }, [context, topicId]);

  if (loading) {
    return <p style={{ padding: "12px", fontSize: "12px", color: "#9ca3af", margin: 0 }}>Loading graph…</p>;
  }
  if (error) {
    return <p style={{ padding: "12px", fontSize: "12px", color: "#b91c1c", margin: 0 }}>{error}</p>;
  }

  return (
    <div style={{ width: "100%", height: "200px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        onNodeClick={(_e, node) => onSelectTopic(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={12} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
