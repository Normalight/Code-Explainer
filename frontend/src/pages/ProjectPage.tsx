import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FileTree from '../components/FileTree';
import UploadZone from '../components/UploadZone';
import { getFileTree, getProgress, getStructure } from '../api';
import type { FileTreeNode, ProgressInfo } from '../types';

export default function ProjectPage() {
  const { projectId: pid } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const projectId = pid ? Number(pid) : null;

  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [structure, setStructure] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();

  const loadProject = useCallback(async (id: number) => {
    getFileTree(id).then(setTree).catch(console.error);
    getStructure(id).then((s) => setStructure(s.analysis)).catch(console.error);
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

  const handleFileSelect = (path: string) => {
    setSelectedPath(path);
    if (projectId) navigate(`/projects/${projectId}/files/${encodeURIComponent(path)}`);
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
      <div style={{
        width: 280,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        padding: '12px 8px',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px 12px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="var(--accent)">
            <path d="M4 0h5.293A1 1 0 0110 .293L13.707 4a1 1 0 01.293.707V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2z" />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>Files</span>
        </div>
        {tree ? (
          <FileTree
            node={tree}
            projectId={projectId}
            onSelectFile={handleFileSelect}
            selectedPath={selectedPath}
          />
        ) : (
          <div style={{ padding: 16, color: 'var(--text)', fontSize: 13 }}>Loading...</div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {progress && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>Analysis Progress</h2>
              <span style={{ color: 'var(--text)', fontSize: 13 }}>
                {progress.completed}/{progress.total} files
              </span>
            </div>
            <div style={{
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : '0%',
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {structure && (
          <div style={{
            background: 'var(--code-bg)',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-h)' }}>
              Project Structure Analysis
            </h2>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
              {structure}
            </div>
          </div>
        )}

        {!structure && !progress && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p>Select a file from the sidebar to view its analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}
