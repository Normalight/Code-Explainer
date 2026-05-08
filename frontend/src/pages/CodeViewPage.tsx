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
import type { SegmentInfo, QualityAssessment } from '../types';
import { useI18n } from '../i18n';

const SEGMENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

const AST_COLORS: Record<string, string> = {
  function: '#22c55e', method: '#22c55e',
  class: '#3b82f6', struct: '#3b82f6', interface: '#8b5cf6',
  variable: '#f59e0b',
};

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'c', 'cpp', 'h',
  'cs', 'kt', 'swift', 'php', 'scala', 'sh', 'bash', 'sql', 'lua', 'r',
  'dart', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs', 'ml', 'jl', 'vue', 'svelte',
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

interface AstNode {
  type: string;
  name: string;
  startLine: number;
  endLine: number;
  children: AstNode[];
}

type CodeTab = 'explain' | 'ast';

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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [codeTab, setCodeTab] = useState<CodeTab>('explain');
  const [astNodes, setAstNodes] = useState<AstNode[]>([]);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [splitRatio, setSplitRatio] = useState(() => Number(localStorage.getItem('split-ratio')) || 0.4);

  const codeRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef(0);
  const mdLeftRef = useRef<HTMLDivElement>(null);
  const mdRightRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);

  useEffect(() => { localStorage.setItem('split-ratio', String(splitRatio)); }, [splitRatio]);

  const isCode = isCodeFile(filePath);
  const isImage = isImageFile(filePath);

  // Load file content + AST
  useEffect(() => {
    if (!projectId || !filePath) return;
    setCode('');
    setSegments([]);
    setExplanations({});
    setQuality(null);
    setAnalyzing(false);
    activeSegmentRef.current = 0;
    getFileContent(projectId, filePath).then(setCode).catch(console.error);
    setLanguage(detectLanguage(filePath));
    if (isCode) {
      getAst(projectId, filePath).then(setAstNodes).catch(() => setAstNodes([]));
    }
  }, [projectId, filePath]);

  const startAnalysis = useCallback(() => {
    if (!projectId || !filePath || !code || !isCode || analyzing) return;
    setAnalyzing(true);
    const lang = localStorage.getItem('code-explainer-locale')?.startsWith('en') ? 'en' : 'zh';

    const es = new EventSource(getExplainUrl(projectId, filePath, lang));
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
          {isImage ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100%' }}>
              <img src={`/api/projects/${projectId}/files/${filePath}`} alt={filePath} style={{ maxWidth: '100%', borderRadius: 6 }} />
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: 'var(--bg)' }}>
      {/* Sub-header: tabs + analyze button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setCodeTab('explain')} style={{ background: codeTab === 'explain' ? 'var(--accent-bg)' : 'none', border: 'none', color: codeTab === 'explain' ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 11 }}>{t('explain')}</button>
        <button onClick={() => setCodeTab('ast')} style={{ background: codeTab === 'ast' ? 'var(--accent-bg)' : 'none', border: 'none', color: codeTab === 'ast' ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 11 }}>{t('ast')}</button>
        {codeTab === 'explain' && !analyzing && segments.length === 0 && code && (
          <button onClick={startAnalysis}
            style={{
              marginLeft: 8, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 4, padding: '3px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            {t('startAnalysis')}
          </button>
        )}
        {analyzing && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="spinner" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {t('analyzing')}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text)', opacity: 0.4 }}>{codeLines.length} lines</span>
      </div>

      {codeTab === 'explain' ? (
        <div ref={codeRef} style={{ flex: 1, overflow: 'auto' }}>
          {!analyzing && segments.length === 0 ? (
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
          ) : (
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
                        <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.5 }}>{t('analyzingSeg')}</div>
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
                      lineProps={(lineNum) => {
                        const realLine = row.startLine + lineNum - 1;
                        return {
                          style: {
                            display: 'block',
                            borderLeft: `3px solid ${color}`,
                            paddingLeft: 8,
                            background: realLine === highlightLine ? `${color}30` : undefined,
                          },
                        } as React.HTMLAttributes<HTMLElement>;
                      }}
                      customStyle={{ margin: 0, padding: '4px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26', minHeight: '100%' }}
                    >
                      {row.code}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            })
          )}
          {quality && <QualityCard quality={quality} />}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {astNodes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>{t('noAst')}</div>
          ) : (
            <AstTreeView nodes={astNodes} onNodeClick={(startLine, endLine) => {
              setHighlightLine(startLine);
              setCodeTab('explain');
              setTimeout(() => {
                const container = codeRef.current;
                if (!container) return;
                const lines = container.querySelectorAll('.react-syntax-highlighter-line-number');
                for (const line of lines) {
                  const lineEl = line.parentElement;
                  if (lineEl) {
                    const lineNum = parseInt(line.textContent || '0', 10);
                    if (lineNum === startLine) {
                      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      break;
                    }
                  }
                }
                setHighlightLine(null);
              }, 300);
            }} />
          )}
        </div>
      )}

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

const AST_TYPE_ICONS: Record<string, string> = {
  class: 'C', interface: 'I', struct: 'S', enum: 'E',
  function: 'ƒ', method: 'M', variable: 'V',
  trait: 'T', impl: '▶', type: 'T',
};

function AstTreeView({ nodes, onNodeClick }: { nodes: AstNode[]; onNodeClick: (startLine: number, endLine: number) => void }) {
  return (
    <div style={{ fontSize: 13 }}>
      {nodes.map((node, i) => (
        <AstTreeNode key={`${node.type}-${node.name}-${i}`} node={node} depth={0} onNodeClick={onNodeClick} />
      ))}
    </div>
  );
}

function AstTreeNode({ node, depth, onNodeClick }: { node: AstNode; depth: number; onNodeClick: (startLine: number, endLine: number) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const color = AST_COLORS[node.type] || '#8b8b8b';
  const icon = AST_TYPE_ICONS[node.type] || '?';

  return (
    <div>
      <div
        onClick={() => onNodeClick(node.startLine, node.endLine)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
          background: `${color}10`, borderLeft: `3px solid ${color}`,
          marginLeft: depth * 20, marginBottom: 2,
        }}
      >
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ cursor: 'pointer', color: 'var(--text)', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0, userSelect: 'none' }}>
            {expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: `${color}25`, color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ fontWeight: 500, color, flex: 1 }}>{node.name}</span>
        <span style={{ fontSize: 10, color: 'var(--text)', opacity: 0.5, flexShrink: 0 }}>
          L{node.startLine}{node.endLine > node.startLine ? `–${node.endLine}` : ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text)', textTransform: 'uppercase', opacity: 0.4 }}>{node.type}</span>
      </div>
      {hasChildren && expanded && (
        <div style={{ marginLeft: depth * 20 + 10, borderLeft: '1px solid var(--border)', paddingLeft: 0 }}>
          {node.children.map((child, i) => (
            <AstTreeNode key={`${child.type}-${child.name}-${i}`} node={child} depth={depth + 1} onNodeClick={onNodeClick} />
          ))}
        </div>
      )}
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
