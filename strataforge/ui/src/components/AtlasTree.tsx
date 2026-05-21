import type { TopicNode } from "../api";

interface TreeNode extends TopicNode {
  children: TreeNode[];
}

function buildTree(topics: TopicNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const topic of topics) {
    byId.set(topic.id, { ...topic, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const topic of topics) {
    const node = byId.get(topic.id)!;
    if (topic.parent && byId.has(topic.parent)) {
      byId.get(topic.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

interface AtlasTreeProps {
  topics: TopicNode[];
  selectedTopicId: string | null;
  onSelect: (topicId: string) => void;
}

function TreeBranch({
  node,
  selectedTopicId,
  onSelect,
  depth,
}: {
  node: TreeNode;
  selectedTopicId: string | null;
  onSelect: (topicId: string) => void;
  depth: number;
}) {
  const selected = node.id === selectedTopicId;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "4px 8px",
          paddingLeft: `${8 + depth * 16}px`,
          border: "none",
          background: selected ? "#e0e7ff" : "transparent",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        {node.title}
      </button>
      {node.children.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              selectedTopicId={selectedTopicId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AtlasTree({ topics, selectedTopicId, onSelect }: AtlasTreeProps) {
  const roots = buildTree(topics);

  if (topics.length === 0) {
    return <p style={{ margin: 0, padding: "8px", color: "#666" }}>No topics yet</p>;
  }

  return (
    <nav aria-label="Atlas tree">
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {roots.map((node) => (
          <TreeBranch
            key={node.id}
            node={node}
            selectedTopicId={selectedTopicId}
            onSelect={onSelect}
            depth={0}
          />
        ))}
      </ul>
    </nav>
  );
}
