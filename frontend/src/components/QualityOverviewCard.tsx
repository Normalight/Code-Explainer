import type { ProjectQualitySummary } from '../types';
import { useI18n } from '../i18n';

interface Props {
  summary: ProjectQualitySummary;
}

const GRADE_STYLES: Record<string, { bg: string; color: string }> = {
  A: { bg: '#22c55e20', color: '#22c55e' },
  B: { bg: '#3b82f620', color: '#3b82f6' },
  C: { bg: '#f59e0b20', color: '#f59e0b' },
  D: { bg: '#ef444420', color: '#ef4444' },
  'N/A': { bg: '#6b728020', color: '#6b7280' },
};

export default function QualityOverviewCard({ summary }: Props) {
  const { t } = useI18n();

  if (summary.fileCountAnalyzed === 0) {
    return (
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 8, background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-h)' }}>{t('qualityOverview')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text)', opacity: 0.6 }}>{t('noQualityData')}</p>
      </div>
    );
  }

  const gradeStyle = GRADE_STYLES[summary.overallGrade] || GRADE_STYLES['N/A'];

  return (
    <div style={{ marginBottom: 24, padding: 16, borderRadius: 8, background: 'var(--code-bg)', border: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-h)' }}>{t('qualityOverview')}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 48, height: 48, borderRadius: 12, fontSize: 22, fontWeight: 700,
          background: gradeStyle.bg, color: gradeStyle.color,
        }}>
          {summary.overallGrade}
        </span>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          <div><strong>{summary.fileCountAnalyzed}</strong> {t('analyzedFiles')}</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 12 }}>
            {summary.criticalCount > 0 && <span style={{ color: '#ef4444' }}>{summary.criticalCount} critical</span>}
            {summary.warningCount > 0 && <span style={{ color: '#f59e0b' }}>{summary.warningCount} warning</span>}
            {summary.suggestionCount > 0 && <span style={{ color: '#3b82f6' }}>{summary.suggestionCount} suggestion</span>}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('averageScores')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {Object.entries(summary.averageScores).map(([key, val]) => (
            <div key={key} style={{ fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', marginBottom: 2 }}>
                <span style={{ textTransform: 'capitalize' }}>{key}</span>
                <span>{val.toFixed(1)}/5</span>
              </div>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {summary.topIssues.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('topIssues')}</div>
          {summary.topIssues.map((issue, i) => (
            <div key={i} style={{
              fontSize: 11, padding: '4px 8px', marginBottom: 3, borderRadius: 4,
              background: issue.severity === 'critical' ? '#ef444415' : issue.severity === 'warning' ? '#f59e0b15' : '#3b82f615',
              borderLeft: `3px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
            }}>
              <span style={{ fontWeight: 500, color: 'var(--text-h)' }}>{issue.title}</span>
              <span style={{ opacity: 0.6, marginLeft: 6 }}>{issue.file}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
