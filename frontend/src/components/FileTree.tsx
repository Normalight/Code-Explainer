import type { FileTreeNode } from '../types';

interface Props {
  node: FileTreeNode;
  projectId: number;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}

export default function FileTree({ node, projectId, onSelectFile, selectedPath, depth = 0 }: Props) {
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      {node.children ? (
        <>
          <div className="tree-dir" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
              <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 01.906.303l1.26 1.008A.5.5 0 009 3.5h4.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
            </svg>
            <span style={{ fontWeight: 500 }}>{node.name}</span>
          </div>
          {node.children.map((child, i) => (
            <FileTree
              key={`${child.name}-${i}`}
              node={child}
              projectId={projectId}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          ))}
        </>
      ) : (
        <div
          className="tree-file"
          onClick={() => onSelectFile(node.name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 6px',
            borderRadius: 4,
            cursor: 'pointer',
            background: selectedPath === node.name ? 'var(--accent-bg)' : 'transparent',
            color: selectedPath === node.name ? 'var(--accent)' : 'var(--text)',
          }}
        >
          <FileIcon language={node.language} />
          <span style={{ fontSize: 13 }}>{node.name}</span>
          {node.lineCount != null && (
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>{node.lineCount}L</span>
          )}
        </div>
      )}
    </div>
  );
}

function FileIcon({ language }: { language?: string }) {
  const color = LANG_COLORS[language || ''] || '#8b8b8b';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
      <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
    </svg>
  );
}

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  Java: '#b07219',
  TypeScript: '#2b7489',
  JavaScript: '#f1e05a',
  Go: '#00ADD8',
  Rust: '#dea584',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Shell: '#89e051',
  SQL: '#e38c00',
};
