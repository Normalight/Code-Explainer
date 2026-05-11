import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': { ...(oneDark as Record<string, Record<string, string>>)['pre[class*="language-"]'], background: '#1a1b26' },
  'code[class*="language-"]': { ...(oneDark as Record<string, Record<string, string>>)['code[class*="language-"]'], background: 'transparent' },
};
import { getFileContent, getExplainUrl, getQuality, getAst } from '../api';
import AskModal from '../components/AskModal';
import AstTreeView from '../components/AstTreeView';
import type { SegmentInfo, QualityAssessment, AstNode } from '../types';
import { useI18n } from '../i18n';

const SEGMENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'c', 'cpp', 'h',
  'cs', 'kt', 'swift', 'php', 'scala', 'sh', 'bash', 'sql', 'lua', 'r',
  'dart', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs', 'ml', 'jl', 'vue', 'svelte',
  'html', 'htm', 'json', 'css', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf',
  'properties', 'gradle', 'cmake', 'makefile', 'dockerfile',
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);

function isMarkdownFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.md') || filePath.toLowerCase().endsWith('.markdown');
}

function isCodeFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return CODE_EXTENSIONS.has(ext);
}

function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

interface Selection {
  text: string;
  startLine: number;
  endLine: number;
  rect: { top: number; left: number };
}

interface Props {
  projectId: number;
  filePath: string;
  onClose: () => void;
}

