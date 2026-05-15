import { useTranslation } from '../i18n';

interface SponsoredBannerSlotProps {
  isDark: boolean;
}

export function SponsoredBannerSlot({ isDark: _isDark }: SponsoredBannerSlotProps) {
  const { t } = useTranslation();

  return (
    <div style={{
      margin: '8px 10px',
      padding: '10px',
      borderRadius: 6,
      border: '1px dashed var(--ch-border-2)',
      textAlign: 'center',
      fontSize: 10,
      color: 'var(--ch-text-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {t('monetize.adSlotLabel')}
    </div>
  );
}
