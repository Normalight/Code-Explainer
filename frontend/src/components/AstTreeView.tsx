import type { AstNode } from '../types';
import { useI18n } from '../i18n';
import { useState } from 'react';

interface Props {
  nodes: AstNode[];
  onNodeClick: (startLine: number) => void;
}

function AstTreeNode({ node, depth, onNodeClick }: { node: AstNode; depth: number; onNodeClick: (startLine: number) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        onClick={() => {
          if (hasChildren) setCollapsed((c) => !c);
          onNodeClick(node.startLine);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px 3px 8px',
          paddingLeft: 8 + depth * 16,
          cursor: 'pointer',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text-h)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--code-bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {hasChildren && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--text)"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.1s', opacity: 0.5 }}>
              <path d="M7 10l5 5 5-5z" />
            </svg>
          )}
        </span>
        <span style={{
          fontWeight: hasChildren ? 500 : 400,
          color: hasChildren ? 'var(--accent)' : 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {node.name || `(${node.type})`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.4, flexShrink: 0 }}>
          L{node.startLine}{node.endLine > node.startLine ? `-${node.endLine}` : ''}
        </span>
        <span style={{
          fontSize: 9, opacity: 0.5, flexShrink: 0, marginLeft: 4,
          background: 'var(--border)', padding: '1px 5px', borderRadius: 3,
        }}>
          {node.type}
        </span>
      </div>
      {hasChildren && !collapsed && node.children.map((child, i) => (
        <AstTreeNode key={`${child.name}-${child.startLine}-${i}`} node={child} depth={depth + 1} onNodeClick={onNodeClick} />
      ))}
    </div>
  );
}

export default function AstTreeView({ nodes, onNodeClick }: Props) {
  const { t } = useI18n();

  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: 'var(--text)', opacity: 0.6 }}>
        {t('noAst')}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {nodes.map((node, i) => (
        <AstTreeNode key={`${node.name}-${node.startLine}-${i}`} node={node} depth={0} onNodeClick={onNodeClick} />
      ))}
    </div>
  );
}
