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
        padding: '10px 16px',
        borderRadius: 8,
        background: 'var(--code-bg)',
        border: `1.5px solid ${color}60`,
        fontSize: 13,
        minWidth: 140,
        cursor: 'pointer',
        boxShadow: `0 2px 8px ${color}15`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 7, height: 7, opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <span style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      {lang && <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 3, opacity: 0.6 }}>{lang}</div>}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 7, height: 7, opacity: 0 }} />
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
  // Only show nodes that are connected by edges
  const { filteredNodes, filteredEdges } = useMemo(() => {
    const connectedIds = new Set<string>();
    rawEdges.forEach(e => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });
    const filteredNodes = rawNodes.filter(n => connectedIds.has(n.id));
    // Deduplicate edges
    const seen = new Set<string>();
    const filteredEdges = rawEdges.filter(e => {
      const key = `${e.source}->${e.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { filteredNodes, filteredEdges };
  }, [rawNodes, rawEdges]);

  const initialNodes: Node[] = useMemo(() => {
    if (filteredNodes.length === 0) return [];

    const dirs = new Map<string, number>();
    filteredNodes.forEach((n) => {
      const dir = n.id.includes('/') ? n.id.substring(0, n.id.lastIndexOf('/')) : 'root';
      dirs.set(dir, (dirs.get(dir) || 0) + 1);
    });

    const dirKeys = [...dirs.keys()];
    return filteredNodes.map((n) => {
      const dir = n.id.includes('/') ? n.id.substring(0, n.id.lastIndexOf('/')) : 'root';
      const colIdx = dirKeys.indexOf(dir);
      const rowInDir = filteredNodes.filter(
        (other) => (other.id.includes('/') ? other.id.substring(0, other.id.lastIndexOf('/')) : 'root') === dir
      ).indexOf(n);

      return {
        id: n.id,
        type: 'fileNode',
        position: { x: colIdx * 320, y: rowInDir * 90 },
        data: { label: n.id.split('/').pop() || n.id, language: n.language },
      };
    });
  }, [filteredNodes]);

  const initialEdges: Edge[] = useMemo(() =>
    filteredEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: false,
      type: 'smoothstep',
      style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
    })),
    [filteredEdges]
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
        fitViewOptions={{ minZoom: 0.3, maxZoom: 1.5, padding: 0.15 }}
        connectOnClick={false}
        connectionLineStyle={{ stroke: 'transparent' }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={true}
        panOnDrag={true}
      >
        <Background color="var(--border)" gap={20} />
        <Controls style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
      </ReactFlow>
    </div>
  );
}
