import { useState, useEffect, useRef, useCallback, useMemo, type ReactElement } from 'react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import type { Message } from '../types/auth';
import type { PrivateMessage, Conversation } from '../types/privateMessage';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSocket, disconnectSocket } from '../services/socketio.service';
import { authService } from '../services/auth.service';
import { privateChatService } from '../services/privateChat.service';
import { roomService } from '../services/room.service';
import { apiService } from '../services/api.service';
import { showRewardedAd } from '../services/adsense.service';
import { chatSounds } from '../utils/chatSounds';
import { useTranslation } from '../i18n/I18nContext';
import type { SupportedLanguage } from '../i18n/I18nContext';
import { useMonetization } from '../hooks/useMonetization';
import { RewardModal } from '../components/RewardModal';
import { RoomBoostCard } from '../components/RoomBoostCard';
import { GlobalAnnouncementBanner } from '../components/GlobalAnnouncementBanner';

const api = apiService.getAxiosInstance();

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconHash = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 1l-1 14M11 1l-1 14M1 5h14M1 11h14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
);

const IconUser = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="5" r="3" />
    <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
);

const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2L9 11M18 2L12 18l-3-7-7-3 16-6z" />
  </svg>
);

const IconBack = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M15 10H5M9 5l-5 5 5 5" />
  </svg>
);

const IconEmoji = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" strokeLinecap="round" />
    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconMoon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 4 14 4" />
    <path d="M5 4V2h6v2" />
    <rect x="3" y="4" width="10" height="10" rx="1" />
    <line x1="6" y1="7" x2="6" y2="11" />
    <line x1="10" y1="7" x2="10" y2="11" />
  </svg>
);

// ─── Constants ───────────────────────────────────────────────────────────────

const NICK_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
];

const nickColor = (id: string) =>
  NICK_COLORS[id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % NICK_COLORS.length];

const toFlagEmoji = (code: string) =>
  code.length === 2
    ? Array.from(code.toUpperCase())
        .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
        .join('')
    : '';

const EARLY_USER_CUTOFF = new Date('2026-06-01');

const getBadgeLabel = (badge?: string | null, createdAt?: string | null): string | null => {
  if (badge === 'founder')   return '★';
  if (badge === 'moderator') return '@';
  if (!badge && createdAt && new Date(createdAt) < EARLY_USER_CUTOFF) return '~';
  return null;
};

