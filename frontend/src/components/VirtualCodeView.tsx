import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const VIRTUAL_THRESHOLD = 300;
const BUFFER_LINES = 50;

interface VirtualCodeViewProps {
  code: string;
  language: string;
  segments: { startLine: number; endLine: number }[];
  highlightLine: number | null;
  SEGMENT_COLORS: string[];
}

export default function VirtualCodeView({
  code, language, segments, highlightLine, SEGMENT_COLORS
}: VirtualCodeViewProps) {
  const lines = useMemo(() => code.split('\n'), [code]);
  const totalLines = lines.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const lineHeightRef = useRef(20.8); // approx line height
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(VIRTUAL_THRESHOLD, totalLines) });

  // Measure actual line height
  useEffect(() => {
    if (!containerRef.current) return;
    const lineEl = containerRef.current.querySelector('.react-syntax-highlighter-line-number');
    if (lineEl) {
      const parent = lineEl.parentElement;
      if (parent) {
        lineHeightRef.current = parent.getBoundingClientRect().height;
      }
    }
  }, [visibleRange.start]);

  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const viewHeight = containerRef.current.clientHeight;
    const lh = lineHeightRef.current;

    const startLine = Math.max(0, Math.floor(scrollTop / lh) - BUFFER_LINES);
    const endLine = Math.min(totalLines, Math.ceil((scrollTop + viewHeight) / lh) + BUFFER_LINES);

    setVisibleRange(prev => {
      if (prev.start !== startLine || prev.end !== endLine) {
        return { start: startLine, end: endLine };
      }
      return prev;
    });
  }, [totalLines]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || totalLines <= VIRTUAL_THRESHOLD) return;
    el.addEventListener('scroll', updateVisibleRange, { passive: true });
    return () => el.removeEventListener('scroll', updateVisibleRange);
  }, [updateVisibleRange, totalLines]);

  // Auto-scroll to highlighted line
  useEffect(() => {
    if (highlightLine && containerRef.current) {
      const top = (highlightLine - 1) * lineHeightRef.current;
      containerRef.current.scrollTo({ top: top - containerRef.current.clientHeight / 2, behavior: 'smooth' });
    }
  }, [highlightLine]);

  // If file is small enough, render normally
  if (totalLines <= VIRTUAL_THRESHOLD) {
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLines
        lineProps={(lineNum) => {
          const segIndex = segments.findIndex((s) => lineNum >= s.startLine && lineNum <= s.endLine);
          const color = segIndex >= 0 ? SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length] : undefined;
          return {
            style: {
              display: 'block',
              borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
              paddingLeft: color ? 8 : 11,
              background: lineNum === highlightLine ? '#6366f130' : color ? `${color}10` : 'transparent',
            },
            ref: (el: HTMLElement | null) => {
              if (el && lineNum === highlightLine) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
          } as React.HTMLAttributes<HTMLElement>;
        }}
        customStyle={{ margin: 0, padding: '16px 0', fontSize: 13, lineHeight: 1.6, background: '#1a1b26' }}
      >
        {code}
      </SyntaxHighlighter>
      </div>
    );
  }

  // Virtual rendering for large files
  const { start, end } = visibleRange;
  const visibleCode = lines.slice(start, end).join('\n');

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#1a1b26' }}
    >
      {/* Spacer above */}
      <div style={{ height: start * lineHeightRef.current }} />

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLines
        startingLineNumber={start + 1}
        lineProps={(lineNum) => {
          const realLine = start + lineNum;
          const segIndex = segments.findIndex((s) => realLine >= s.startLine && realLine <= s.endLine);
          const color = segIndex >= 0 ? SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length] : undefined;
          return {
            style: {
              display: 'block',
              borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
              paddingLeft: color ? 8 : 11,
              background: realLine === highlightLine ? '#6366f130' : color ? `${color}10` : 'transparent',
            },
          } as React.HTMLAttributes<HTMLElement>;
        }}
        customStyle={{ margin: 0, padding: '0 0', fontSize: 13, lineHeight: 1.6, background: 'transparent' }}
      >
        {visibleCode}
      </SyntaxHighlighter>

      {/* Spacer below */}
      <div style={{ height: Math.max(0, (totalLines - end) * lineHeightRef.current) }} />
    </div>
  );
}
