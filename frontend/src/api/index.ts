import type { FileTreeNode, ProjectInfo, ProgressInfo } from '../types';

const API_BASE = '/api/projects';

export async function listProjects(): Promise<ProjectInfo[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
  return res.json();
}

export async function uploadProject(file: File): Promise<ProjectInfo> {
  return uploadProjectWithProgress(file, {});
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export function uploadProjectWithProgress(file: File, options: UploadOptions): Promise<ProjectInfo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));

    if (options.signal) {
      options.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.open('POST', `${API_BASE}/upload`);
    xhr.send(formData);
  });
}

export async function getFileTree(projectId: number): Promise<FileTreeNode> {
  const res = await fetch(`${API_BASE}/${projectId}/tree`);
  if (!res.ok) throw new Error(`Failed to load file tree: ${res.status}`);
  return res.json();
}

export async function getFileContent(projectId: number, filePath: string): Promise<string> {
  const res = await fetch(`${API_BASE}/${projectId}/files/${filePath}`);
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
  return res.text();
}

export async function getProgress(projectId: number): Promise<ProgressInfo> {
  const res = await fetch(`${API_BASE}/${projectId}/progress`);
  if (!res.ok) throw new Error(`Failed to get progress: ${res.status}`);
  return res.json();
}

export async function getStructure(projectId: number, lang = 'zh'): Promise<{ analysis: string }> {
  const res = await fetch(`${API_BASE}/${projectId}/structure?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`Failed to get structure: ${res.status}`);
  return res.json();
}

export async function getQuality(projectId: number, filePath: string, lang = 'zh'): Promise<string> {
  const res = await fetch(`${API_BASE}/${projectId}/quality?filePath=${encodeURIComponent(filePath)}&lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`Failed to get quality: ${res.status}`);
  return res.text();
}

export function getExplainUrl(projectId: number, filePath: string, lang = 'zh'): string {
  return `${API_BASE}/${projectId}/explain?filePath=${encodeURIComponent(filePath)}&lang=${encodeURIComponent(lang)}`;
}

export async function getAst(projectId: number, filePath: string): Promise<{ type: string; name: string; startLine: number }[]> {
  const res = await fetch(`${API_BASE}/${projectId}/ast?filePath=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to get AST: ${res.status}`);
  return res.json();
}

export function getAskUrl(projectId: number, filePath: string, startLine: number, endLine: number, question: string, lang = 'zh'): string {
  const params = new URLSearchParams({
    filePath,
    startLine: String(startLine),
    endLine: String(endLine),
    question,
    lang,
  });
  return `${API_BASE}/${projectId}/ask?${params}`;
}

export async function getDependencies(projectId: number): Promise<{ nodes: { id: string; label: string; language: string }[]; edges: { source: string; target: string }[] }> {
  const res = await fetch(`${API_BASE}/${projectId}/dependencies`);
  if (!res.ok) throw new Error(`Failed to get dependencies: ${res.status}`);
  return res.json();
}

export function getExportUrl(projectId: number): string {
  return `${API_BASE}/${projectId}/export`;
}

export async function searchCode(projectId: number, query: string): Promise<{ path: string; line: number; text: string }[]> {
  const res = await fetch(`${API_BASE}/${projectId}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
  return res.json();
}

export async function importGitHub(url: string): Promise<ProjectInfo> {
  const res = await fetch(`${API_BASE}/import-github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Failed to import: ${res.status}`);
  return res.json();
}

export interface SessionInfo {
  sessionId: string;
  title: string;
  lastMessageTime: string;
}

export async function getChatSessions(projectId: number): Promise<SessionInfo[]> {
  const res = await fetch(`${API_BASE}/${projectId}/chat/sessions`);
  if (!res.ok) throw new Error(`Failed to get sessions: ${res.status}`);
  return res.json();
}

export async function deleteChatSession(projectId: number, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${projectId}/chat/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  timestamp: number;
  message: string;
}

export async function getCommits(projectId: number, limit = 50): Promise<CommitInfo[]> {
  const res = await fetch(`${API_BASE}/${projectId}/commits?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to get commits: ${res.status}`);
  return res.json();
}

export async function getCommitDiff(projectId: number, hash: string): Promise<string> {
  const res = await fetch(`${API_BASE}/${projectId}/commits/${hash}/diff`);
  if (!res.ok) throw new Error(`Failed to get diff: ${res.status}`);
  return res.json().then((d: { diff: string }) => d.diff);
}

export async function reviewCommit(projectId: number, hash: string, lang = 'zh'): Promise<string> {
  const res = await fetch(`${API_BASE}/${projectId}/commits/${hash}/review?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`Failed to review: ${res.status}`);
  return res.json().then((d: { review: string }) => d.review);
}
