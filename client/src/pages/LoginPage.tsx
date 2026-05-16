import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { apiService } from '../services/api.service';
import { useTranslation } from '../i18n/I18nContext';
import type { SupportedLanguage } from '../i18n/I18nContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5091';
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:8001';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '866714309795-c50ud6om4stfg2rfpigdn2d9maud1jjp.apps.googleusercontent.com';

// ─── Brand ────────────────────────────────────────────────────────────────────

const BrandMark = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="10" fill="#6366f1" />
    <circle cx="18" cy="24" r="4" fill="white" />
    <circle cx="11" cy="24" r="2.8" fill="white" fillOpacity="0.5" />
    <circle cx="25" cy="24" r="2.8" fill="white" fillOpacity="0.5" />
    <path d="M10 19c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// ─── Left panel decoration ────────────────────────────────────────────────────

const PanelArt = () => (
  <svg width="480" height="480" viewBox="0 0 480 480" fill="none" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)', pointerEvents: 'none' }}>
    {[220, 175, 130, 88, 48].map((r, i) => (
      <circle key={r} cx="240" cy="240" r={r} stroke="#6366f1" strokeWidth="0.6" strokeOpacity={0.18 + i * 0.04} />
    ))}
    {[
      [52, 108], [428, 148], [72, 352], [412, 332],
      [240, 42], [240, 438], [145, 78], [335, 78],
      [145, 402], [335, 402],
    ].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="2.5" fill="#6366f1" fillOpacity="0.35" />
    ))}
    <line x1="240" y1="20" x2="240" y2="460" stroke="#6366f1" strokeWidth="0.4" strokeOpacity="0.1" />
    <line x1="20" y1="240" x2="460" y2="240" stroke="#6366f1" strokeWidth="0.4" strokeOpacity="0.1" />
  </svg>
);

// ─── Server status dot ────────────────────────────────────────────────────────

type ServerState = 'checking' | 'online' | 'offline';

const StatusDot = ({ state }: { state: ServerState }) => {
  const colors = { checking: '#fbbf24', online: '#22c55e', offline: '#ef4444' };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[state],
        boxShadow: `0 0 6px ${colors[state]}55`,
        animation: state === 'online' ? 'status-pulse 2s ease-in-out infinite' : state === 'checking' ? 'status-pulse 0.8s ease-in-out infinite' : 'none',
        transition: 'all 0.35s ease',
      }}
    />
  );
};

// ─── Language selector ────────────────────────────────────────────────────────