export default function CodeViewPanel({ projectId, filePath, onClose }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('');
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [quality, setQuality] = useState<QualityAssessment | null>(null);
  const [astNodes, setAstNodes] = useState<AstNode[] | null>(null);
  const [astTab, setAstTab] = useState(false);
  const [astLoading, setAstLoading] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [splitRatio, setSplitRatio] = useState(() => Number(localStorage.getItem('split-ratio')) || 0.4);
  const [loadError, setLoadError] = useState<string | null>(null);

  const codeRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mdLeftRef = useRef<HTMLDivElement>(null);
  const mdRightRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);

  useEffect(() => { localStorage.setItem('split-ratio', String(splitRatio)); }, [splitRatio]);

  const isCode = isCodeFile(filePath);
  const isImage = isImageFile(filePath);

  // Load file content + AST
  useEffect(() => {
    if (!projectId || !filePath) return;
    // Close any existing analysis EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setCode('');
    setSegments([]);
    setExplanations({});
    setQuality(null);
    setAstNodes(null);
    setAstTab(false);
    setAstLoading(false);
    setAnalyzing(false);
    setLoadError(null);
    activeSegmentRef.current = 0;
    getFileContent(projectId, filePath).then(c => { setCode(c); }).catch(e => setLoadError(e.message));
    setLanguage(detectLanguage(filePath));
  }, [projectId, filePath]);

  const loadAst = useCallback(() => {
    if (!projectId || !filePath || astLoading || astNodes !== null) return;
    setAstLoading(true);
    setAstTab(true);
    getAst(projectId, filePath)
      .then((nodes) => setAstNodes(nodes))
      .catch(() => setAstNodes([]))
      .finally(() => setAstLoading(false));
  }, [projectId, filePath, astLoading, astNodes]);

  const handleAstNodeClick = useCallback((startLine: number) => {
    const codeContainer = codeRef.current?.querySelector('code');
    if (!codeContainer) return;
    const lines = codeContainer.querySelectorAll('.react-syntax-highlighter-line-number');
    if (lines.length > 0 && startLine <= lines.length) {
      const targetLine = lines[startLine - 1];
      if (targetLine) {
        targetLine.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  const startAnalysis = useCallback(() => {
    if (!projectId || !filePath || !code || !isCode || analyzing) return;
    setAnalyzing(true);
    const lang = localStorage.getItem('code-explainer-locale')?.startsWith('en') ? 'en' : 'zh';

    const es = new EventSource(getExplainUrl(projectId, filePath, lang));
    eventSourceRef.current = es;
    es.addEventListener('segment_start', (e) => {
      setSegments((prev) => [...prev, JSON.parse(e.data)]);
    });
    es.addEventListener('content', (e) => {
      const segIdx = activeSegmentRef.current;
      setExplanations((prev) => ({
        ...prev,
        [segIdx]: (prev[segIdx] || '') + e.data,
      }));
    });
    es.addEventListener('segment_end', () => {
      activeSegmentRef.current += 1;
    });
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setAnalyzing(false);
      getQuality(projectId, filePath, lang)
        .then((text) => { try { setQuality(JSON.parse(text)); } catch {} })
        .catch(() => {});
    };
  }, [projectId, filePath, code, isCode, analyzing]);

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !codeRef.current) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!codeRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) { setSelection(null); return; }

    const codeContainer = codeRef.current.querySelector('code');
    if (!codeContainer) { setSelection(null); return; }
    const lines = codeContainer.querySelectorAll('.react-syntax-highlighter-line-number');
    let startLine = 1, endLine = 1;
    for (let i = 0; i < lines.length; i++) {
      const lineEl = lines[i].parentElement;
      if (lineEl && range.intersectsNode(lineEl)) {
        if (startLine === 1) startLine = i + 1;
        endLine = i + 1;
      }
    }
    const rect = range.getBoundingClientRect();
    setSelection({ text, startLine, endLine, rect: { top: rect.top - 8, left: rect.left + rect.width / 2 } });
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection]);

  // Sync scroll for markdown preview/source
  useEffect(() => {
    const left = mdLeftRef.current;
    const right = mdRightRef.current;
    if (!left || !right) return;

    const syncScroll = (source: 'left' | 'right') => (e: Event) => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      const el = e.currentTarget as HTMLDivElement;
      const target = source === 'left' ? right : left;
      const ratio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
      target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
      requestAnimationFrame(() => { syncingScroll.current = false; });
    };

    left.addEventListener('scroll', syncScroll('left'), { passive: true });
    right.addEventListener('scroll', syncScroll('right'), { passive: true });
    return () => {
      left.removeEventListener('scroll', syncScroll('left'));
      right.removeEventListener('scroll', syncScroll('right'));
    };
  }, [isMarkdownFile(filePath), code]);

  // Draggable split ratio between explanation and code
  const handleSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const row = (e.currentTarget as HTMLElement).parentElement;
    if (!row) return;
    const startX = e.clientX;
    const startRatio = splitRatio;
    const containerWidth = row.getBoundingClientRect().width;
    let raf = 0;
    let targetRatio = startRatio;
    const onMove = (ev: MouseEvent) => {
      targetRatio = Math.max(0.15, Math.min(0.7, startRatio + (ev.clientX - startX) / containerWidth));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSplitRatio(targetRatio));
    };
    const onUp = () => {
      cancelAnimationFrame(raf);
      setSplitRatio(targetRatio);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitRatio]);

  // Non-code file rendering
  if (!isCode) {
    const isMd = isMarkdownFile(filePath);

    if (isMd && code) {
      return (
        <div style={{ display: 'flex', flex: 1, height: '100%', background: 'var(--bg)' }}>
          <div ref={mdLeftRef} style={{ width: '50%', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px' }}>
              <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
                <Markdown remarkPlugins={[remarkGfm]}>{code}</Markdown>
              </div>
            </div>
          </div>
          <div ref={mdRightRef} style={{ flex: 1, overflowY: 'auto' }}>
            <SyntaxHighlighter language="markdown" style={codeTheme} showLineNumbers
              customStyle={{ margin: 0, padding: '16px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26' }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flex: 1, height: '100%', background: 'var(--bg)' }}>
        <div ref={codeRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {loadError ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
              {loadError}
            </div>
          ) : isImage ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100%' }}>
              <img src={`/api/projects/${projectId}/files/${filePath.split('/').map(encodeURIComponent).join('/')}`} alt={filePath} style={{ maxWidth: '100%', borderRadius: 6 }} />
            </div>
          ) : code ? (
            <pre style={{ margin: 0, padding: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono, monospace)' }}>
              {code}
            </pre>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              {t('analyzing')}
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // Build segment rows
  const codeLines = useMemo(() => code.split('\n'), [code]);

  const segmentRows = useMemo(() => {
    if (segments.length === 0) return [];
    const rows: { type: 'gap' | 'segment'; startLine: number; endLine: number; segIndex?: number; code: string }[] = [];

    let prevEnd = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startLine - 1 > prevEnd) {
        const gapCode = codeLines.slice(prevEnd, seg.startLine - 1).join('\n');
        rows.push({ type: 'gap', startLine: prevEnd + 1, endLine: seg.startLine - 1, code: gapCode });
      }
      const segCode = codeLines.slice(seg.startLine - 1, seg.endLine).join('\n');
      rows.push({ type: 'segment', startLine: seg.startLine, endLine: seg.endLine, segIndex: i, code: segCode });
      prevEnd = seg.endLine;
    }
    if (prevEnd < codeLines.length) {
      const gapCode = codeLines.slice(prevEnd).join('\n');
      rows.push({ type: 'gap', startLine: prevEnd + 1, endLine: codeLines.length, code: gapCode });
    }
    return rows;
  }, [segments, codeLines]);

  const leftWidth = `${splitRatio * 100}%`;

  // Code file: single scroll, per-segment rows
  const showSplit = analyzing || segments.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: 'var(--bg)' }}>
      {/* Sub-header: tabs + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Tab: Explain */}
        <button onClick={() => { if (!astTab) startAnalysis(); else setAstTab(false); }}
          style={{
            background: !astTab ? 'var(--accent-bg)' : 'none', border: 'none',
            borderBottom: !astTab ? '2px solid var(--accent)' : '2px solid transparent',
            color: !astTab ? 'var(--accent)' : 'var(--text)', padding: '4px 10px',
            cursor: 'pointer', fontSize: 11, fontWeight: !astTab ? 600 : 400,
          }}>
          {t('explain')}
        </button>
        {/* Tab: AST */}
        <button onClick={loadAst}
          style={{
            background: astTab ? 'var(--accent-bg)' : 'none', border: 'none',
            borderBottom: astTab ? '2px solid var(--accent)' : '2px solid transparent',
            color: astTab ? 'var(--accent)' : 'var(--text)', padding: '4px 10px',
            cursor: 'pointer', fontSize: 11, fontWeight: astTab ? 600 : 400,
          }}>
          {t('ast')}
        </button>
        {astLoading && (
          <span style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="spinner" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {t('analyzing')}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text)', opacity: 0.4 }}>{codeLines.length} lines</span>
        <button onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer',
            padding: '2px 4px', fontSize: 14, opacity: 0.5, display: 'flex',
          }}
          title={t('close')}
        >
          ✕
        </button>
      </div>

      <div ref={codeRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: astTab ? 'row' : 'column' }}>
        {astTab ? (
          // AST view: tree on left, code on right
          <>
            <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'auto', background: 'var(--bg)' }}>
              <AstTreeView nodes={astNodes || []} onNodeClick={handleAstNodeClick} />
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
              {code ? (
                <SyntaxHighlighter
                  language={language} style={codeTheme} showLineNumbers
                  customStyle={{ margin: 0, padding: '8px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26', minHeight: '100%' }}
                >
                  {code}
                </SyntaxHighlighter>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>
                  <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  {t('analyzing')}
                </div>
              )}
            </div>
          </>
        ) : loadError ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
            {loadError}
          </div>
        ) : !showSplit ? (
          // No analysis yet — show code only (full width)
          code ? (
            <SyntaxHighlighter
              language={language} style={codeTheme} showLineNumbers
              customStyle={{ margin: 0, padding: '8px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26' }}
            >
              {code}
            </SyntaxHighlighter>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              {t('analyzing')}
            </div>
          )
        ) : segmentRows.length > 0 ? (
          // Segments available — show per-segment split layout
          segmentRows.map((row, ri) => {
            if (row.type === 'gap') {
              return (
                <div key={`gap-${ri}`} style={{ display: 'flex', minWidth: 0 }}>
                  <div style={{ width: leftWidth, flexShrink: 0 }} />
                  <div style={{ width: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
                    <SyntaxHighlighter
                      language={language} style={codeTheme} showLineNumbers
                      startingLineNumber={row.startLine}
                      customStyle={{ margin: 0, padding: '4px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26', minWidth: 0 }}
                    >
                      {row.code}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            }

            const i = row.segIndex!;
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const explanation = explanations[i];
            return (
              <div key={`seg-${ri}`} style={{ display: 'flex', minWidth: 0, borderBottom: `1px solid ${color}20` }}>
                {/* Left: explanation card */}
                <div style={{ width: leftWidth, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                  <div style={{ borderLeft: `3px solid ${color}`, borderRadius: 6, padding: '10px 14px', background: `${color}10`, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color }}>{segments[i].title}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>L{segments[i].startLine}–{segments[i].endLine}</span>
                    </div>
                    {explanation ? (
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                        <Markdown remarkPlugins={[remarkGfm]}>{explanation}</Markdown>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.5 }}>
                        <div className="spinner" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                        {t('analyzingSeg')}
                      </div>
                    )}
                  </div>
                </div>
                {/* Draggable divider */}
                <div
                  onMouseDown={handleSplitResize}
                  style={{
                    width: 3, flexShrink: 0, cursor: 'col-resize',
                    background: '#1a1b26', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                />
                {/* Right: code lines */}
                <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
                  <SyntaxHighlighter
                    language={language} style={codeTheme} showLineNumbers wrapLines
                    startingLineNumber={row.startLine}
                    lineProps={() => ({
                      style: {
                        display: 'block',
                        borderLeft: `3px solid ${color}`,
                        paddingLeft: 8,
                      },
                    } as React.HTMLAttributes<HTMLElement>)}
                    customStyle={{ margin: 0, padding: '4px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26', minHeight: '100%' }}
                  >
                    {row.code}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          })
        ) : (
          // Analyzing but no segments yet — show split with loading placeholder
          <div style={{ display: 'flex', minHeight: '100%' }}>
            <div style={{ width: leftWidth, flexShrink: 0, padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text)', opacity: 0.5, fontSize: 12 }}>
                <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                {t('analyzing')}
              </div>
            </div>
            <div style={{ width: 3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
              <SyntaxHighlighter
                language={language} style={codeTheme} showLineNumbers
                customStyle={{ margin: 0, padding: '8px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26' }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
        {quality && <QualityCard quality={quality} />}
      </div>

      {selection && (
        <div style={{ position: 'fixed', top: selection.rect.top - 40, left: selection.rect.left - 60, background: '#21262d', border: '1px solid var(--border)', borderRadius: 6, padding: '4px', display: 'flex', gap: 2, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <button onClick={() => { setShowAskModal(true); setSelection(null); }} title={t('askAI')}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '6px 8px', borderRadius: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
          </button>
          <button onClick={() => { navigator.clipboard.writeText(selection.text); setSelection(null); }} title={t('copy')}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '6px 8px', borderRadius: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          </button>
        </div>
      )}

      {showAskModal && selection && (
        <AskModal projectId={projectId} filePath={filePath} selectedCode={selection.text} startLine={selection.startLine} endLine={selection.endLine} onClose={() => setShowAskModal(false)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function QualityCard({ quality }: { quality: QualityAssessment }) {
  const { t } = useI18n();
  const GRADE_STYLES: Record<string, { bg: string; color: string }> = {
    A: { bg: '#22c55e20', color: '#22c55e' }, B: { bg: '#3b82f620', color: '#3b82f6' },
    C: { bg: '#f59e0b20', color: '#f59e0b' }, D: { bg: '#ef444420', color: '#ef4444' },
  };
  const style = GRADE_STYLES[quality.grade] || GRADE_STYLES.C;
  return (
    <div style={{ marginTop: 20, padding: 14, borderRadius: 8, background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, fontSize: 16, fontWeight: 700, background: style.bg, color: style.color }}>{quality.grade}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t('qualityAssessment')}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{quality.summary}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {Object.entries(quality.scores).map(([key, val]) => (
          <div key={key} style={{ fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', marginBottom: 2 }}><span style={{ textTransform: 'capitalize' }}>{key}</span><span>{val}/5</span></div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} /></div>
          </div>
        ))}
      </div>
      {quality.issues?.length > 0 && quality.issues.map((issue, i) => (
        <div key={i} style={{ fontSize: 11, padding: '4px 6px', marginBottom: 3, borderRadius: 4, background: issue.severity === 'critical' ? '#ef444415' : issue.severity === 'warning' ? '#f59e0b15' : '#3b82f615', borderLeft: `3px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6'}` }}>
          <span style={{ fontWeight: 500 }}>{issue.title}</span> <span style={{ opacity: 0.6 }}>L{issue.lineStart}–{issue.lineEnd}</span>
          <div style={{ opacity: 0.7, marginTop: 2 }}>{issue.description}</div>
        </div>
      ))}
    </div>
  );
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    css: 'css', html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sql: 'sql', sh: 'bash', xml: 'xml',
  };
  return map[ext] || 'text';
}
