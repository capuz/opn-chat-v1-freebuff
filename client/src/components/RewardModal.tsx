import { useTranslation } from '../i18n';

interface RewardModalProps {
  type: 'room' | 'nickname' | 'boost';
  isDark: boolean;
  onWatchAd: () => void;
  onUpgrade?: () => void;
  onClose: () => void;
  isWatchingAd: boolean;
  adFailed?: boolean;
  adCountdown?: number;
}

export function RewardModal({ type, isDark: _isDark, onWatchAd, onUpgrade, onClose, isWatchingAd, adFailed, adCountdown = 0 }: RewardModalProps) {
  const { t } = useTranslation();

  const subtitle =
    type === 'room'     ? t('monetize.usedFreeRoom') :
    type === 'nickname' ? t('monetize.usedFreeNickChange') :
                          t('monetize.usedFreeBoost');

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
        <div style={{ textAlign: 'center', fontSize: 32, lineHeight: 1 }}>🔒</div>

        {/* title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ch-text)', marginBottom: 6 }}>
            {t('monetize.limitReached')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ch-text-2)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        </div>

        {/* buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Watch Ad */}
          <button
            onClick={isWatchingAd ? undefined : onWatchAd}
            disabled={isWatchingAd}
            style={{
              padding: '10px 16px', borderRadius: 7, border: 'none', cursor: isWatchingAd ? 'default' : 'pointer',
              background: 'var(--ch-btn-active)', color: 'var(--ch-btn-text)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              opacity: isWatchingAd ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {isWatchingAd ? t('monetize.watchingAd') : `📺 ${t('monetize.watchAd')}`}
          </button>

          {/* Countdown while ad is active */}
          {isWatchingAd && (
            <div style={{
              padding: '10px 0', textAlign: 'center',
              fontSize: 12, color: 'var(--ch-text-2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              {adCountdown > 0 ? (
                <>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ch-text)', lineHeight: 1 }}>
                    {adCountdown}
                  </span>
                  <span>⏳ {t('monetize.watchingAd')}</span>
                </>
              ) : (
                <span>⏳ {t('monetize.watchingAd')}</span>
              )}
            </div>
          )}

          {/* Ad failed / closed without completing */}
          {adFailed && !isWatchingAd && (
            <div style={{
              padding: '8px 12px', borderRadius: 7,
              background: 'var(--ch-bg-3)',
              border: '1px solid var(--ch-border)',
              fontSize: 12, color: 'var(--ch-text-2)',
              textAlign: 'center',
            }}>
              {t('monetize.adNotCompleted')}
            </div>
          )}

          {/* Upgrade Premium (room / boost only) */}
          {(type === 'room' || type === 'boost') && onUpgrade && (
            <button
              onClick={onUpgrade}
              style={{
                padding: '10px 16px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent',
                border: '1px solid var(--ch-border-2)',
                color: 'var(--ch-text)', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
            >
              ⭐ {t('monetize.upgradePremium')}
            </button>
          )}

          {/* Cancel */}
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 7, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: 'var(--ch-text-2)', fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
