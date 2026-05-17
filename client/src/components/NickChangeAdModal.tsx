import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { showRewardedAd } from '../services/adsense.service';
import { api } from '../services/api.service';

interface NickChangeAdModalProps {
  onClose: () => void;
  onSuccess: (expiryTs: number) => void;
}

const AD_DURATION_S = 15;

export function NickChangeAdModal({ onClose, onSuccess }: NickChangeAdModalProps) {
  const { t } = useTranslation();
  const [isWatching, setIsWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isWatching) { setCountdown(0); return; }
    setCountdown(AD_DURATION_S);
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isWatching]);

  const handleWatchAd = useCallback(async () => {
    setIsWatching(true);
    setFailed(false);

    const granted = await showRewardedAd();

    if (!granted) {
      setIsWatching(false);
      setFailed(true);
      return;
    }

    try {
      const res = await api.post('/api/profile/nick-ad-unlock');
      const expiryTs = new Date(res.data.unlockedUntil).getTime();
      setIsWatching(false);
      onSuccess(expiryTs);
    } catch {
      const expiryTs = Date.now() + 12 * 60 * 60 * 1000;
      setIsWatching(false);
      onSuccess(expiryTs);
    }
  }, [onSuccess]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={isWatching ? undefined : onClose}
    >
      <div
        style={{
          width: 380, borderRadius: 12, padding: 28,
          background: 'var(--ch-modal-bg)',
          border: '1px solid var(--ch-border-2)',
          display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'fadeSlideDown 0.18s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', fontSize: 32, lineHeight: 1 }}>🔒</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ch-text)', marginBottom: 6 }}>
            {t('monetize.limitReached')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ch-text-2)', lineHeight: 1.5 }}>
            {t('monetize.usedFreeNickChange')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={isWatching ? undefined : handleWatchAd}
            disabled={isWatching}
            style={{
              padding: '10px 16px', borderRadius: 7, border: 'none',
              cursor: isWatching ? 'default' : 'pointer',
              background: 'var(--ch-btn-active)', color: 'var(--ch-btn-text)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              opacity: isWatching ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {isWatching ? t('monetize.watchingAd') : `📺 ${t('monetize.watchAd')}`}
          </button>

          {isWatching && (
            <div style={{
              padding: '10px 0', textAlign: 'center',
              fontSize: 12, color: 'var(--ch-text-2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              {countdown > 0 ? (
                <>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ch-text)', lineHeight: 1 }}>
                    {countdown}
                  </span>
                  <span>⏳ {t('monetize.watchingAd')}</span>
                </>
              ) : (
                <span>⏳ {t('monetize.watchingAd')}</span>
              )}
            </div>
          )}

          {failed && !isWatching && (
            <div style={{
              padding: '8px 12px', borderRadius: 7,
              background: 'var(--ch-bg-3)',
              border: '1px solid var(--ch-border)',
              fontSize: 12, color: 'var(--ch-text-2)', textAlign: 'center',
            }}>
              {t('monetize.adNotCompleted')}
            </div>
          )}

          <button
            onClick={isWatching ? undefined : onClose}
            disabled={isWatching}
            style={{
              padding: '8px 16px', borderRadius: 7,
              cursor: isWatching ? 'default' : 'pointer',
              background: 'transparent', border: 'none',
              color: 'var(--ch-text-2)', fontSize: 12,
              fontFamily: 'inherit', opacity: isWatching ? 0.4 : 1,
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
