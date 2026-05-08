import { useI18n } from '../i18n';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { t, locale, setLocale } = useI18n();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
          width: 440, maxHeight: '80vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          {/* Gear icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-h)' }}>{t('settings')}</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--text)', cursor: 'pointer', padding: 4, opacity: 0.5,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Settings section */}
        <div style={{ padding: '20px' }}>
          {/* Language */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('language')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <LangButton active={locale === 'zh-CN'} onClick={() => setLocale('zh-CN')}>
                <span style={{ marginRight: 6 }}>🇨🇳</span> 中文
              </LangButton>
              <LangButton active={locale === 'en-US'} onClick={() => setLocale('en-US')}>
                <span style={{ marginRight: 6 }}>🇺🇸</span> English
              </LangButton>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

          {/* About */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('about')}
            </label>

            {/* Logo + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-h)' }}>Code Explainer</div>
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>v0.1.0</div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
              {t('aboutDesc')}
            </p>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <InfoRow label={t('aboutVersion')} value="0.1.0" />
              <InfoRow label={t('aboutTech')} value={t('aboutTechList')} />
              <InfoRow label={t('aboutLicense')} value="MIT" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LangButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 16px', borderRadius: 8, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--code-bg)', color: active ? 'var(--accent)' : 'var(--text)',
        cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text)', flexShrink: 0, width: 60 }}>{label}</span>
      <span style={{ color: 'var(--text-h)' }}>{value}</span>
    </div>
  );
}
