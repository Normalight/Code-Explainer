export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  language?: string;
  lineCount?: number;
  children?: FileTreeNode[];
}

export interface ProjectInfo {
  id: number;
  name: string;
  uploadTime: string;
  overallGrade?: string;
  totalIssuesCritical: number;
  totalIssuesWarning: number;
  totalIssuesSuggestion: number;
}

export interface ProgressInfo {
  total: number;
  completed: number;
  analyzing: number;
}

export interface SegmentInfo {
  startLine: number;
  endLine: number;
  title: string;
}

export interface QualityAssessment {
  grade: string;
  scores: {
    readability: number;
    complexity: number;
    convention: number;
    security: number;
  };
  summary: string;
  issues: QualityIssue[];
}

export interface QualityIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  lineStart: number;
  lineEnd: number;
  title: string;
  description: string;
}
