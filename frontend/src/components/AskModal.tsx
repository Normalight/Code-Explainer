import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAskUrl } from '../api';
import { useI18n } from '../i18n';

interface Props {
  projectId: number;
  filePath: string;
  selectedCode: string;
  startLine: number;
  endLine: number;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AskModal({ projectId, filePath, selectedCode, startLine, endLine, onClose }: Props) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

  const handleAsk = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const url = getAskUrl(projectId, filePath, startLine, endLine, question);
      const eventSource = new EventSource(url);
      let answer = '';

      eventSource.addEventListener('content', (e) => {
        answer += e.data;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: answer };
          } else {
            updated.push({ role: 'assistant', content: answer });
          }
          return updated;
        });
      });

      eventSource.onerror = () => {
        eventSource.close();
        setLoading(false);
      };
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('failedResponse') }]);
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 640,
          maxHeight: '80vh',
          background: 'var(--code-bg)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>
            {t('askAI')} — {filePath} L{startLine}–{endLine}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text)',
              cursor: 'pointer', padding: 4, fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Selected code context */}
        <div style={{
          padding: '8px 16px',
          background: '#1a1b26',
          borderBottom: '1px solid var(--border)',
          maxHeight: 120,
          overflow: 'auto',
        }}>
          <pre style={{
            margin: 0, fontSize: 12, lineHeight: 1.5,
            fontFamily: 'ui-monospace, Consolas, monospace',
            color: 'var(--text)',
          }}>
            {selectedCode}
          </pre>
        </div>

        {/* Messages */}
        <div ref={messagesRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          minHeight: 200,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text)', padding: 40, fontSize: 13 }}>
              {t('askAnything')}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 12,
              textAlign: msg.role === 'user' ? 'right' : 'left',
            }}>
              <div style={{
                display: 'inline-block',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                background: msg.role === 'user' ? 'var(--accent-bg)' : 'var(--bg)',
                color: msg.role === 'user' ? 'var(--accent)' : 'var(--text)',
                border: msg.role === 'user' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                textAlign: 'left',
              }}>
                {msg.role === 'assistant' ? (
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                ) : msg.content}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ color: 'var(--text)', fontSize: 12, textAlign: 'center' }}>
              <div className="spinner" style={{
                width: 16, height: 16,
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 8px',
              }} />
              {t('thinking')}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
            placeholder={t('askProject')}
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 12px',
              color: 'var(--text-h)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !input.trim()}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            {t('send')}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