const LANG_OPTIONS: { value: SupportedLanguage | 'auto'; label: string }[] = [
  { value: 'auto',  label: '🌐 Auto' },
  { value: 'es',    label: 'ES' },
  { value: 'en',    label: 'EN' },
  { value: 'pt-BR', label: 'PT' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const LoginPage = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const { t, language, autoDetect, setLanguage } = useTranslation();
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState<ServerState>('checking');
  const [realtimeStatus, setRealtimeStatus] = useState<ServerState>('checking');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const serversReady = apiStatus === 'online' && realtimeStatus === 'online';

  // ── Mouse glow tracker (throttled to ~16ms / 60fps) ─────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    let ticking = false;
    const throttled = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleMouseMove(e);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', throttled);
    return () => window.removeEventListener('mousemove', throttled);
  }, [handleMouseMove]);

  // ── Redirect if already authed ────────────────────────────────────────────

  useEffect(() => {
    if (authService.isAuthenticated()) navigate('/chat');
  }, [navigate]);

  // ── Health checks ─────────────────────────────────────────────────────────

  const checkServers = useCallback(async () => {
    const api = apiService.getAxiosInstance();

    try {
      const res = await api.get(`${API_URL}/health`, { timeout: 3000 });
      setApiStatus(res.status === 200 ? 'online' : 'offline');
    } catch {
      setApiStatus('offline');
    }

    try {
      const res = await fetch(`${REALTIME_URL}/socket.io/?EIO=4&transport=polling`, {
        signal: AbortSignal.timeout(3000),
      });
      setRealtimeStatus(res.ok || res.status === 200 ? 'online' : 'offline');
    } catch {
      setRealtimeStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkServers();
    const interval = setInterval(checkServers, 30_000);
    return () => clearInterval(interval);
  }, [checkServers]);

  // ── Google Sign-In (custom popup — avoids iframe popup blocking) ─────────

  const handleGoogleIdToken = useCallback(async (idToken: string) => {
    try {
      setError('');
      const api = apiService.getAxiosInstance();
      const res = await api.post(`${API_URL}/api/auth/google`, { google_token: idToken });

      const { access_token, refresh_token } = res.data;

      let user = null;
      try {
        let base64 = access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const payload = JSON.parse(atob(base64));
        user = {
          id: payload.sub,
          email: payload.email || '',
          nickname: payload.nickname,
          isAdmin: payload.is_admin,
          badge: payload.badge,
          countryCode: payload.country_code,
          showFlag: payload.show_flag,
          lastSeen: new Date().toISOString(),
        };
      } catch (_) { /* proceed with null user */ }

      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('refreshToken', refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      refreshAuth();
      navigate('/chat');
    } catch (err: any) {
      setError(err.response?.data?.detail || t('login.googleError'));
    }
  }, []);

  const handleGoogleLogin = useCallback(() => {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    sessionStorage.setItem('google_nonce', nonce);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/google/callback`,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
    });

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'google-signin',
      'popup,width=500,height=600,left=' + Math.round((screen.width - 500) / 2) + ',top=' + Math.round((screen.height - 600) / 2)
    );

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'GOOGLE_AUTH_CALLBACK') return;
      window.removeEventListener('message', onMessage);
      popup?.close();

      if (event.data.error || !event.data.id_token) {
        setError(t('login.googleError'));
        return;
      }
      handleGoogleIdToken(event.data.id_token);
    };

    window.addEventListener('message', onMessage);
  }, [handleGoogleIdToken]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Phosphor mouse glow ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          background: `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.07), transparent 60%)`,
          transition: 'background 0.08s ease-out',
        }}
      />

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex"
        style={{
          width: '44%', flexDirection: 'column', justifyContent: 'space-between',
          padding: '44px 52px', background: '#09090b', position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380, height: 380,
          background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 68%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        <PanelArt />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <BrandMark size={34} />
          <span style={{ color: '#fafafa', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>opn·chat</span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: '#52525b', fontSize: 12, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            {t('login.tagline1')}
          </p>
          <h2 style={{ color: '#fafafa', fontSize: 30, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.03em', margin: 0, whiteSpace: 'pre-line' }}>
            {t('login.tagline2')}
          </h2>
          <p style={{ color: '#71717a', fontSize: 14, marginTop: 14, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
            {t('login.tagline3')}
          </p>
        </div>

        {/* Server status — bottom left panel */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 18, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot state={apiStatus} />
            <span style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 500 }}>API</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot state={realtimeStatus} />
            <span style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 500 }}>Realtime</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#ffffff', padding: '40px 24px', position: 'relative',
        }}
      >
        {/* Subtle decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25,
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />

        <div style={{ width: '100%', maxWidth: 368, position: 'relative', zIndex: 1 }}>

          {/* Mobile brand */}
          <div className="flex lg:hidden" style={{ justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <BrandMark size={30} />
            <span style={{ fontSize: 17, fontWeight: 600, color: '#111', letterSpacing: '-0.02em' }}>opn·chat</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 5px', letterSpacing: '-0.025em' }}>
              {t('login.welcome')}
            </h1>
            <p style={{ fontSize: 14, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
              {t('login.subtitle')}
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 13px', borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 13, color: '#dc2626', lineHeight: 1.4, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Google button */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <button
              onClick={handleGoogleLogin}
              disabled={!serversReady}
              style={{
                width: '100%', height: 48, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10, border: '1px solid #dadce0',
                borderRadius: 4, background: '#fff', cursor: serversReady ? 'pointer' : 'not-allowed',
                fontSize: 15, fontWeight: 500, color: '#3c4043',
                opacity: serversReady ? 1 : 0.4,
                filter: serversReady ? 'none' : 'grayscale(1)',
                transition: 'opacity 0.3s, filter 0.3s, box-shadow 0.15s',
                fontFamily: '"Google Sans", Roboto, sans-serif',
              }}
              onMouseEnter={e => { if (serversReady) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            {!serversReady && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#a1a1aa', marginTop: 8, fontStyle: 'italic' }}>
                {t('login.loginDisabled')}
              </p>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: '16px 0 0' }}>
            {t('login.noAccount')}{' '}
            <a
              href="#"
              style={{ color: '#6366f1', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {t('login.signUp')}
            </a>
          </p>

          {/* Language selector */}
          <div style={{ marginTop: 20, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {LANG_OPTIONS.map(opt => {
              const isActive = opt.value === 'auto' ? autoDetect : (!autoDetect && language === opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value as SupportedLanguage | 'auto')}
                  style={{
                    padding: '3px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? '#6366f1' : 'transparent',
                    color: isActive ? '#fff' : '#9ca3af',
                    border: `1px solid ${isActive ? '#6366f1' : '#e5e7eb'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
};

export default LoginPage;
