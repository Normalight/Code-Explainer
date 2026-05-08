import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getFileContent, getExplainUrl, getQuality } from '../api';
import type { SegmentInfo, QualityAssessment } from '../types';

const SEGMENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

export default function CodeViewPage() {
  const { projectId: pid, '*': filePath } = useParams<{ projectId: string; '*': string }>();
  const projectId = Number(pid);
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('');
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [quality, setQuality] = useState<QualityAssessment | null>(null);

  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId || !filePath) return;

    getFileContent(projectId, filePath)
      .then(setCode)
      .catch(console.error);

    const lang = detectLanguage(filePath);
    setLanguage(lang);
  }, [projectId, filePath]);

  useEffect(() => {
    if (!projectId || !filePath || !code) return;

    const eventSource = new EventSource(getExplainUrl(projectId, filePath));

    eventSource.addEventListener('segment_start', (e) => {
      const seg: SegmentInfo = JSON.parse(e.data);
      setSegments((prev) => [...prev, seg]);
    });

    eventSource.addEventListener('content', (e) => {
      setExplanations((prev) => {
        const idx = Object.keys(prev).length;
        return { ...prev, [idx]: (prev[idx] || '') + e.data };
      });
    });

    eventSource.addEventListener('segment_end', () => {});

    eventSource.onerror = () => {
      eventSource.close();
      getQuality(projectId, filePath!)
        .then((text) => {
          try {
            const parsed = JSON.parse(text);
            setQuality(parsed);
          } catch {}
        })
        .catch(() => {});
    };

    return () => eventSource.close();
  }, [projectId, filePath, code]);

  const handleBack = () => {
    navigate(`/projects/${projectId}`);
  };

  if (!filePath) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Left: Explanations */}
      <div style={{
        width: '40%',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        padding: '16px 20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
              padding: 4,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>{filePath}</span>
        </div>

        {segments.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>
            <div className="spinner" style={{
              width: 24, height: 24,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            Analyzing...
          </div>
        )}

        {segments.map((seg, i) => {
          const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
          const explanation = explanations[i];
          return (
            <div
              key={i}
              style={{
                borderLeft: `3px solid ${color}`,
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 12,
                background: `${color}10`,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color }}>{seg.title}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>
                  L{seg.startLine}–{seg.endLine}
                </span>
              </div>
              {explanation ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                  <Markdown remarkPlugins={[remarkGfm]}>{explanation}</Markdown>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.5 }}>
                  Analyzing...
                </div>
              )}
            </div>
          );
        })}

        {quality && <QualityCard quality={quality} />}
      </div>

      {/* Right: Code */}
      <div ref={codeRef} style={{ flex: 1, overflow: 'auto' }}>
        {code && (
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            showLineNumbers
            wrapLines
            lineProps={(lineNum) => {
              const segIndex = segments.findIndex(
                (s) => lineNum >= s.startLine && lineNum <= s.endLine
              );
              const color = segIndex >= 0 ? SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length] : undefined;
              return {
                style: {
                  display: 'block',
                  borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
                  paddingLeft: color ? 8 : 11,
                  background: color ? `${color}10` : 'transparent',
                },
              } as React.HTMLAttributes<HTMLElement>;
            }}
            customStyle={{
              margin: 0,
              padding: '16px 0',
              fontSize: 13,
              lineHeight: 1.6,
              background: '#1a1b26',
              minHeight: '100%',
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function QualityCard({ quality }: { quality: QualityAssessment }) {
  const GRADE_STYLES: Record<string, { bg: string; color: string }> = {
    A: { bg: '#22c55e20', color: '#22c55e' },
    B: { bg: '#3b82f620', color: '#3b82f6' },
    C: { bg: '#f59e0b20', color: '#f59e0b' },
    D: { bg: '#ef444420', color: '#ef4444' },
  };
  const style = GRADE_STYLES[quality.grade] || GRADE_STYLES.C;

  return (
    <div style={{
      marginTop: 24,
      padding: 16,
      borderRadius: 8,
      background: 'var(--code-bg)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          fontSize: 18,
          fontWeight: 700,
          background: style.bg,
          color: style.color,
        }}>
          {quality.grade}
        </span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>Quality Assessment</div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{quality.summary}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {Object.entries(quality.scores).map(([key, val]) => (
          <div key={key} style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', marginBottom: 2 }}>
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
              <span>{val}/5</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {quality.issues?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', marginBottom: 8 }}>Issues</div>
          {quality.issues.map((issue, i) => (
            <div key={i} style={{
              fontSize: 12,
              padding: '6px 8px',
              marginBottom: 4,
              borderRadius: 4,
              background: issue.severity === 'critical' ? '#ef444415' : issue.severity === 'warning' ? '#f59e0b15' : '#3b82f615',
              borderLeft: `3px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
            }}>
              <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>
                {issue.title}
              </span>
              <span style={{ color: 'var(--text)', marginLeft: 8 }}>
                L{issue.lineStart}–{issue.lineEnd}
              </span>
              <div style={{ color: 'var(--text)', marginTop: 2 }}>{issue.description}</div>
            </div>
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
