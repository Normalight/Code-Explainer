import type { FileTreeNode, ProjectInfo, ProgressInfo } from '../types';

const API_BASE = '/api/projects';

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

export async function getStructure(projectId: number): Promise<{ analysis: string }> {
  const res = await fetch(`${API_BASE}/${projectId}/structure`);
  if (!res.ok) throw new Error(`Failed to get structure: ${res.status}`);
  return res.json();
}

export async function getQuality(projectId: number, filePath: string): Promise<string> {
  const res = await fetch(`${API_BASE}/${projectId}/quality?filePath=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to get quality: ${res.status}`);
  return res.text();
}

export function getExplainUrl(projectId: number, filePath: string): string {
  return `${API_BASE}/${projectId}/explain?filePath=${encodeURIComponent(filePath)}`;
}

export function getAskUrl(projectId: number, filePath: string, startLine: number, endLine: number, question: string): string {
  const params = new URLSearchParams({
    filePath,
    startLine: String(startLine),
    endLine: String(endLine),
    question,
  });
  return `${API_BASE}/${projectId}/ask?${params}`;
}

export function askQuestion(projectId: number, filePath: string, startLine: number, endLine: number, question: string): Promise<string> {
  return new Promise((resolve) => {
    const url = getAskUrl(projectId, filePath, startLine, endLine, question);
    const eventSource = new EventSource(url);
    let result = '';

    eventSource.addEventListener('content', (e) => {
      result += e.data;
    });

    eventSource.onerror = () => {
      eventSource.close();
      resolve(result);
    };
  });
}
