import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const NODE_COLORS: Record<string, string> = {
  Python: '#3572A5', Java: '#b07219', TypeScript: '#2b7489', JavaScript: '#f1e05a',
  Go: '#00ADD8', Rust: '#dea584', CSS: '#563d7c', HTML: '#e34c26',
  Shell: '#89e051', SQL: '#e38c00',
};

function FileNode({ data }: NodeProps) {
  const lang = (data as any).language as string;
  const label = (data as any).label as string;
  const color = NODE_COLORS[lang] || '#8b8b8b';

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 6,
        background: 'var(--code-bg)',
        border: `1px solid ${color}40`,
        fontSize: 12,
        minWidth: 100,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{label}</span>
      </div>
      {lang && <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 2 }}>{lang}</div>}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { fileNode: FileNode };

interface Props {
  nodes: { id: string; label: string; language: string }[];
  edges: { source: string; target: string }[];
  onFileClick: (path: string) => void;
}

export default function DependencyGraphFlow({ nodes: rawNodes, edges: rawEdges, onFileClick }: Props) {
  const initialNodes: Node[] = useMemo(() => {
    const dirs = new Map<string, number>();
    rawNodes.forEach((n) => {
      const dir = n.id.includes('/') ? n.id.substring(0, n.id.lastIndexOf('/')) : 'root';
      dirs.set(dir, (dirs.get(dir) || 0) + 1);
    });

    const dirKeys = [...dirs.keys()];
    return rawNodes.map((n, _i) => {
      const dir = n.id.includes('/') ? n.id.substring(0, n.id.lastIndexOf('/')) : 'root';
      const colIdx = dirKeys.indexOf(dir);
      const rowInDir = rawNodes.filter(
        (other) => (other.id.includes('/') ? other.id.substring(0, other.id.lastIndexOf('/')) : 'root') === dir
      ).indexOf(n);

      return {
        id: n.id,
        type: 'fileNode',
        position: { x: colIdx * 280, y: rowInDir * 80 },
        data: { label: n.id.split('/').pop() || n.id, language: n.language },
      };
    });
  }, [rawNodes]);

  const initialEdges: Edge[] = useMemo(() =>
    rawEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: false,
      style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
    })),
    [rawEdges]
  );

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onFileClick(node.id);
  }, [onFileClick]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={20} />
        <Controls style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
      </ReactFlow>
    </div>
  );
}
