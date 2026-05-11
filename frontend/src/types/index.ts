export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  language?: string;
  lineCount?: number;
  analyzable?: boolean;
  analysisStatus?: 'PENDING' | 'ANALYZING' | 'DONE';
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
  totalFiles: number;
  skippedFiles: number;
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

export interface ProjectQualitySummary {
  overallGrade: string;
  fileCountAnalyzed: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  averageScores: {
    readability: number;
    complexity: number;
    convention: number;
    security: number;
  };
  topIssues: {
    file: string;
    severity: string;
    title: string;
  }[];
}

export interface AstNode {
  type: string;
  name: string;
  startLine: number;
  endLine: number;
  children: AstNode[];
}
