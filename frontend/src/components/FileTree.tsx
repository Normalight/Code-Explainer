import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileTreeNode } from '../types';

interface Props {
  node: FileTreeNode;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  focusPath?: string;
}

export default function FileTree({ node, onSelectFile, selectedPath, focusPath }: Props) {
  return (
    <div>
      {node.children?.map((child, i) => (
        <TreeNode
          key={`${child.name}-${i}`}
          node={child}
          parentPath={''}
          depth={0}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
          focusPath={focusPath}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  parentPath: string;
  depth: number;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  focusPath?: string;
}

function TreeNode({ node, parentPath, depth, onSelectFile, selectedPath, focusPath }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  const isFile = node.type === 'file';
  const isSelected = selectedPath === fullPath;

  // Auto-expand if this node is an ancestor of focusPath
  const isAncestorOfFocus = !!(focusPath && focusPath !== fullPath && focusPath.startsWith(fullPath + '/'));
  const isFocusTarget = focusPath === fullPath;

  useEffect(() => {
    if (isAncestorOfFocus && collapsed) {
      setCollapsed(false);
    }
  }, [focusPath, isAncestorOfFocus, collapsed]);

  // Scroll to focused element
  useEffect(() => {
    if (isFocusTarget && elRef.current) {
      elRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isFocusTarget]);

  const handleClick = useCallback(() => {
    if (isFile) {
      onSelectFile(fullPath);
    } else {
      setCollapsed(c => !c);
    }
  }, [isFile, fullPath, onSelectFile]);

  const showAsFocused = isSelected || isFocusTarget;

  return (
    <div style={{ contain: 'layout style' }}>
      <div
        ref={elRef}
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 24,
          paddingLeft: depth * 16,
          paddingRight: 4,
          cursor: 'pointer',
          background: showAsFocused ? 'var(--accent-bg)' : isFocusTarget ? '#22c55e10' : 'transparent',
          borderLeft: showAsFocused ? '2px solid var(--accent)' : isFocusTarget ? '2px solid #22c55e' : '2px solid transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          userSelect: 'none',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!showAsFocused && !isFocusTarget) e.currentTarget.style.background = 'var(--code-bg)';
        }}
        onMouseLeave={(e) => {
          if (!showAsFocused && !isFocusTarget) e.currentTarget.style.background = 'transparent';
        }}
        title={fullPath}
      >
        {/* Expand/collapse arrow */}
        <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {!isFile && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text)"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.1s', opacity: 0.6 }}>
              <path d="M7 10l5 5 5-5z" />
            </svg>
          )}
        </span>

        {/* Icon */}
        {isFile ? (
          <FileIcon language={node.language} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--accent)" style={{ flexShrink: 0, opacity: 0.8 }}>
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 01.906.303l1.26 1.008A.5.5 0 009 3.5h4.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
          </svg>
        )}

        {/* Name */}
        <span style={{
          fontSize: 13,
          color: showAsFocused ? 'var(--accent)' : 'var(--text)',
          fontWeight: showAsFocused ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 0,
          maxWidth: 'calc(100% - 60px)',
        }}>
          {node.name}
        </span>

        {/* Line count badge */}
        {isFile && node.lineCount != null && (
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.4, flexShrink: 0 }}>{node.lineCount}L</span>
        )}

        {/* Analysis status dot for analyzable files */}
        {isFile && node.analyzable && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: node.analysisStatus === 'DONE' ? '#22c55e' :
                        node.analysisStatus === 'ANALYZING' ? '#eab308' : 'var(--border)',
          }} />
        )}
      </div>

      {/* Children (only if directory and not collapsed) */}
      {!isFile && !collapsed && node.children?.map((child, i) => (
        <TreeNode
          key={`${child.name}-${i}`}
          node={child}
          parentPath={fullPath}
          depth={depth + 1}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
          focusPath={focusPath}
        />
      ))}
    </div>
  );
}

function FileIcon({ language }: { language?: string }) {
  const color = LANG_COLORS[language || ''] || '#8b8b8b';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
      <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
    </svg>
  );
}

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5', Java: '#b07219', TypeScript: '#2b7489',
  JavaScript: '#f1e05a', Go: '#00ADD8', Rust: '#dea584',
  CSS: '#563d7c', HTML: '#e34c26', Shell: '#89e051', SQL: '#e38c00',
  Kotlin: '#A97BFF', Swift: '#F05138', Ruby: '#CC342D', PHP: '#4F5D95',
  C: '#555555', 'C++': '#f34b7d',
};