const parseInline = (text: string, nextKey: () => number): (string | ReactElement)[] => {
  const parts: (string | ReactElement)[] = [];
  const regex = /(\*[^*]+\*|__[^_]+__|_[^_]+_|~[^~]+~|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const isDouble = raw.startsWith('__') && raw.endsWith('__');
    const inner = isDouble ? raw.slice(2, -2) : raw.slice(1, -1);
    if      (raw[0] === '*') parts.push(<strong key={nextKey()}>{inner}</strong>);
    else if (isDouble)        parts.push(<u key={nextKey()}>{inner}</u>);
    else if (raw[0] === '_') parts.push(<em key={nextKey()}>{inner}</em>);
    else if (raw[0] === '~') parts.push(<s key={nextKey()}>{inner}</s>);
    else                     parts.push(<code key={nextKey()} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.88em', background: 'var(--ch-bg-3)', padding: '1px 4px', borderRadius: 3 }}>{inner}</code>);
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const parseFormatting = (text: string): (string | ReactElement)[] => {
  const result: (string | ReactElement)[] = [];
  let k = 0;
  const nextKey = () => k++;
  const tripleRegex = /```([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tripleRegex.exec(text)) !== null) {
    if (m.index > last) result.push(...parseInline(text.slice(last, m.index), nextKey));
    result.push(
      <pre key={nextKey()} style={{
        fontFamily: "'DM Mono', monospace", fontSize: '0.88em',
        background: 'var(--ch-bg-3)', border: '1px solid var(--ch-border)',
        borderRadius: 4, padding: '6px 10px', margin: '2px 0',
        whiteSpace: 'pre-wrap', overflowX: 'auto', lineHeight: 1.45, display: 'block',
      }}>
        {m[1]}
      </pre>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(...parseInline(text.slice(last), nextKey));
  return result;
};

const getInitialTheme = (): 'dark' | 'light' => {
  const stored = localStorage.getItem('chat-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// ─── Shared input style (modal forms) ────────────────────────────────────────

const modalInput: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--ch-border-2)',
  borderRadius: 6,
  padding: '7px 11px',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: 'var(--ch-bg-3)',
  color: 'var(--ch-text)',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  transition: 'border-color 0.15s ease',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sortAsc = (msgs: PrivateMessage[]) =>
  [...msgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

// ─── Language options ─────────────────────────────────────────────────────────

const LANG_OPTIONS: { value: SupportedLanguage | 'auto'; label: string }[] = [
  { value: 'auto',  label: '🌐 Auto' },
  { value: 'es',    label: 'ES' },
  { value: 'en',    label: 'EN' },
  { value: 'pt-BR', label: 'PT' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const ChatPage = () => {
  const navigate  = useNavigate();
  const { user, isAuthenticated, loading, refreshAuth } = useAuth();
  const { t, language, timezone, timezoneOffset, autoDetect, hour12, setHour12, setLanguage, formatDate } = useTranslation();

  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  const [globalMessages,    setGlobalMessages]    = useState<Message[]>([]);
  const [inputMessage,      setInputMessage]      = useState('');
  const [connectionStatus,  setConnectionStatus]  = useState('Disconnected');
  const [apiStatus,         setApiStatus]         = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [activeRoom,        setActiveRoom]        = useState('');
  const [chatMode,          setChatMode]          = useState<'global' | 'private'>('global');
  const [privateMessages,   setPrivateMessages]   = useState<PrivateMessage[]>([]);
  const [privatePartner,    setPrivatePartner]    = useState('');
  const [partnerNickname,   setPartnerNickname]   = useState('');
  const [conversations,     setConversations]     = useState<Conversation[]>([]);
  const [totalUnreadDMs,    setTotalUnreadDMs]    = useState(0);
  const [privatesExpanded,  setPrivatesExpanded]  = useState(false);
  const [hoveredMsg,        setHoveredMsg]        = useState<string | null>(null);
  const [deleteMenu,        setDeleteMenu]        = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [rooms,             setRooms]             = useState<{ id: string; name: string; description: string; createdById?: string }[]>([]);
  const [onlineUsers,       setOnlineUsers]       = useState<{ id: string; nickname: string; isOnline: boolean; countryCode?: string; showFlag?: boolean; awayMessage?: string; badge?: string; createdAt?: string }[]>([]);
  const [presenceReady,     setPresenceReady]     = useState(false);
  const [soundEnabled,      setSoundEnabled]      = useState(() => chatSounds.isEnabled());
  const [announcementMsg,   setAnnouncementMsg]   = useState('');

  const [showCreateRoom,      setShowCreateRoom]      = useState(false);
  const [newRoomName,         setNewRoomName]         = useState('');
  const [newRoomDescription,  setNewRoomDescription]  = useState('');
  const [newRoomIsPrivate,    setNewRoomIsPrivate]    = useState(false);
  const [newRoomPassword,     setNewRoomPassword]     = useState('');
  const [createRoomError,     setCreateRoomError]     = useState('');

  const [showNicknameModal,   setShowNicknameModal]   = useState(false);
  const [newNickname,         setNewNickname]         = useState('');
  const [nicknameChangesLeft, setNicknameChangesLeft] = useState<number>(3);
  const [nicknameError,       setNicknameError]       = useState('');
  const [nicknameSaving,      setNicknameSaving]      = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── Monetization ──
  const monetization = useMonetization();
  const [showRewardModal,   setShowRewardModal]   = useState<'room' | 'nickname' | 'boost' | null>(null);
  const [isWatchingAd,      setIsWatchingAd]      = useState(false);
  const [adGrantFailed,     setAdGrantFailed]     = useState(false);
  const [pendingBoostRoomId, setPendingBoostRoomId] = useState<string | null>(null);
  const [hoveredRoom,       setHoveredRoom]       = useState<string | null>(null);
  const [activeBoost,       setActiveBoost]       = useState<{ roomId: string; expiresAt: number } | null>(null);

  const [showFlag,      setShowFlag]      = useState(false);
  const [countryCode,   setCountryCode]   = useState('');
  const [detectingFlag, setDetectingFlag] = useState(false);
  const [flagError,     setFlagError]     = useState('');

  const [isAway,      setIsAway]      = useState(false);
  const [awayMessage, setAwayMessage] = useState('');

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const emojiPickerRef    = useRef<HTMLDivElement>(null);
  const emojiBtnRef       = useRef<HTMLButtonElement>(null);
  const cursorGlowRef     = useRef<HTMLDivElement>(null);
  const userNicknameRef   = useRef<string | undefined>(user?.nickname);
  const presenceReadyRef  = useRef(false);
  const chatModeRef       = useRef(chatMode);
  const privatePartnerRef = useRef(privatePartner);

  // ── Theme ──
  const toggleTheme = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('chat-theme', next);
      return next;
    });

  // ── Phosphor cursor glow (dark only) ──
  useEffect(() => {
    if (theme !== 'dark') return;
    const move = (e: MouseEvent) => {
      if (!cursorGlowRef.current) return;
      cursorGlowRef.current.style.setProperty('--cx', `${e.clientX}px`);
      cursorGlowRef.current.style.setProperty('--cy', `${e.clientY}px`);
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, [theme]);

  // ── Sound init + ref sync ──
  useEffect(() => { chatSounds.loadSettings(); }, []);
  useEffect(() => { userNicknameRef.current = user?.nickname; }, [user?.nickname]);
  useEffect(() => { presenceReadyRef.current = presenceReady; }, [presenceReady]);
  useEffect(() => { chatModeRef.current = chatMode; }, [chatMode]);
  useEffect(() => { privatePartnerRef.current = privatePartner; }, [privatePartner]);

  // ── Auth guard — read from localStorage to avoid context lag after login ──
  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  // ── Close delete menu on outside click ──
  useEffect(() => {
    if (!deleteMenu) return;
    const handler = () => setDeleteMenu(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deleteMenu]);

  // ── Close emoji picker on outside click ──
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) &&
        emojiBtnRef.current   && !emojiBtnRef.current.contains(e.target as Node)
      ) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  // ── Load recent DM conversations ──
  useEffect(() => {
    if (!isAuthenticated) return;
    privateChatService.getRecentConversations()
      .then(convs => {
        setConversations(convs);
        setTotalUnreadDMs(convs.reduce((acc, c) => acc + c.unreadCount, 0));
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // ── Announcement banner ──
  useEffect(() => {
    if (!isAuthenticated) return;
    monetization.resetDismissedAnnouncements();
    api.get<{ message: string }>('/api/settings/announcement')
      .then(r => setAnnouncementMsg(r.data.message))
      .catch(() => {});
  }, [isAuthenticated]);

  // ── Profile (nickname changes + flag preference) ──
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/profile/me').then(res => {
      setNicknameChangesLeft(res.data.nicknameChangesLeft ?? 3);
      setShowFlag(res.data.show_flag ?? false);
      setCountryCode(res.data.country_code ?? '');
    }).catch(() => {});
  }, [isAuthenticated]);

  // ── Chat hub + initial room join ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const conn = getSocket('chat');
    conn.on('receive_message', (raw: any) => {
      const msg: Message = {
        id: raw.id,
        userId: raw.user_id,
        senderNickname: raw.user_name,
        userName: raw.user_name,
        content: raw.content,
        type: raw.type,
        timestamp: raw.timestamp,
        replyToId: raw.reply_to_id ?? null,
        badge: raw.badge ?? null,
      };
      setGlobalMessages(prev => [...prev, msg]);
      const nick = userNicknameRef.current;
      if (nick && msg.senderNickname !== nick) {
        if (msg.content.toLowerCase().includes(nick.toLowerCase())) {
          chatSounds.play('mention');
        } else {
          chatSounds.play('messageReceived');
        }
      }
    });
    conn.on('room_boosted', ({ room_id, expires_at }: { room_id: string; expires_at: string }) => {
      const expiresAtMs = new Date(expires_at).getTime();
      setActiveBoost({ roomId: room_id, expiresAt: expiresAtMs });
      monetization.boostRoom(room_id);
    });
    conn.on('room_boost_expired', (_payload: { room_id: string }) => {
      setActiveBoost(null);
    });
    conn.on('boost_error', (_error: string) => {
      // servidor rechazó el boost — no hacer nada, el estado local ya no cambió
    });
    const connectAndLoad = async () => {
      try {
        setConnectionStatus('Connecting...');
        conn.on('connect', () => setConnectionStatus('Connected'));
        conn.on('disconnect', () => setConnectionStatus('Disconnected'));
        const res = await api.get('/api/rooms/public');
        setApiStatus('connected');
        const loaded = res.data.map((r: any) => ({ id: r.id, name: r.name, description: r.description, createdById: r.createdById }));
        setRooms(loaded);
        if (loaded.length > 0) {
          const firstId = loaded[0].id;
          setActiveRoom(firstId);
          conn.emit('join_room', firstId);
          const msgs = await api.get(`/api/rooms/${firstId}/messages`, { params: { take: 50 } });
          setGlobalMessages(msgs.data.map((raw: any) => ({
            id: raw.id,
            userId: raw.user_id,
            userName: raw.user_name ?? null,
            senderNickname: raw.user_name ?? null,
            content: raw.content,
            type: raw.type,
            timestamp: raw.timestamp,
            replyToId: raw.reply_to_id ?? null,
            badge: raw.badge ?? null,
          })));
        }
      } catch { setConnectionStatus('Error'); setApiStatus('error'); }
    };
    connectAndLoad();
    return () => { disconnectSocket('chat'); setConnectionStatus('Disconnected'); setApiStatus('disconnected'); };
  }, [isAuthenticated]);

  // ── Presence hub ──
  useEffect(() => {
    if (!isAuthenticated) return;
    getSocket('presence'); // connect on mount
    return () => { disconnectSocket('presence'); };
  }, [isAuthenticated]);

  // ── Notification hub — conexión estable, refs para evitar reconexiones ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const nc = getSocket('notifications');

    nc.on('new_direct_message', ({ sender_id, sender_nick }: { sender_id: string; sender_nick: string }) => {
      const isViewingThisDM = chatModeRef.current === 'private' && privatePartnerRef.current === sender_id;
      if (isViewingThisDM) {
        privateChatService.getConversation(sender_id)
          .then(msgs => setPrivateMessages(sortAsc(msgs)))
          .catch(() => {});
        privateChatService.markConversationAsRead(sender_id).catch(() => {});
        return;
      }
      chatSounds.play('privateMessage');
      setPrivatesExpanded(true);
      setConversations(prev => {
        const existing = prev.find(c => c.userId === sender_id);
        const now = new Date().toISOString();
        if (existing) {
          return [...prev.map(c => c.userId === sender_id
            ? { ...c, unreadCount: c.unreadCount + 1, lastMessageTime: now }
            : c
          )].sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
        }
        return [{ userId: sender_id, nickname: sender_nick, lastMessage: '', lastMessageTime: now, unreadCount: 1 }, ...prev];
      });
      setTotalUnreadDMs(prev => prev + 1);
    });

    nc.on('private_message_deleted', ({ message_id }: { message_id: string }) => {
      setPrivateMessages(prev => prev.map(m =>
        m.id === message_id ? { ...m, isDeletedForEveryone: true, content: '' } : m
      ));
    });

    nc.on('kicked', () => {
      authService.logout().catch(() => { window.location.href = '/login'; });
    });

    nc.on('global_announcement', (data: { message: string; admin_nickname: string }) => {
      setGlobalMessages(prev => [...prev, {
        userId: 'system',
        userName: `📢 ${data.admin_nickname}`,
        content: data.message,
        timestamp: new Date().toISOString(),
        type: 'normal',
      } as import('../types/auth').Message]);
    });

    nc.on('announcement_banner_updated', (data: { message: string }) => {
      setAnnouncementMsg(data.message);
    });

    return () => {
      nc.off('new_direct_message');
      nc.off('private_message_deleted');
      nc.off('kicked');
      nc.off('global_announcement');
      nc.off('announcement_banner_updated');
      disconnectSocket('notifications');
    };
  }, [isAuthenticated]); // Solo se reconecta al login/logout — no al cambiar de modo

  // ── Room members + presence events ──
  useEffect(() => {
    if (!activeRoom || !isAuthenticated) return;
    const pc = getSocket('presence');
    pc.on('online_users_list', (users: { id: string; nickname: string; country_code?: string; show_flag?: boolean }[]) => {
      setOnlineUsers(users.map(u => ({ id: u.id, nickname: u.nickname, isOnline: true, countryCode: u.country_code, showFlag: u.show_flag })));
      setPresenceReady(true);
    });
    pc.on('user_online', (u: { id: string; nickname: string; country_code?: string; show_flag?: boolean }) => {
      setOnlineUsers(prev => {
        const exists = prev.some(x => x.id === u.id);
        if (exists) return prev.map(x => x.id === u.id ? { ...x, isOnline: true, countryCode: u.country_code, showFlag: u.show_flag } : x);
        return [...prev, { id: u.id, nickname: u.nickname, isOnline: true, countryCode: u.country_code, showFlag: u.show_flag }];
      });
      if (presenceReadyRef.current) chatSounds.play('join');
    });
    pc.on('user_offline', ({ user_id }: { user_id: string }) => {
      setOnlineUsers(prev => prev.map(u => u.id === user_id ? { ...u, isOnline: false } : u));
      if (presenceReadyRef.current) chatSounds.play('part');
    });
    pc.on('user_flag_updated', (data: { id: string; show_flag: boolean; country_code?: string }) =>
      setOnlineUsers(prev => prev.map(u => u.id === data.id ? { ...u, showFlag: data.show_flag, countryCode: data.country_code } : u))
    );
    pc.on('user_away_updated', (data: { user_id: string; away_message: string | null }) =>
      setOnlineUsers(prev => prev.map(u => u.id === data.user_id ? { ...u, awayMessage: data.away_message ?? undefined } : u))
    );
    pc.emit('join_presence_room', activeRoom);
    return () => {
      setPresenceReady(false);
      setOnlineUsers([]);
      pc.emit('leave_presence_room', activeRoom);
      pc.off('online_users_list');
      pc.off('user_online');
      pc.off('user_offline');
      pc.off('user_flag_updated');
      pc.off('user_away_updated');
    };
  }, [activeRoom, isAuthenticated]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, privateMessages]);

  // ── Handlers ──
  const handleClear = () => {
    if (chatMode === 'global') setGlobalMessages([]);
    else setPrivateMessages([]);
  };

  const handleBack = () => {
    const pc = getSocket('presence');
    pc.emit('clear_away');
    setIsAway(false);
    setAwayMessage('');
  };

  const handleAway = (msg: string) => {
    const pc = getSocket('presence');
    pc.emit('set_away', msg || 'Away');
    setIsAway(true);
    setAwayMessage(msg || 'Away');
  };

  const handleMe = (text: string) => {
    if (chatMode !== 'global' || !text.trim()) return;
    const conn = getSocket('chat');
    conn.emit('send_message', { room_id: activeRoom, content: text.trim(), type: 'action' });
  };

  const injectLocal = (content: string) => {
    setGlobalMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      userId: '',
      content,
      timestamp: new Date().toISOString(),
      type: 'system' as const,
    }]);
  };

  const handleNick = async (newNick: string) => {
    if (!newNick.trim()) { injectLocal('Usage: /nick <nickname>'); return; }
    if (nicknameChangesLeft === 0 && monetization.nickChangesLeftToday === 0) {
      chatSounds.play('error');
      injectLocal(t('cmd.nick.noChanges'));
      setShowRewardModal('nickname');
      return;
    }
    const trimmed = newNick.trim();
    if (trimmed.length < 2) {
      chatSounds.play('error');
      injectLocal(t('cmd.nick.tooShort'));
      return;
    }
    if (trimmed.length > 30) {
      chatSounds.play('error');
      injectLocal(t('cmd.nick.tooLong'));
      return;
    }
    try {
      const res = await api.put('/api/profile/nickname', { nickname: trimmed });
      setNicknameChangesLeft(res.data.changesLeft);
      const stored = localStorage.getItem('user');
      if (stored) { const p = JSON.parse(stored); p.nickname = trimmed; localStorage.setItem('user', JSON.stringify(p)); }
      refreshAuth();
      chatSounds.play('success');
      const left = res.data.changesLeft as number;
      injectLocal(t('cmd.nick.changed', { nick: trimmed, n: left, s: left !== 1 ? 's' : '' }));
    } catch (err: any) {
      chatSounds.play('error');
      injectLocal(err?.response?.data?.error ?? t('cmd.nick.error'));
    }
  };

  const handleJoin = (roomName: string) => {
    if (!roomName.trim()) { injectLocal('Usage: /join #roomname'); return; }
    const name = roomName.trim().startsWith('#') ? roomName.trim() : `#${roomName.trim()}`;
    const room = rooms.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (!room) {
      chatSounds.play('error');
      injectLocal(t('cmd.join.notFound', { name }));
      return;
    }
    chatSounds.play('join');
    injectLocal(t('cmd.join.joined', { name }));
    switchRoom(room.id);
  };

  const handleList = () => {
    if (rooms.length === 0) {
      injectLocal(t('cmd.list.header') + '\n' + t('chat.tooManyRooms'));
    } else {
      const lines = [
        t('cmd.list.header'),
        ...rooms.map(r => t('cmd.list.room', { name: r.name, desc: r.description || '' })),
      ];
      injectLocal(lines.join('\n'));
    }
  };

  const handleMsg = async (args: string) => {
    const spaceIdx = args.indexOf(' ');
    const nick = (spaceIdx === -1 ? args : args.slice(0, spaceIdx)).trim();
    const text = spaceIdx === -1 ? '' : args.slice(spaceIdx + 1).trim();
    if (!nick) { injectLocal('Usage: /msg <nick> [message]'); return; }
    const onlineUser = onlineUsers.find(u => u.nickname.toLowerCase() === nick.toLowerCase());
    if (!onlineUser) {
      chatSounds.play('error');
      injectLocal(t('cmd.msg.notFound', { name: nick }));
      return;
    }
    await startPrivateChat(onlineUser.id, onlineUser.nickname);
    chatSounds.play('privateMessage');
    injectLocal(t('cmd.msg.opened', { name: nick }));
    if (text) {
      try { await privateChatService.sendMessage(onlineUser.id, text); } catch { /* ignore */ }
    }
  };

  const handleHelp = () => {
    injectLocal(t('cmd.help.text'));
  };

  const loadMessages = async (roomId: string) => {
    const res = await api.get(`/api/rooms/${roomId}/messages`, { params: { take: 50 } });
    setGlobalMessages(res.data);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    const text = inputMessage.trim();

    // Slash commands
    if (text.startsWith('/')) {
      const spaceIdx = text.indexOf(' ');
      const cmd = (spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)).toLowerCase();
      const arg = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1);
      setInputMessage('');
      if (cmd === 'clear') { handleClear(); return; }
      if (cmd === 'back')  { await handleBack(); chatSounds.play('join'); return; }
      if (cmd === 'away')  { await handleAway(arg); chatSounds.play('part'); return; }
      if (cmd === 'me')    { await handleMe(arg); return; }
      if (cmd === 'nick')  { await handleNick(arg); return; }
      if (cmd === 'join')  { handleJoin(arg); return; }
      if (cmd === 'list')  { handleList(); return; }
      if (cmd === 'msg')   { await handleMsg(arg); return; }
      if (cmd === 'help')  { handleHelp(); return; }
      // Unknown slash command
      chatSounds.play('error');
      injectLocal(t('cmd.unknownCommand', { cmd }));
      return;
    }

    if (chatMode === 'global') {
      const conn = getSocket('chat');
      if (!conn.connected) { console.error('[Send] socket not connected'); return; }
      conn.emit('send_message', { room_id: activeRoom, content: inputMessage });
      chatSounds.play('messageSent');
      setInputMessage('');
    } else if (chatMode === 'private' && privatePartner) {
      try {
        const msg = await privateChatService.sendMessage(privatePartner, inputMessage);
        setPrivateMessages(prev => [...prev, msg]);
        chatSounds.play('privateMessage');
        const sentText = inputMessage;
        setInputMessage('');
        const now = new Date().toISOString();
        setConversations(prev => {
          const existing = prev.find(c => c.userId === privatePartner);
          const updated = { userId: privatePartner, nickname: partnerNickname, lastMessage: sentText, lastMessageTime: now, unreadCount: 0, avatarUrl: existing?.avatarUrl };
          if (existing) return [...prev.map(c => c.userId === privatePartner ? updated : c)].sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
          return [updated, ...prev];
        });
      } catch { /* ignore */ }
    }
  };

  const switchRoom = async (roomId: string) => {
    const alreadyHere = roomId === activeRoom && chatMode === 'global';
    setChatMode('global');
    setPrivatePartner('');
    setPrivatesExpanded(false);
    if (alreadyHere) return;
    const conn = getSocket('chat');
    if (activeRoom) conn.emit('leave_room', activeRoom);
    setActiveRoom(roomId);
    conn.emit('join_room', roomId);
    loadMessages(roomId);
  };

  const startPrivateChat = async (partnerId: string, nickname?: string) => {
    setPrivatePartner(partnerId);
    setPartnerNickname(nickname ?? onlineUsers.find(u => u.id === partnerId)?.nickname ?? '');
    setChatMode('private');
    const conv = conversations.find(c => c.userId === partnerId);
    setConversations(prev => prev.map(c => c.userId === partnerId ? { ...c, unreadCount: 0 } : c));
    setTotalUnreadDMs(prev => Math.max(0, prev - (conv?.unreadCount ?? 0)));
    privateChatService.markConversationAsRead(partnerId).catch(() => {});
    try {
      setPrivateMessages(sortAsc(await privateChatService.getConversation(partnerId)));
    } catch { setPrivateMessages([]); }
  };

  const handleDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    setDeleteMenu(null);
    // Optimistic update — UI first, API after
    if (forEveryone) {
      setPrivateMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isDeletedForEveryone: true, content: '' } : m
      ));
    } else {
      setPrivateMessages(prev => prev.filter(m => m.id !== messageId));
    }
    try {
      await privateChatService.deleteMessage(messageId, forEveryone);
    } catch (e) { console.error('[Delete]', e); }
  };

  const createRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    setCreateRoomError('');
    const fullName = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    try {
      const r = await roomService.createRoom({
        name: fullName, description: newRoomDescription,
        isPrivate: newRoomIsPrivate,
        password: newRoomIsPrivate ? newRoomPassword : undefined,
      });
      setRooms(prev => [...prev, { id: r.id, name: r.name, description: r.description || '', createdById: user?.id }]);
      monetization.grantBoostToken(r.id);
      await switchRoom(r.id);
      setShowCreateRoom(false);
      setNewRoomName(''); setNewRoomDescription('');
      setNewRoomIsPrivate(false); setNewRoomPassword('');
      setCreateRoomError('');
      // Track free or ad-unlocked slot usage
      if (monetization.hasActiveRoomSlot) monetization.consumeRoomSlot();
      else monetization.consumeFreeRoom();
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'ACTIVE_LIMIT' || code === 'DAILY_LIMIT') {
        setShowCreateRoom(false);
        setShowRewardModal('room');
        return;
      }
      const errorMessages: Record<string, string> = {
        INVALID_NAME:       t('chat.roomNameInvalid'),
        NAME_TAKEN:         t('chat.roomNameTaken'),
        CREATION_DISABLED:  t('chat.tooManyRooms'),
      };
      setCreateRoomError(errorMessages[code ?? ''] ?? t('chat.tooManyRooms'));
    }
  };

  const onEmojiClick = useCallback((data: EmojiClickData) => {
    setInputMessage(prev => prev + data.emoji);
  }, []);

  const toggleFlag = async (enabled: boolean) => {
    setDetectingFlag(true);
    setFlagError('');
    try {
      let code = countryCode;
      if (enabled && !code) {
        // Try multiple geo providers in order
        const providers = [
          () => fetch('https://ipapi.co/json/').then(r => r.json()).then(d => d.country_code),
          () => fetch('https://api.country.is/').then(r => r.json()).then(d => d.country),
          () => fetch('https://ipwho.is/').then(r => r.json()).then(d => d.country_code),
        ];
        for (const provider of providers) {
          try {
            const result = await provider();
            if (result && typeof result === 'string' && result.length === 2) {
              code = result.toUpperCase();
              break;
            }
          } catch { continue; }
        }
        if (!code) throw new Error('geo_failed');
        setCountryCode(code);
      }
      await api.put('/api/profile/flag', { show_flag: enabled, country_code: enabled ? code : null });
      setShowFlag(enabled);
    } catch (err: any) {
      if (err?.message === 'geo_failed' || err?.response == null) {
        setFlagError('No se pudo detectar el país. Intentá de nuevo más tarde.');
      } else {
        setFlagError('Error al actualizar la bandera.');
      }
    } finally {
      setDetectingFlag(false);
    }
  };

  const openNicknameModal = () => {
    setNewNickname(user?.nickname ?? '');
    setNicknameError('');
    setShowNicknameModal(true);
  };

  const saveNickname = async () => {
    const trimmed = newNickname.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setNicknameError(t('cmd.nick.tooShort'));
      return;
    }
    setNicknameSaving(true);
    setNicknameError('');
    try {
      const res = await api.put('/api/profile/nickname', { nickname: trimmed });
      setNicknameChangesLeft(res.data.changesLeft ?? 0);
      monetization.consumeNickChange();
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.nickname = trimmed;
        localStorage.setItem('user', JSON.stringify(parsed));
      }
      refreshAuth();
      setShowNicknameModal(false);
    } catch (err: any) {
      setNicknameError(err?.response?.data?.error ?? t('cmd.nick.error'));
    } finally {
      setNicknameSaving(false);
    }
  };

  const handleWatchAd = async () => {
    setIsWatchingAd(true);
    setAdGrantFailed(false);

    const granted = await showRewardedAd();
    if (!granted) {
      setIsWatchingAd(false);
      setAdGrantFailed(true);
      return;
    }

    if (showRewardModal === 'nickname') {
      try {
        const res = await api.post('/api/profile/nick-ad-unlock');
        monetization.watchAdForNickChange(new Date(res.data.unlockedUntil).getTime());
      } catch {
        monetization.watchAdForNickChange(Date.now() + 12 * 60 * 60 * 1000);
      }
      setIsWatchingAd(false);
      setShowRewardModal(null);
      openNicknameModal();
    } else if (showRewardModal === 'boost' && pendingBoostRoomId) {
      const roomId = pendingBoostRoomId;
      monetization.grantBoostToken(roomId);
      monetization.consumeBoostToken(roomId);
      setIsWatchingAd(false);
      setShowRewardModal(null);
      setPendingBoostRoomId(null);
      const conn = getSocket('chat');
      conn.emit('boost_room', roomId);
    } else {
      setIsWatchingAd(false);
      setShowRewardModal(null);
    }
  };

  const handleSetLanguage = (lang: SupportedLanguage | 'auto') => {
    setLanguage(lang);
    api.put('/api/profile/preferences', {
      preferredLanguage: lang,
      timezone,
    }).catch(() => {});
  };

  if (loading || !isAuthenticated || !user) return null;

  const sortedRooms = useMemo(() =>
    [...rooms].sort((a, b) =>
      (activeBoost?.roomId === b.id ? 1 : 0) - (activeBoost?.roomId === a.id ? 1 : 0)
    ),
    [rooms, activeBoost] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const partnerNick  = partnerNickname || onlineUsers.find(u => u.id === privatePartner)?.nickname || conversations.find(c => c.userId === privatePartner)?.nickname || privatePartner;
  const deleteMenuMsg = deleteMenu ? privateMessages.find(m => m.id === deleteMenu.msgId) : null;
  const canDeleteForEveryone = !!(deleteMenuMsg && deleteMenuMsg.sender_id === user?.id && !deleteMenuMsg.is_deleted_for_everyone && (Date.now() - new Date(deleteMenuMsg.timestamp).getTime()) < 15 * 60 * 1000);
  const onlineCount  = onlineUsers.filter(u => u.isOnline).length;
  const isConnected  = connectionStatus === 'Connected';
  const isDark       = theme === 'dark';
  const isAdmin      = user?.isAdmin === true;
  const activeRoomData  = rooms.find(r => r.id === activeRoom);
  const activeRoomName  = activeRoomData?.name ?? '—';
  const activeRoomDesc  = activeRoomData?.description ?? '';
  const activeRoomOwner = activeRoomData?.createdById === user?.id;

  // Dot glow in dark mode (online users / my status)
  const dotGlow = isDark ? '0 0 6px var(--ch-online-dot)' : 'none';

  // ── Render ──
  return (
    <div
      data-theme={theme}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, background: 'var(--ch-bg)', color: 'var(--ch-text)' }}
      className="h-screen flex flex-col overflow-hidden"
    >
      {/* Phosphor cursor glow overlay */}
      <div ref={cursorGlowRef} className="cursor-glow" />

      {/* ── HEADER ── */}
      <header style={{
        background: 'var(--ch-header)',
        borderBottom: '1px solid var(--ch-border-2)',
        height: 44, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, letterSpacing: '0.01em', fontSize: 14, color: 'var(--ch-text)' }}>
            opn·chat
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span title={`API: ${apiStatus}`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: apiStatus === 'connected' ? 'var(--ch-online-dot)' : apiStatus === 'error' ? '#ef4444' : '#6b7280',
                boxShadow: apiStatus === 'connected' && isDark ? '0 0 5px var(--ch-online-dot)' : 'none',
                animation: apiStatus === 'connected' ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: 'var(--ch-text-3)', letterSpacing: '0.05em' }}>api</span>
            </span>
            <span style={{ width: 1, height: 10, background: 'var(--ch-border)', flexShrink: 0 }} />
            <span title={`Socket.IO: ${isConnected ? 'connected' : connectionStatus}`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: isConnected ? 'var(--ch-online-dot)' : '#ef4444',
                boxShadow: isConnected && isDark ? '0 0 5px var(--ch-online-dot)' : 'none',
                animation: isConnected ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: 'var(--ch-text-3)', letterSpacing: '0.05em' }}>socket.io</span>
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {chatMode === 'private' && (
            <button
              onClick={() => { setChatMode('global'); setPrivatePartner(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ch-text-2)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: 5,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ch-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ch-text-2)')}
            >
              <IconBack /> {t('chat.global')}
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? t('chat.lightMode') : t('chat.darkMode')}
            style={{
              background: 'none',
              border: '1px solid var(--ch-border-2)',
              borderRadius: 6, cursor: 'pointer',
              color: 'var(--ch-text-2)',
              padding: '5px 8px',
              display: 'flex', alignItems: 'center',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ch-accent)'; e.currentTarget.style.color = 'var(--ch-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ch-border-2)'; e.currentTarget.style.color = 'var(--ch-text-2)'; }}
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>

          <button
            onClick={() => authService.logout().then(() => navigate('/login'))}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ch-text-2)', fontSize: 12,
              padding: '4px 8px', borderRadius: 5,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ch-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ch-text-2)')}
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* ── GLOBAL ANNOUNCEMENT BANNER ── */}
      {announcementMsg && (
        <GlobalAnnouncementBanner
          id={`banner-${announcementMsg.slice(0, 16)}`}
          message={announcementMsg}
          type="event"
          animation="ticker"
          isDark={isDark}
          onDismiss={() => monetization.dismissAnnouncement(`banner-${announcementMsg.slice(0, 16)}`)}
          isDismissed={monetization.isAnnouncementDismissed(`banner-${announcementMsg.slice(0, 16)}`)}
          onRoomClick={(roomName) => {
            const found = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
            if (found) switchRoom(found.id);
          }}
        />
      )}

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Rooms + Privates */}
        <aside style={{
          width: 185,
          background: 'var(--ch-bg-2)',
          borderRight: '1px solid var(--ch-border)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            background: 'var(--ch-bg-3)',
            borderBottom: '1px solid var(--ch-border)',
            padding: '7px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--ch-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('chat.rooms')}
            </span>
            <button
              onClick={() => monetization.canCreateRoom ? setShowCreateRoom(true) : setShowRewardModal('room')}
              title={t('chat.newRoom')}
              style={{
                width: 18, height: 18, borderRadius: 4,
                background: 'var(--ch-accent)', color: 'var(--ch-btn-text)',
                fontSize: 15, lineHeight: 1, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
              }}
            >+</button>
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {sortedRooms.map(room => {
              const active      = chatMode === 'global' && activeRoom === room.id;
              const boosted     = activeBoost?.roomId === room.id;
              const isOwner     = room.createdById === user?.id;
              const globalBoostActive = !!activeBoost && !isAdmin;
              return (
                <div key={room.id}
                  onMouseEnter={() => setHoveredRoom(room.id)}
                  onMouseLeave={() => setHoveredRoom(null)}
                >
                  <button onClick={() => switchRoom(room.id)} style={{
                    width: '100%', textAlign: 'left',
                    padding: '6px 12px',
                    paddingLeft: active ? 10 : 12,
                    border: 'none',
                    borderLeft: active
                      ? '2px solid var(--ch-accent)'
                      : boosted
                        ? '2px solid var(--ch-boost-border)'
                        : '2px solid transparent',
                    cursor: 'pointer',
                    background: active
                      ? 'var(--ch-accent-dim)'
                      : boosted
                        ? 'var(--ch-boost-bg)'
                        : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 7,
                    color: active ? 'var(--ch-accent)' : 'var(--ch-text-2)',
                    transition: 'background 0.1s ease, color 0.1s ease',
                  }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = boosted ? 'var(--ch-boost-bg)' : 'var(--ch-hover)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = boosted ? 'var(--ch-boost-bg)' : 'transparent'; }}
                  >
                    <IconHash />
                    <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {room.name}
                    </span>
                    {boosted && (
                      <span className="ch-boost-badge" style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ch-accent)', flexShrink: 0 }}>
                        BOOST
                      </span>
                    )}
                  </button>
                  {hoveredRoom === room.id && (
                    <RoomBoostCard
                      roomId={room.id}
                      isBoosted={boosted}
                      boostExpiry={activeBoost?.roomId === room.id ? activeBoost.expiresAt : null}
                      isDark={isDark}
                      isOwner={isOwner}
                      globalBoostActive={globalBoostActive}
                      onBoost={() => { setPendingBoostRoomId(room.id); setShowRewardModal('boost'); }}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          <div style={{ borderTop: '1px solid var(--ch-border)', padding: '5px 12px', fontSize: 10, color: 'var(--ch-text-3)' }}>
            {t('chat.roomCount', { n: rooms.length, s: rooms.length !== 1 ? 's' : '' })}
          </div>

          {/* ── Privates section ── */}
          <div style={{ borderTop: '1px solid var(--ch-border)', flexShrink: 0 }}>
            <button
              onClick={() => setPrivatesExpanded(v => !v)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: 'var(--ch-bg-3)',
                padding: '7px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--ch-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {t('chat.privates')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {totalUnreadDMs > 0 && (
                  <span style={{
                    background: '#F02849', color: '#fff',
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    height: 18, minWidth: 18, borderRadius: 9,
                    padding: '0 5px', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}>
                    {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
                  </span>
                )}
                <span style={{ fontSize: 9, color: 'var(--ch-text-3)' }}>{privatesExpanded ? '▾' : '▸'}</span>
              </div>
            </button>

            {privatesExpanded && (
              <div style={{ overflowY: 'auto', maxHeight: 200 }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--ch-text-3)', fontStyle: 'italic' }}>
                    {t('chat.noConversations')}
                  </div>
                ) : conversations.map(conv => {
                  const isActive = chatMode === 'private' && privatePartner === conv.userId;
                  return (
                    <button
                      key={conv.userId}
                      onClick={() => startPrivateChat(conv.userId, conv.nickname)}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none',
                        padding: '5px 12px',
                        paddingLeft: isActive ? 10 : 12,
                        borderLeft: isActive ? '2px solid var(--ch-accent)' : '2px solid transparent',
                        background: isActive ? 'var(--ch-accent-dim)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 7,
                        color: isActive ? 'var(--ch-accent)' : 'var(--ch-text-2)',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--ch-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <IconUser />
                      <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400 }}>
                        {conv.nickname}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{
                          background: '#F02849', color: '#fff',
                          fontSize: 11, fontWeight: 700, lineHeight: 1,
                          height: 18, minWidth: 18, borderRadius: 9,
                          padding: '0 5px', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          boxSizing: 'border-box', flexShrink: 0,
                        }}>
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER — Messages */}
        <main style={{ flex: 1, background: 'var(--ch-bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Channel bar */}
          <div style={{
            background: 'var(--ch-bg-2)',
            borderBottom: '1px solid var(--ch-border)',
            padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            {/* LEFT: canal / DM */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {chatMode === 'private' ? (
                <>
                  <span style={{ color: 'var(--ch-text-3)' }}><IconUser /></span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ch-text)' }}>
                    {user?.nickname ?? '—'}
                    <span style={{ fontWeight: 400, color: 'var(--ch-text-3)', margin: '0 5px' }}>·</span>
                    {partnerNick}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--ch-accent)', opacity: 0.6 }}><IconHash /></span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ch-text)' }}>{activeRoomName}</span>
                  {activeRoomDesc && (
                    <span style={{ fontSize: 11, color: 'var(--ch-text-3)', marginLeft: 2 }}>· {activeRoomDesc}</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--ch-text-2)', marginLeft: 2 }}>· {t('chat.onlineCount', { n: onlineCount })}</span>
                </>
              )}
            </div>

            {/* RIGHT: íconos de acción (solo en modo global) */}
            {chatMode === 'global' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

                {/* ── ADS ICON: visible cuando nicknameChangesLeft === 0 ── */}
                {nicknameChangesLeft === 0 && (() => {
                  const inCooldown = monetization.nickAdExpiry !== null && monetization.nickAdExpiry > Date.now();
                  const cooldownMs = inCooldown && monetization.nickAdExpiry ? monetization.nickAdExpiry - Date.now() : 0;
                  const cooldownH  = Math.floor(cooldownMs / 3_600_000);
                  const cooldownM  = Math.floor((cooldownMs % 3_600_000) / 60_000);
                  return (
                    <button
                      onClick={inCooldown ? undefined : () => setShowRewardModal('nickname')}
                      title={inCooldown
                        ? t('monetize.adsIconCooldown', { h: cooldownH, m: cooldownM })
                        : t('monetize.adsIconTitle')}
                      style={{
                        background: 'none',
                        border: '1px solid var(--ch-border-2)',
                        borderRadius: 6, cursor: inCooldown ? 'not-allowed' : 'pointer',
                        color: inCooldown ? 'var(--ch-text-3)' : 'var(--ch-text-2)',
                        padding: '4px 7px',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 500,
                        opacity: inCooldown ? 0.5 : 1,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { if (!inCooldown) { e.currentTarget.style.borderColor = 'var(--ch-accent)'; e.currentTarget.style.color = 'var(--ch-accent)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ch-border-2)'; e.currentTarget.style.color = inCooldown ? 'var(--ch-text-3)' : 'var(--ch-text-2)'; }}
                    >
                      📺
                    </button>
                  );
                })()}

                {/* ── BOOST ICON: visible para el owner del room activo ── */}
                {activeRoomOwner && (() => {
                  const isBoosted   = activeBoost?.roomId === activeRoom;
                  const hasToken    = monetization.hasBoostToken(activeRoom);
                  const otherBoosted = !!activeBoost && !isBoosted;
                  const blocked     = otherBoosted && !isAdmin;

                  const minsLeft = isBoosted && activeBoost
                    ? Math.max(0, Math.ceil((activeBoost.expiresAt - Date.now()) / 60_000))
                    : 0;

                  const handleBoostClick = () => {
                    if (blocked || isBoosted) return;
                    if (hasToken) {
                      monetization.consumeBoostToken(activeRoom);
                      getSocket('chat').emit('boost_room', activeRoom);
                    } else {
                      setPendingBoostRoomId(activeRoom);
                      setShowRewardModal('boost');
                    }
                  };

                  return (
                    <button
                      onClick={handleBoostClick}
                      disabled={blocked || isBoosted}
                      title={
                        isBoosted  ? t('monetize.boostActive', { m: minsLeft }) :
                        blocked    ? t('monetize.boostBlocked') :
                        hasToken   ? t('monetize.boostChannelTitle') :
                                     t('monetize.boostNoToken')
                      }
                      style={{
                        background: 'none',
                        border: `1px solid ${isBoosted ? 'var(--ch-accent)' : blocked ? 'var(--ch-border)' : 'var(--ch-border-2)'}`,
                        borderRadius: 6,
                        cursor: blocked || isBoosted ? 'not-allowed' : 'pointer',
                        color: isBoosted ? 'var(--ch-accent)' : blocked ? 'var(--ch-text-3)' : 'var(--ch-text-2)',
                        padding: '4px 7px',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: isBoosted ? 700 : 500,
                        opacity: blocked ? 0.45 : 1,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { if (!blocked && !isBoosted) { e.currentTarget.style.borderColor = 'var(--ch-accent)'; e.currentTarget.style.color = 'var(--ch-accent)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = isBoosted ? 'var(--ch-accent)' : blocked ? 'var(--ch-border)' : 'var(--ch-border-2)'; e.currentTarget.style.color = isBoosted ? 'var(--ch-accent)' : blocked ? 'var(--ch-text-3)' : 'var(--ch-text-2)'; }}
                    >
                      {isBoosted ? `🏆 ${minsLeft}m` : '⚡'}
                    </button>
                  );
                })()}

              </div>
            )}
          </div>

          {/* Message log */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', background: 'var(--ch-bg)' }}>
            {(chatMode === 'global' ? globalMessages : privateMessages).length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 64, color: 'var(--ch-text-2)' }}>
                <div style={{ fontSize: 13 }}>{t('chat.noMessages')}</div>
              </div>
            ) : chatMode === 'global' ? (
              globalMessages.map((msg, i) => {
                const isMe = msg.userId === user.id;
                const isAction = msg.type === 'action';
                const isSystem = msg.type === 'system';
                const nick = isMe ? (user.nickname ?? t('chat.you')) : (msg.userName ?? 'User');
                return (
                  <div key={i} style={{
                    padding: '3px 16px',
                    background: i % 2 === 0 ? 'var(--ch-bg)' : 'var(--ch-bg-2)',
                    display: 'flex', alignItems: 'baseline', gap: 8,
                  }}>
                    <span style={{ color: 'var(--ch-text-3)', fontSize: 10, flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                      {formatDate(msg.timestamp, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isSystem ? (
                      <span style={{ fontSize: 12, color: 'var(--ch-text-3)', fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.55 }}>
                        — {msg.content}
                      </span>
                    ) : isAction ? (
                      <span style={{ fontSize: 13, color: 'var(--ch-text-2)', fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.55 }}>
                        * <strong style={{ color: isMe ? 'var(--ch-me)' : nickColor(msg.userId ?? ''), fontStyle: 'normal' }}>{nick}</strong> {msg.content}
                      </span>
                    ) : (
                      <>
                        {getBadgeLabel(msg.badge, msg.createdAt) && (
                          <span title={msg.badge ?? 'early user'} style={{ fontSize: 9, color: 'var(--ch-accent)', fontFamily: "'DM Mono', monospace", flexShrink: 0, opacity: 0.85 }}>
                            [{getBadgeLabel(msg.badge, msg.createdAt)}]
                          </span>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 12, flexShrink: 0, color: isMe ? 'var(--ch-me)' : nickColor(msg.userId ?? '') }}>
                          {nick}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--ch-text)', wordBreak: 'break-word', lineHeight: 1.55 }}>
                          {parseFormatting(msg.content)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              privateMessages.map((msg, i) => {
                const isMe = msg.sender_id === user.id;
                const isDeleted = !!msg.is_deleted_for_everyone;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredMsg(msg.id)}
                    onMouseLeave={() => setHoveredMsg(null)}
                    style={{
                      padding: '3px 16px',
                      background: i % 2 === 0 ? 'var(--ch-bg)' : 'var(--ch-bg-2)',
                      display: 'flex', alignItems: 'baseline', gap: 8,
                      position: 'relative',
                    }}
                  >
                    <span style={{ color: 'var(--ch-text-3)', fontSize: 10, flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                      {formatDate(msg.timestamp, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isDeleted ? (
                      <span style={{ fontSize: 13, color: 'var(--ch-text-3)', fontStyle: 'italic' }}>
                        {t('chat.thisDeleted')}
                      </span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, fontSize: 12, flexShrink: 0, color: isMe ? 'var(--ch-me)' : nickColor(msg.sender_id ?? '') }}>
                          {isMe
                            ? `${user.nickname ?? t('chat.you')} (${t('chat.you')})`
                            : partnerNick}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--ch-text)', wordBreak: 'break-word', lineHeight: 1.55 }}>
                          {parseFormatting(msg.content)}
                        </span>
                      </>
                    )}
                    {!isDeleted && hoveredMsg === msg.id && (
                      <button
                        onMouseDown={e => { e.stopPropagation(); setDeleteMenu({ msgId: msg.id, x: e.clientX, y: e.clientY }); }}
                        style={{
                          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'var(--ch-bg-3)', border: '1px solid var(--ch-border)',
                          borderRadius: 4,
                          cursor: 'pointer', color: 'var(--ch-text-3)', fontSize: 13, lineHeight: 1, padding: '4px 6px',
                        display: 'flex', alignItems: 'center',
                        }}
                        title={t('chat.deleteMessage')}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input row */}
          <div style={{
            borderTop: '1px solid var(--ch-border)',
            background: 'var(--ch-bg-2)',
            padding: '8px 12px', display: 'flex', gap: 8, position: 'relative',
          }}>
            {showEmojiPicker && (
              <div ref={emojiPickerRef} style={{
                position: 'absolute', bottom: '100%', left: 8, zIndex: 1000,
                marginBottom: 4, borderRadius: 10, overflow: 'hidden',
                boxShadow: isDark
                  ? '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              }}>
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={isDark ? Theme.DARK : Theme.LIGHT}
                  lazyLoadEmojis
                  searchPlaceholder={t('chat.searchEmoji')}
                  width={300}
                  height={370}
                />
              </div>
            )}

            <button
              ref={emojiBtnRef}
              onClick={() => setShowEmojiPicker(v => !v)}
              title="Emoji"
              style={{
                background: showEmojiPicker ? 'var(--ch-accent-dim)' : 'none',
                border: '1px solid var(--ch-border-2)',
                borderRadius: 6, padding: '5px 8px',
                cursor: 'pointer',
                color: showEmojiPicker ? 'var(--ch-accent)' : 'var(--ch-text-2)',
                display: 'flex', alignItems: 'center',
                transition: 'background 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={e => { if (!showEmojiPicker) e.currentTarget.style.background = 'var(--ch-hover)'; }}
              onMouseLeave={e => { if (!showEmojiPicker) e.currentTarget.style.background = 'none'; }}
            >
              <IconEmoji />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={chatMode === 'private' ? t('chat.messageName', { name: partnerNick }) : t('chat.typeMessage')}
              className="ch-input"
              style={{
                flex: 1,
                border: '1px solid var(--ch-border-2)',
                borderRadius: 6, padding: '6px 12px',
                fontSize: 13, background: 'var(--ch-input-bg)',
                color: 'var(--ch-text)', fontFamily: 'inherit',
              }}
            />

            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
              style={{
                background: inputMessage.trim() ? 'var(--ch-btn-active)' : 'var(--ch-border)',
                color: inputMessage.trim() ? 'var(--ch-btn-text)' : 'var(--ch-text-3)',
                border: 'none', borderRadius: 6,
                padding: '6px 16px', fontSize: 12, fontWeight: 600,
                cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              <IconSend /> {t('common.send')}
            </button>
          </div>
        </main>

        {/* RIGHT — Buddy List */}
        <aside style={{
          width: 172,
          background: 'var(--ch-bg-2)',
          borderLeft: '1px solid var(--ch-border)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            background: 'var(--ch-bg-3)',
            borderBottom: '1px solid var(--ch-border)',
            padding: '7px 12px',
          }}>
            <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--ch-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('chat.online')}
            </span>
          </div>

          {onlineUsers.some(u => u.isOnline) && (
            <div style={{ padding: '6px 0 2px' }}>
              <div style={{ padding: '0 12px 3px', fontSize: 9, fontWeight: 600, color: 'var(--ch-online-dot)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('chat.active', { n: onlineUsers.filter(u => u.isOnline).length })}
              </div>
              {onlineUsers.filter(u => u.isOnline).map(u => (
                <button key={u.id} onClick={() => startPrivateChat(u.id, u.nickname)} style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  background: 'transparent', padding: '4px 12px',
                  display: 'flex', flexDirection: 'column', gap: 1,
                  color: 'var(--ch-text)', transition: 'background 0.1s ease',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ch-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.awayMessage ? 'var(--ch-offline-dot)' : 'var(--ch-online-dot)', flexShrink: 0, display: 'block', boxShadow: u.awayMessage ? 'none' : dotGlow }} />
                    {getBadgeLabel(u.badge, u.createdAt) && (
                      <span title={u.badge ?? 'early user'} style={{ fontSize: 9, color: 'var(--ch-accent)', fontFamily: "'DM Mono', monospace", flexShrink: 0, opacity: 0.85 }}>
                        [{getBadgeLabel(u.badge, u.createdAt)}]
                      </span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {u.nickname}
                    </span>
                    {u.showFlag && u.countryCode && (
                      <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1 }} title={u.countryCode}>
                        {toFlagEmoji(u.countryCode)}
                      </span>
                    )}
                  </div>
                  {u.awayMessage && (
                    <div style={{ paddingLeft: 15, fontSize: 10, color: 'var(--ch-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('chat.awayHint', { msg: u.awayMessage })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {onlineUsers.some(u => !u.isOnline) && (
            <div style={{ padding: '6px 0 2px' }}>
              <div style={{ padding: '0 12px 3px', fontSize: 9, fontWeight: 600, color: 'var(--ch-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('chat.away', { n: onlineUsers.filter(u => !u.isOnline).length })}
              </div>
              {onlineUsers.filter(u => !u.isOnline).map(u => (
                <button key={u.id} onClick={() => startPrivateChat(u.id, u.nickname)} style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  background: 'transparent', padding: '4px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: 'var(--ch-text-2)', transition: 'background 0.1s ease',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ch-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ch-offline-dot)', flexShrink: 0, display: 'block' }} />
                  <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {u.nickname}
                  </span>
                  {u.showFlag && u.countryCode && (
                    <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1 }} title={u.countryCode}>
                      {toFlagEmoji(u.countryCode)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {onlineUsers.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--ch-text-2)', textAlign: 'center', marginTop: 20, padding: '0 12px' }}>
              {presenceReady ? t('chat.noOneOnline') : t('chat.connecting')}
            </p>
          )}

          {/* My status */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--ch-border)', padding: '8px 12px' }}>
            <button
              onClick={openNicknameModal}
              title={nicknameChangesLeft > 0 ? t('chat.changesLeft', { n: nicknameChangesLeft, s: nicknameChangesLeft !== 1 ? 's' : '' }) : t('chat.changesExhausted')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: nicknameChangesLeft > 0 ? 'pointer' : 'default', padding: 0, textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: isAway ? 'var(--ch-offline-dot)' : 'var(--ch-online-dot)', display: 'block', flexShrink: 0, boxShadow: isAway ? 'none' : dotGlow }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ch-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {user.nickname ?? user.email}
                </span>
                {nicknameChangesLeft > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ch-text-3)', flexShrink: 0 }}>✎</span>
                )}
              </div>
              {isAway ? (
                <div style={{ fontSize: 9, color: 'var(--ch-text-3)', marginTop: 2, paddingLeft: 14 }}>
                  {t('chat.awayHint', { msg: awayMessage })} · {t('cmd.back.returned')}
                </div>
              ) : nicknameChangesLeft > 0 && (
                <div style={{ fontSize: 9, color: 'var(--ch-text-3)', marginTop: 2, paddingLeft: 14 }}>
                  {t('chat.changesLeft', { n: nicknameChangesLeft, s: nicknameChangesLeft !== 1 ? 's' : '' })}
                </div>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* ── DELETE MENU ── */}
      {deleteMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', zIndex: 2000,
            left: Math.min(deleteMenu.x, window.innerWidth - 175),
            top: Math.min(deleteMenu.y, window.innerHeight - 80),
            background: 'var(--ch-modal-bg)',
            border: '1px solid var(--ch-border-2)',
            borderRadius: 6, padding: '4px 0',
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' : '0 4px 20px rgba(0,0,0,0.2)',
            minWidth: 165,
          }}
        >
          <button
            onClick={() => handleDeleteMessage(deleteMenu.msgId, false)}
            style={{
              width: '100%', textAlign: 'left', border: 'none',
              background: 'transparent', padding: '7px 14px',
              cursor: 'pointer', fontSize: 12, color: 'var(--ch-text)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ch-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {t('chat.deleteForMe')}
          </button>
          {canDeleteForEveryone && (
            <button
              onClick={() => handleDeleteMessage(deleteMenu.msgId, true)}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                background: 'transparent', padding: '7px 14px',
                cursor: 'pointer', fontSize: 12, color: 'var(--ch-error)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ch-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {t('chat.deleteForAll')}
            </button>
          )}
        </div>
      )}

      {/* ── CREATE ROOM MODAL ── */}
      {showCreateRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: 'var(--ch-modal-bg)',
            borderRadius: 10, width: 360, padding: 24,
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)' : '0 16px 48px rgba(0,0,0,0.2)',
            border: '1px solid var(--ch-border-2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ch-text)' }}>{t('chat.createRoom')}</span>
              <button onClick={() => setShowCreateRoom(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ch-text-2)', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--ch-text-2)', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {t('chat.roomName')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <span style={{
                    padding: '7px 10px', fontSize: 13, fontWeight: 700,
                    background: 'var(--ch-bg-3)', border: '1px solid var(--ch-border-2)',
                    borderRight: 'none', borderRadius: '6px 0 0 6px',
                    color: 'var(--ch-accent)', fontFamily: "'DM Mono', monospace", lineHeight: 1,
                  }}>#</span>
                  <input
                    type="text" value={newRoomName}
                    onChange={e => { setNewRoomName(e.target.value.replace(/^#+/, '')); setCreateRoomError(''); }}
                    onKeyDown={e => e.key === 'Enter' && createRoom()}
                    placeholder="my-room" className="ch-input"
                    style={{ ...modalInput, borderRadius: '0 6px 6px 0', flex: 1 }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--ch-text-3)', marginTop: 4, display: 'block' }}>
                  Lowercase letters, numbers, - and _. Min 3, max 30 chars.
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--ch-text-2)', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {t('chat.description')}
                </label>
                <input type="text" value={newRoomDescription} onChange={e => setNewRoomDescription(e.target.value)}
                  placeholder="Optional" className="ch-input" style={modalInput} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ch-text)' }}>
                <input type="checkbox" checked={newRoomIsPrivate} onChange={e => setNewRoomIsPrivate(e.target.checked)} />
                {t('chat.privateRoom')}
              </label>
              {newRoomIsPrivate && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--ch-text-2)', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Password
                  </label>
                  <input type="password" value={newRoomPassword} onChange={e => setNewRoomPassword(e.target.value)}
                    className="ch-input" style={modalInput} />
                </div>
              )}
              {createRoomError && (
                <span style={{ fontSize: 11, color: 'var(--ch-error)', lineHeight: 1.4 }}>{createRoomError}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => { setShowCreateRoom(false); setCreateRoomError(''); }} style={{
                padding: '7px 16px', fontSize: 12, background: 'var(--ch-bg-3)',
                border: '1px solid var(--ch-border-2)', borderRadius: 6,
                cursor: 'pointer', color: 'var(--ch-text-2)', fontFamily: 'inherit',
              }}>
                {t('common.cancel')}
              </button>
              <button onClick={createRoom} disabled={!newRoomName.trim()} style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 600,
                borderRadius: 6, border: 'none',
                cursor: newRoomName.trim() ? 'pointer' : 'not-allowed',
                background: newRoomName.trim() ? 'var(--ch-btn-active)' : 'var(--ch-border)',
                color: newRoomName.trim() ? 'var(--ch-btn-text)' : 'var(--ch-text-3)',
                fontFamily: 'inherit',
              }}>
                {t('chat.createRoom')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REWARD MODAL (ad unlock) ── */}
      {showRewardModal && (
        <RewardModal
          type={showRewardModal}
          isDark={isDark}
          onWatchAd={handleWatchAd}
          onClose={() => { setShowRewardModal(null); setAdGrantFailed(false); }}
          isWatchingAd={isWatchingAd}
          adFailed={adGrantFailed}
        />
      )}

      {/* ── USER SETTINGS MODAL ── */}
      {showNicknameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: 'var(--ch-modal-bg)',
            borderRadius: 10, width: 340, padding: 24,
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)' : '0 16px 48px rgba(0,0,0,0.2)',
            border: '1px solid var(--ch-border-2)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ch-text)' }}>{t('chat.userSettings')}</span>
              <button onClick={() => setShowNicknameModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ch-text-2)', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
            </div>

            {/* Nickname row */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--ch-text-2)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                NICKNAME
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={newNickname}
                  onChange={e => { setNewNickname(e.target.value); setNicknameError(''); }}
                  onKeyDown={e => e.key === 'Enter' && saveNickname()}
                  maxLength={30}
                  autoFocus
                  className="ch-input"
                  style={{ ...modalInput, flex: 1 }}
                />
                <button
                  onClick={() => {
                    if (monetization.nickChangesLeftToday === 0) {
                      setShowNicknameModal(false);
                      setShowRewardModal('nickname');
                    } else {
                      saveNickname();
                    }
                  }}
                  disabled={nicknameSaving || !newNickname.trim()}
                  style={{
                    padding: '0 14px', fontSize: 12, fontWeight: 600,
                    borderRadius: 6, border: 'none', flexShrink: 0,
                    cursor: nicknameSaving || !newNickname.trim() ? 'not-allowed' : 'pointer',
                    background: nicknameSaving || !newNickname.trim() ? 'var(--ch-border)' : 'var(--ch-btn-active)',
                    color: nicknameSaving || !newNickname.trim() ? 'var(--ch-text-3)' : 'var(--ch-btn-text)',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  {nicknameSaving ? '...' : t('common.save')}
                </button>
              </div>
              {nicknameError && (
                <p style={{ fontSize: 11, color: 'var(--ch-error)', marginTop: 5 }}>{nicknameError}</p>
              )}
              <p style={{ fontSize: 10, color: monetization.nickChangesLeftToday === 0 ? 'var(--ch-error)' : 'var(--ch-text-3)', marginTop: 5 }}>
                {monetization.nickChangesLeftToday === 0
                  ? t('chat.changesExhausted')
                  : t('chat.changesOf3', { n: monetization.nickChangesLeftToday, max: monetization.nickChangesMaxToday, s: monetization.nickChangesLeftToday !== 1 ? 's' : '' })}
              </p>
            </div>

            {/* Compact settings rows */}
            <div style={{ borderTop: '1px solid var(--ch-border)', marginTop: 4 }}>

              {/* Flag */}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--ch-border)', cursor: detectingFlag ? 'wait' : 'pointer', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ch-text)', fontWeight: 500 }}>
                  {t('chat.showFlag')}
                  {!detectingFlag && showFlag && countryCode && (
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{toFlagEmoji(countryCode)}</span>
                  )}
                  {detectingFlag && (
                    <span style={{ fontSize: 10, color: 'var(--ch-text-3)' }}>{t('chat.detectingLoc')}</span>
                  )}
                  {flagError && (
                    <span style={{ fontSize: 10, color: 'var(--ch-error)' }}>{flagError}</span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={showFlag}
                  disabled={detectingFlag}
                  onChange={e => toggleFlag(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--ch-accent)', cursor: 'pointer', flexShrink: 0 }}
                />
              </label>

              {/* Sound */}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--ch-border)', cursor: 'pointer', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--ch-text)', fontWeight: 500 }}>
                  {t('chat.soundNotifs')}
                </span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={e => {
                    chatSounds.setEnabled(e.target.checked);
                    setSoundEnabled(e.target.checked);
                    if (e.target.checked) chatSounds.play('privateMessage');
                  }}
                  style={{ width: 15, height: 15, accentColor: 'var(--ch-accent)', cursor: 'pointer', flexShrink: 0 }}
                />
              </label>

              {/* Time format */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--ch-border)', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--ch-text)', fontWeight: 500, flexShrink: 0 }}>
                  {t('chat.timeFormat')}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([false, true] as const).map(is12 => (
                    <button key={String(is12)} onClick={() => setHour12(is12)} style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                      fontWeight: hour12 === is12 ? 600 : 400,
                      background: hour12 === is12 ? 'var(--ch-accent)' : 'transparent',
                      color: hour12 === is12 ? 'var(--ch-bg)' : 'var(--ch-text-2)',
                      border: `1px solid ${hour12 === is12 ? 'var(--ch-accent)' : 'var(--ch-border)'}`,
                      fontFamily: 'inherit',
                    }}>
                      {is12 ? t('chat.timeFormat12h') : t('chat.timeFormat24h')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--ch-text)', fontWeight: 500, flexShrink: 0 }}>
                  {t('common.language')}
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {LANG_OPTIONS.map(opt => {
                    const isActive = opt.value === 'auto' ? autoDetect : (!autoDetect && language === opt.value);
                    return (
                      <button key={opt.value}
                        onClick={() => handleSetLanguage(opt.value as SupportedLanguage | 'auto')}
                        style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                          fontWeight: isActive ? 600 : 400,
                          background: isActive ? 'var(--ch-accent)' : 'transparent',
                          color: isActive ? 'var(--ch-bg)' : 'var(--ch-text-2)',
                          border: `1px solid ${isActive ? 'var(--ch-accent)' : 'var(--ch-border)'}`,
                          fontFamily: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer: timezone + close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--ch-border)' }}>
              <span style={{ fontSize: 10, color: 'var(--ch-text-3)' }}>
                {timezone} · {timezoneOffset}
              </span>
              <button onClick={() => setShowNicknameModal(false)} style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--ch-border-2)', background: 'var(--ch-bg-3)',
                color: 'var(--ch-text-2)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
