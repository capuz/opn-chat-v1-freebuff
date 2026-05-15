import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type BannerType = 'info' | 'warning' | 'event' | 'promoted' | 'sponsored';
type BannerAnimation = 'ticker' | 'gradient' | 'glow-pulse' | 'typewriter' | 'neon-shimmer';

interface GlobalAnnouncementBannerProps {
  id: string;
  message: string;
  type: BannerType;
  animation: BannerAnimation;
  isDark: boolean;
  onDismiss: () => void;
  isDismissed: boolean;
  onRoomClick?: (roomName: string) => void;
}

const TYPE_STYLES: Record<BannerType, { border: string; bg: string; prefix?: string }> = {
  info:      { border: 'var(--ch-border-2)', bg: 'var(--ch-bg-3)' },
  warning:   { border: 'rgba(251,191,36,0.5)', bg: 'rgba(251,191,36,0.06)' },
  event:     { border: 'var(--ch-accent)', bg: 'rgba(94,234,212,0.05)' },
  promoted:  { border: 'rgba(139,92,246,0.5)', bg: 'rgba(139,92,246,0.06)' },
  sponsored: { border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.05)', prefix: 'Sponsored' },
};

function parseMessage(message: string, onRoomClick?: (name: string) => void): ReactNode {
  const parts = message.split(/(#[\w-]+)/g);
  return parts.map((part, i) => {
    if (/^#[\w-]+$/.test(part) && onRoomClick) {
      const roomName = part.slice(1);
      return (
        <button
          key={i}
          onClick={() => onRoomClick(roomName)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ch-accent)', fontWeight: 600,
            padding: '0 1px', fontFamily: 'inherit', fontSize: 'inherit',
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          {part}
        </button>
      );
    }
    return part;
  });
}

function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 45);
    return () => {
      clearInterval(timer);
      setShown('');
    };
  }, [text]);

  return <span>{shown}<span style={{ opacity: shown.length < text.length ? 1 : 0 }}>|</span></span>;
}

function AnimatedText({ message, animation, onRoomClick }: { message: string; animation: BannerAnimation; onRoomClick?: (name: string) => void }) {
  const content = parseMessage(message, onRoomClick);

  if (animation === 'ticker') {
    return (
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <span className="ch-banner-ticker-inner">{content}</span>
      </div>
    );
  }
  if (animation === 'gradient') {
    return <span className="ch-banner-gradient-text">{content}</span>;
  }
  if (animation === 'glow-pulse') {
    return (
      <span style={{ animation: 'glow-pulse-banner 2.5s ease-in-out infinite', color: 'var(--ch-accent)' }}>
        {content}
      </span>
    );
  }
  if (animation === 'typewriter') {
    return <TypewriterText text={message} />;
  }
  if (animation === 'neon-shimmer') {
    return (
      <span style={{ animation: 'neon-shimmer 2s ease-in-out infinite', color: 'var(--ch-accent)' }}>
        {content}
      </span>
    );
  }
  return <span>{content}</span>;
}

export function GlobalAnnouncementBanner({
  message, type, animation, onDismiss, isDismissed, onRoomClick,
}: GlobalAnnouncementBannerProps) {
  if (isDismissed) return null;

  const { border, bg, prefix } = TYPE_STYLES[type];

  return (
    <div style={{
      height: 28, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      gap: 8, padding: '0 12px',
      background: bg,
      borderTop: `1px solid ${border}`,
      fontSize: 11, color: 'var(--ch-text)',
      animation: 'fadeSlideDown 0.2s ease-out',
      overflow: 'hidden',
    }}>
      {prefix && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
          color: 'var(--ch-text-2)', flexShrink: 0,
          textTransform: 'uppercase',
        }}>
          {prefix}
        </span>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <AnimatedText message={message} animation={animation} onRoomClick={onRoomClick} />
      </div>

      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
          color: 'var(--ch-text-2)', fontSize: 14, lineHeight: 1, flexShrink: 0,
          fontFamily: 'inherit',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
