import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FileTree from '../components/FileTree';
import UploadZone from '../components/UploadZone';
import { getFileTree, getProgress, getStructure, getDependencies } from '../api';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FileTreeNode, ProgressInfo } from '../types';

type Tab = 'overview' | 'graph' | 'chat';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function ProjectPage() {
  const { projectId: pid } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const projectId = pid ? Number(pid) : null;

  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [structure, setStructure] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>('overview');

  // Graph state
  const [graphData, setGraphData] = useState<{ nodes: { id: string; label: string; language: string }[]; edges: { source: string; target: string }[] } | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadProject = useCallback(async (id: number) => {
    getFileTree(id).then(setTree).catch(console.error);
    getStructure(id).then((s) => setStructure(s.analysis)).catch(console.error);
    getDependencies(id).then(setGraphData).catch(() => {});
  }, []);

  useEffect(() => {
    if (projectId) loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    if (!projectId) return;
    const poll = setInterval(() => {
      getProgress(projectId).then(setProgress).catch(() => {});
    }, 3000);
    getProgress(projectId).then(setProgress).catch(() => {});
    return () => clearInterval(poll);
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFileSelect = (path: string) => {
    setSelectedPath(path);
    if (projectId) navigate(`/projects/${projectId}/files/${encodeURIComponent(path)}`);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !projectId || chatLoading) return;

    const message = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setChatLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let answer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });

          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (line.includes('event:content') || data) {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.sessionId) {
                    setSessionId(parsed.sessionId);
                    continue;
                  }
                } catch {}
                answer += data;
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: answer };
                  } else {
                    updated.push({ role: 'assistant', content: answer });
                  }
                  return updated;
                });
              }
            }
          }
        }
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to get response.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 24, textAlign: 'center' }}>Code Explainer</h1>
        <UploadZone onUploaded={(id) => navigate(`/projects/${id}`)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar: File Tree */}
      <div style={{ width: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '12px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="var(--accent)">
            <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>Files</span>
        </div>
        {tree ? (
          <FileTree node={tree} projectId={projectId} onSelectFile={handleFileSelect} selectedPath={selectedPath} />
        ) : (
          <div style={{ padding: 16, color: 'var(--text)', fontSize: 13 }}>Loading...</div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
          <TabButton active={tab === 'graph'} onClick={() => setTab('graph')}>Dependencies</TabButton>
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>AI Chat</TabButton>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: tab === 'chat' ? 'hidden' : 'auto' }}>
          {tab === 'overview' ? (
            <div style={{ padding: '32px 40px' }}>
              {progress && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600 }}>Analysis Progress</h2>
                    <span style={{ color: 'var(--text)', fontSize: 13 }}>{progress.completed}/{progress.total} files</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : '0%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              {structure && (
                <div style={{ background: 'var(--code-bg)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-h)' }}>Project Structure Analysis</h2>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{structure}</div>
                </div>
              )}

              {!structure && !progress && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  <p style={{ marginTop: 16 }}>Select a file from the sidebar to view its analysis</p>
                </div>
              )}
            </div>
          ) : tab === 'graph' ? (
            <div style={{ padding: '32px 40px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Dependency Graph</h2>
              {graphData && graphData.nodes.length > 0 ? (
                <DependencyGraphView nodes={graphData.nodes} edges={graphData.edges} onFileClick={handleFileSelect} />
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
                  <p>No dependency data available</p>
                </div>
              )}
            </div>
          ) : (
            /* Chat tab */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {chatMessages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <p>Ask anything about this project</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.6,
                      background: msg.role === 'user' ? 'var(--accent-bg)' : 'var(--code-bg)',
                      color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                      border: msg.role === 'user' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                    }}>
                      {msg.role === 'assistant' ? (
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content || '...'}</Markdown>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                  <div style={{ color: 'var(--text)', fontSize: 12, textAlign: 'center', padding: 8 }}>
                    <div className="spinner" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                    Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Ask about this project..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, background: 'var(--code-bg)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '10px 14px', color: 'var(--text-h)', fontSize: 13, outline: 'none',
                  }}
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '10px 20px', cursor: chatLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500,
                    opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function DependencyGraphView({ nodes, edges, onFileClick }: {
  nodes: { id: string; label: string; language: string }[];
  edges: { source: string; target: string }[];
  onFileClick: (path: string) => void;
}) {
  // Simple force-directed-like layout using columns
  const columns = groupByDirectory(nodes);
  const colKeys = Object.keys(columns);

  return (
    <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 16 }}>
      {colKeys.map((col) => (
        <div key={col} style={{ minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', marginBottom: 8, padding: '0 4px' }}>
            {col}
          </div>
          {columns[col].map((node) => {
            const incoming = edges.filter((e) => e.target === node.id).length;
            const outgoing = edges.filter((e) => e.source === node.id).length;
            return (
              <div
                key={node.id}
                onClick={() => onFileClick(node.id)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  borderRadius: 6,
                  background: 'var(--code-bg)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ color: 'var(--text-h)', fontWeight: 500 }}>{node.id.split('/').pop()}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--text)' }}>
                  {incoming > 0 && <span>← {incoming}</span>}
                  {outgoing > 0 && <span>→ {outgoing}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function groupByDirectory(nodes: { id: string; label: string; language: string }[]): Record<string, typeof nodes> {
  const groups: Record<string, typeof nodes> = {};
  for (const node of nodes) {
    const dir = node.id.includes('/') ? node.id.substring(0, node.id.lastIndexOf('/')) : 'root';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(node);
  }
  return groups;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-h)' : 'var(--text)',
        padding: '12px 20px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
