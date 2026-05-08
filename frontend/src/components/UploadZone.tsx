import { useRef, useState } from 'react';
import { uploadProjectWithProgress } from '../api';

interface Props {
  onUploaded: (projectId: number) => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file');
      return;
    }

    const maxMB = 500;
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File too large (${formatSize(file.size)}), max ${maxMB}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const project = await uploadProjectWithProgress(file, {
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      onUploaded(project.id);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setUploading(false);
    setProgress(0);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '48px 32px',
        textAlign: 'center',
        cursor: uploading ? 'default' : 'pointer',
        transition: 'border-color 0.2s',
        background: dragging ? 'var(--accent-bg)' : 'transparent',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <div>
          <div style={{ color: 'var(--accent)', marginBottom: 12, fontWeight: 500 }}>
            Uploading... {progress}%
          </div>
          <div style={{
            width: '100%',
            maxWidth: 320,
            height: 6,
            background: 'var(--border)',
            borderRadius: 3,
            margin: '0 auto 16px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              borderRadius: 3,
              transition: 'width 0.15s ease',
            }} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleCancel(); }}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '6px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div style={{ color: 'var(--text-h)', fontWeight: 500, marginBottom: 4 }}>
            Drop a .zip file here or click to upload
          </div>
          <div style={{ color: 'var(--text)', fontSize: 12 }}>
            Max 500MB
          </div>
        </>
      )}
      {error && <div style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>{error}</div>}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
