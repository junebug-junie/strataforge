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
        className={`atlas-row${selected ? " is-selected" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        {node.title}
      </button>
      {node.children.length > 0 && (
        <ul className="atlas-tree">
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
    return <p className="sf-muted" style={{ margin: 0 }}>No topics yet</p>;
  }

  const flatOnly = roots.every((node) => node.children.length === 0);

  if (flatOnly) {
    return (
      <nav aria-label="Atlas tree">
        <ul className="atlas-tree atlas-tree--chips">
          {roots.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                data-testid={`atlas-topic-${node.id}`}
                className={`atlas-chip${node.id === selectedTopicId ? " is-selected" : ""}`}
                onClick={() => onSelect(node.id)}
              >
                {node.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Atlas tree">
      <ul className="atlas-tree">
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
