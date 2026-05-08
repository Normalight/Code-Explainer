import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FileTree from '../components/FileTree';
import UploadZone from '../components/UploadZone';
import CodeViewPanel from './CodeViewPage';
import SettingsModal from '../components/SettingsModal';
import { getFileTree, getStructure, getDependencies, getExportUrl, importGitHub, getCommits, getCommitDiff, reviewCommit, getChatSessions, deleteChatSession, listProjects } from '../api';
import type { CommitInfo, SessionInfo } from '../api';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SearchModal from '../components/SearchModal';
import DependencyGraphFlow from '../components/DependencyGraphFlow';
import { useI18n } from '../i18n';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

type Tab = 'overview' | 'graph' | 'commits' | 'chat';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function ProjectPage() {
  const { projectId: pid } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const projectId = pid ? Number(pid) : null;
  const { t } = useI18n();

  const [showSettings, setShowSettings] = useState(false);
  const [tree, setTree] = useState<any>(null);
  const [structure, setStructure] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [focusPath, setFocusPath] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>('overview');

  const [graphData, setGraphData] = useState<{ nodes: { id: string; label: string; language: string }[]; edges: { source: string; target: string }[] } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState<string | null>(null);
  const [commitReview, setCommitReview] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let raf = 0;
    let targetWidth = startWidth;
    const onMove = (ev: MouseEvent) => {
      targetWidth = Math.max(160, Math.min(600, startWidth + ev.clientX - startX));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSidebarWidth(targetWidth));
    };
    const onUp = () => {
      cancelAnimationFrame(raf);
      setSidebarWidth(targetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const loadSessions = useCallback(async (id: number) => {
    getChatSessions(id).then(setSessions).catch(() => {});
  }, []);

  const loadProject = useCallback(async (id: number) => {
    getFileTree(id).then(setTree).catch(console.error);
    getStructure(id).then((s) => setStructure(s.analysis)).catch(console.error);
    getDependencies(id).then(setGraphData).catch(() => {});
    getCommits(id).then(setCommits).catch(() => {});
    loadSessions(id);
    setSidebarCollapsed(true);
  }, [loadSessions]);

  useEffect(() => {
    if (projectId) loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleFileSelect = (path: string) => {
    setSelectedPath(path);
    setFocusPath(undefined);
  };

  const handleLocateInTree = (path: string) => {
    setFocusPath(path);
  };

  const handleGitHubImport = async () => {
    if (!githubUrl.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const project = await importGitHub(githubUrl.trim());
      navigate(`/projects/${project.id}`);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSelectCommit = async (hash: string) => {
    setSelectedCommit(hash);
    setCommitReview(null);
    if (!projectId) return;
    try {
      const diff = await getCommitDiff(projectId, hash);
      setCommitDiff(diff);
    } catch {
      setCommitDiff(t('failedLoadDiff'));
    }
  };

  const handleReviewCommit = async () => {
    if (!projectId || !selectedCommit || reviewLoading) return;
    setReviewLoading(true);
    try {
      const review = await reviewCommit(projectId, selectedCommit);
      setCommitReview(review);
    } catch {
      setCommitReview(t('reviewFailed'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setChatMessages([]);
  };

  const handleSelectSession = async (sid: string) => {
    if (!projectId) return;
    setSessionId(sid);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/history?sessionId=${sid}`);
      if (res.ok) {
        const msgs: { role: string; content: string }[] = await res.json();
        setChatMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
      }
    } catch {}
  };

  const handleDeleteSession = async (sid: string) => {
    if (!projectId) return;
    try {
      await deleteChatSession(projectId, sid);
      if (sessionId === sid) handleNewSession();
      loadSessions(projectId);
    } catch {}
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
      setChatMessages((prev) => [...prev, { role: 'assistant', content: t('failedResponse') }]);
    } finally {
      setChatLoading(false);
      if (projectId) loadSessions(projectId);
    }
  };

  const [projects, setProjects] = useState<{ id: number; name: string; uploadTime: string }[]>([]);

  useEffect(() => {
    if (!projectId) {
      listProjects().then(setProjects).catch(() => {});
    }
  }, [projectId]);

  // Upload page (no project ID)
  if (!projectId) {
    return (
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, textAlign: 'center' }}>{t('appTitle')}</h1>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'var(--code-bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text)',
              display: 'flex', alignItems: 'center',
            }}
            title={t('settings')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
        <UploadZone onUploaded={(id) => navigate(`/projects/${id}`)} />
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text)', fontSize: 12 }}>{t('orImportGithub')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGitHubImport(); }}
              placeholder="https://github.com/user/repo"
              style={{
                flex: 1, background: 'var(--code-bg)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 14px', color: 'var(--text-h)', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleGitHubImport}
              disabled={importing || !githubUrl.trim()}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
                padding: '10px 20px', cursor: importing ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500,
                opacity: importing || !githubUrl.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
              }}
            >
              {importing ? t('importing') : t('importBtn')}
            </button>
          </div>
          {importError && <div style={{ color: '#ef4444', marginTop: 8, fontSize: 12 }}>{importError}</div>}
        </div>

        {projects.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-h)' }}>{t('recentProjects')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--code-bg)', border: '1px solid var(--border)',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="var(--accent)" style={{ flexShrink: 0 }}>
                    <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>
                      {new Date(p.uploadTime).toLocaleString()}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.4 }}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Unified top navigation bar
  const navBar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px', height: 40, flexShrink: 0,
      borderBottom: '1px solid var(--border)', background: 'var(--bg)',
    }}>
      {/* Sidebar toggle */}
      <button onClick={() => setSidebarCollapsed(c => !c)}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 4,
          cursor: 'pointer', color: 'var(--text)', padding: '3px 6px',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
        title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {sidebarCollapsed ? <path d="M3 12h18M3 6h18M3 18h18" /> : <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />}
        </svg>
      </button>

      {/* Back to projects */}
      <span onClick={() => navigate('/projects')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text)', opacity: 0.5, flexShrink: 0 }}
        title={t('backToProjects')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </span>

      {/* Separator when sidebar visible */}
      {!sidebarCollapsed && (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--accent)" style={{ flexShrink: 0 }}>
            <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tree?.name || 'Files'}
          </span>
        </>
      )}

      {/* Selected file path or tab area */}
      {selectedPath ? (
        <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedPath}
        </span>
      ) : (
        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>{t('overview')}</TabButton>
          <TabButton active={tab === 'graph'} onClick={() => setTab('graph')}>{t('dependencies')}</TabButton>
          <TabButton active={tab === 'commits'} onClick={() => setTab('commits')}>{t('commits')}</TabButton>
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>{t('aiChat')}</TabButton>
        </div>
      )}

      {/* Right side controls */}
      <span
        onClick={() => setShowSearch(true)}
        style={{
          marginLeft: 'auto', padding: '3px 8px', fontSize: 11, color: 'var(--text)',
          background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 4,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        {shortcutLabel}
      </span>
      <span
        onClick={() => setShowSettings(true)}
        style={{
          padding: '3px 8px', fontSize: 11, color: 'var(--text)',
          background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 4,
          cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
        title={t('settings')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {navBar}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div style={{
            width: sidebarWidth,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {/* Sidebar search (file tree filter) */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                placeholder={t('search')}
                style={{
                  width: '100%', background: 'var(--code-bg)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '4px 8px', color: 'var(--text-h)', fontSize: 12, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', padding: '4px 0' }}>
              {tree ? (
                <FileTree node={tree} onSelectFile={handleFileSelect} selectedPath={selectedPath} focusPath={focusPath} />
              ) : (
                <div style={{ padding: '8px 8px' }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 14, marginBottom: 8, width: `${60 + Math.random() * 40}%` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sidebar resize handle */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={handleResizeStart}
            style={{
              width: 3, cursor: 'col-resize', background: 'transparent',
              flexShrink: 0, zIndex: 10,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          />
        )}

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedPath ? (
            <CodeViewPanel projectId={projectId} filePath={selectedPath} onClose={() => setSelectedPath(undefined)} />
          ) : (
            <div style={{ flex: 1, overflow: tab === 'chat' ? 'hidden' : 'auto' }}>
              {tab === 'overview' ? (
                <div style={{ padding: '32px 40px' }}>
                  <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={getExportUrl(projectId)}
                      download
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                      {t('exportReport')}
                    </a>
                  </div>

                  {structure ? (
                    <StructureDisplay structure={structure} onLocateInTree={handleLocateInTree} t={t} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                      </svg>
                      <p style={{ marginTop: 16 }}>{t('selectFile')}</p>
                    </div>
                  )}
                </div>
              ) : tab === 'graph' ? (
                graphData && graphData.nodes.length > 0 ? (
                  <DependencyGraphFlow nodes={graphData.nodes} edges={graphData.edges} onFileClick={handleFileSelect} />
                ) : (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text)' }}>{t('noDepData')}</div>
                )
              ) : tab === 'commits' ? (
                <div style={{ height: '100%', overflow: 'auto' }}>
                  {commits.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>{t('noCommits')}</div>
                  ) : (
                    <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 24px' }}>
                      {commits.map((c, idx) => (
                        <div key={c.hash}>
                          {idx === 0 || new Date(commits[idx - 1].timestamp * 1000).toDateString() !== new Date(c.timestamp * 1000).toDateString() ? (
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              {new Date(c.timestamp * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </div>
                          ) : null}
                          <div
                            onClick={() => handleSelectCommit(c.hash)}
                            style={{
                              display: 'flex', gap: 12, padding: '10px 12px', marginBottom: 2, borderRadius: 6,
                              background: selectedCommit === c.hash ? 'var(--accent-bg)' : 'transparent',
                              cursor: 'pointer', border: '1px solid transparent',
                              borderColor: selectedCommit === c.hash ? 'var(--accent-border)' : 'transparent',
                              transition: 'background 0.1s, border-color 0.1s',
                            }}
                            onMouseEnter={(e) => { if (selectedCommit !== c.hash) e.currentTarget.style.background = 'var(--code-bg)'; }}
                            onMouseLeave={(e) => { if (selectedCommit !== c.hash) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              {c.author?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-h)', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.message}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>{c.author}</span>
                                <span style={{ opacity: 0.5 }}>{t('committed')} {timeAgo(c.timestamp, t)}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <code style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--code-bg)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--accent)' }}>
                                {c.shortHash}
                              </code>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSelectCommit(c.hash); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 2, opacity: 0.5, display: 'flex' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                              </button>
                            </div>
                          </div>

                          {selectedCommit === c.hash && commitDiff && (
                            <div style={{ margin: '0 12px 12px 56px', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--code-bg)' }}>
                                <code style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{c.hash.substring(0, 7)}</code>
                                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                                <button onClick={handleReviewCommit} disabled={reviewLoading}
                                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 4, padding: '3px 10px', cursor: reviewLoading ? 'wait' : 'pointer', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                                  {reviewLoading ? t('reviewing') : t('aiReview')}
                                </button>
                              </div>
                              {commitReview && (
                                <div style={{ padding: '10px 12px', background: 'var(--code-bg)', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                  <Markdown remarkPlugins={[remarkGfm]}>{commitReview}</Markdown>
                                </div>
                              )}
                              <pre style={{ padding: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflow: 'auto', margin: 0 }}>
                                {commitDiff}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', height: '100%' }}>
                  <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={handleNewSession}
                        style={{
                          width: '100%', background: 'var(--accent-bg)', color: 'var(--accent)',
                          border: '1px solid var(--accent-border)', borderRadius: 6,
                          padding: '7px 0', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        }}
                      >
                        {t('newChat')}
                      </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {sessions.map((s) => (
                        <div
                          key={s.sessionId}
                          onClick={() => handleSelectSession(s.sessionId)}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                            background: sessionId === s.sessionId ? 'var(--accent-bg)' : 'transparent',
                            borderLeft: sessionId === s.sessionId ? '3px solid var(--accent)' : '3px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-h)' }}>
                            {s.title}
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.sessionId); }}
                            style={{ color: 'var(--text)', opacity: 0.4, fontSize: 10, flexShrink: 0 }}
                            title={t('close')}
                          >
                            ✕
                          </span>
                        </div>
                      ))}
                      {sessions.length === 0 && (
                        <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text)', fontSize: 12 }}>{t('noConversations')}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                      {chatMessages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          <p>{t('askAnything')}</p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '75%', padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.6,
                            background: msg.role === 'user' ? 'var(--accent-bg)' : 'var(--code-bg)',
                            color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                            border: msg.role === 'user' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                          }}>
                            {msg.role === 'assistant' ? (
                              <ChatContent text={msg.content || '...'} />
                            ) : msg.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                        <div style={{ color: 'var(--text)', fontSize: 12, textAlign: 'center', padding: 8 }}>
                          <div className="spinner" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                          {t('thinking')}
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                        placeholder={t('askProject')}
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
                        {t('send')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {showSearch && projectId && (
        <SearchModal projectId={projectId} onClose={() => setShowSearch(false)} />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent-bg)' : 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        borderRadius: active ? '4px 4px 0 0' : 0,
        transition: 'color 0.15s, background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function StructureDisplay({ structure, onLocateInTree, t }: { structure: string; onLocateInTree: (path: string) => void; t: (key: any) => string }) {
  let data: any = null;
  try { data = JSON.parse(structure); } catch {}
  if (!data) {
    return (
      <div style={{ background: 'var(--code-bg)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-h)' }}>{t('projectStructure')}</h2>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{structure}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          {data.projectType || t('unknown')}
        </div>
        {data.architecture && (
          <div style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--code-bg)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
            {data.architecture}
          </div>
        )}
      </div>

      {data.summary && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', marginBottom: 16, background: 'var(--code-bg)', padding: 16, borderRadius: 8 }}>
          {data.summary}
        </p>
      )}

      {data.techStack?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('techStack')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.techStack.map((tech: string, i: number) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: 4, background: 'var(--code-bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-h)' }}>{tech}</span>
            ))}
          </div>
        </div>
      )}

      {data.entryPoints?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('entryPoints')}</div>
          {data.entryPoints.map((ep: string, i: number) => (
            <span key={i}
              onClick={() => onLocateInTree(ep)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 4, background: '#22c55e15', border: '1px solid #22c55e40', fontSize: 12, color: '#22c55e', cursor: 'pointer', marginRight: 6, marginBottom: 4 }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" /></svg>
              {ep}
            </span>
          ))}
        </div>
      )}

      {data.modules?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('modules')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.modules.map((mod: any, i: number) => (
              <div key={i}
                onClick={() => onLocateInTree(mod.path)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 6, background: 'var(--code-bg)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }}>
                  {mod.path.endsWith('/') || !mod.path.includes('.') ? (
                    <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 01.906.303l1.26 1.008A.5.5 0 009 3.5h4.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                  ) : (
                    <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
                  )}
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-h)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {(mod.path as string).split('/').filter(Boolean).map((seg: string, si: number, arr: string[]) => (
                      <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {si > 0 && <span style={{ color: 'var(--text)', opacity: 0.3, fontSize: 11 }}>/</span>}
                        <span style={{
                          color: si === arr.length - 1 ? 'var(--text-h)' : 'var(--text)',
                          opacity: si === arr.length - 1 ? 1 : 0.5,
                          fontSize: si === arr.length - 1 ? 13 : 11,
                        }}>{seg}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{mod.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(timestamp: number, t: (key: any) => string): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return t('justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function ChatContent({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ children, className, ...props }: any) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code style={{ background: 'var(--border)', padding: '1px 4px', borderRadius: 3, fontSize: 12 }} {...props}>
                {children}
              </code>
            );
          }
          return <code className={className} {...props}>{children}</code>;
        },
      }}
    >
      {text}
    </Markdown>
  );
}
