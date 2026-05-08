import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCode } from '../api';

interface Props {
  projectId: number;
  onClose: () => void;
}

interface SearchResult {
  path: string;
  line: number;
  text: string;
}

export default function SearchModal({ projectId, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      searchCode(projectId, query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleResultClick = (path: string, _line: number) => {
    navigate(`/projects/${projectId}/files/${encodeURIComponent(path)}`);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, maxHeight: '70vh', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code..."
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-h)', fontSize: 14, outline: 'none' }}
          />
          {loading && (
            <div className="spinner" style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {query.trim() && results.length === 0 && !loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text)', fontSize: 13 }}>No results</div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.path}-${r.line}-${i}`}
              onClick={() => handleResultClick(r.path, r.line)}
              style={{
                padding: '8px 16px', cursor: 'pointer', fontSize: 12,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{r.path}</span>
                <span style={{ color: 'var(--text)', fontSize: 11 }}>L{r.line}</span>
              </div>
              <div style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{results.length > 0 ? `${results.length} results` : 'Type to search'}</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
