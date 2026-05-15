import { useTranslation } from '../i18n';

interface UpgradeModalProps {
  isDark: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isDark: _isDark, onClose }: UpgradeModalProps) {
  const { t } = useTranslation();

  const features = [
    t('monetize.upgradeFeature1'),
    t('monetize.upgradeFeature2'),
    t('monetize.upgradeFeature3'),
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(6px)',
      zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 380, borderRadius: 12, padding: 28,
        background: 'var(--ch-modal-bg)',
        border: '1px solid var(--ch-border-2)',
        display: 'flex', flexDirection: 'column', gap: 16,
        animation: 'fadeSlideDown 0.18s ease-out',
      }} onClick={e => e.stopPropagation()}>

        {/* icon */}
        <div style={{ textAlign: 'center', fontSize: 36, lineHeight: 1 }}>⭐</div>

        {/* title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ch-text)', marginBottom: 6 }}>
            {t('monetize.upgradePremium')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ch-text-2)', lineHeight: 1.5 }}>
            {t('monetize.upgradeSubtitle')}
          </div>
        </div>

        {/* features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {features.map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--ch-text)',
            }}>
              <span style={{ color: 'var(--ch-accent)', flexShrink: 0 }}>✓</span>
              {f}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button disabled style={{
          padding: '10px 16px', borderRadius: 7, border: 'none',
          background: 'var(--ch-btn-active)', color: 'var(--ch-btn-text)',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          opacity: 0.5, cursor: 'not-allowed',
        }}>
          {t('monetize.upgradeComingSoon')}
        </button>

        <button onClick={onClose} style={{
          padding: '8px 16px', borderRadius: 7, cursor: 'pointer',
          background: 'transparent', border: 'none',
          color: 'var(--ch-text-2)', fontSize: 12, fontFamily: 'inherit',
        }}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
