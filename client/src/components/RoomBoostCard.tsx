import { useTranslation } from '../i18n';

interface RoomBoostCardProps {
  roomId: string;
  isBoosted: boolean;
  boostExpiry: number | null;
  isDark: boolean;
  onBoost: () => void;
  isOwner: boolean;
  globalBoostActive: boolean;
}

function msToMinutes(ms: number): number {
  return Math.max(0, Math.ceil(ms / 60_000));
}

export function RoomBoostCard({ isBoosted, boostExpiry, isDark: _isDark, onBoost, isOwner, globalBoostActive }: RoomBoostCardProps) {
  const { t } = useTranslation();

  if (!isOwner) return null;

  const minutesLeft = boostExpiry ? msToMinutes(boostExpiry - Date.now()) : 0;

  return (
    <div style={{ paddingLeft: 28, paddingBottom: 2 }}>
      {isBoosted ? (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--ch-accent)',
        }} className="ch-boost-badge">
          {t('monetize.boostedBadge')} · {t('monetize.boostExpiry', { m: minutesLeft })}
        </span>
      ) : (
        <button
          onClick={globalBoostActive ? undefined : onBoost}
          disabled={globalBoostActive}
          title={globalBoostActive ? t('monetize.boostBlocked') : undefined}
          style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            cursor: globalBoostActive ? 'not-allowed' : 'pointer',
            background: 'transparent', fontFamily: 'inherit',
            border: `1px solid ${globalBoostActive ? 'var(--ch-border)' : 'var(--ch-boost-border)'}`,
            color: globalBoostActive ? 'var(--ch-text-3)' : 'var(--ch-accent)',
            fontWeight: 600,
            opacity: globalBoostActive ? 0.45 : 1,
            transition: 'background 0.15s',
          }}
        >
          {t('monetize.boostCTA')}
        </button>
      )}
    </div>
  );
}
