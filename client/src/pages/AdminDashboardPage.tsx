import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { adminService } from '../services/admin.service';
import { getSocket } from '../services/socketio.service';
import { useTranslation } from '../i18n/I18nContext';
import type {
  AdminStatsDto, AdminLiveDataDto, PagedResult, AdminUserDto, AdminRoomDto,
  AdminMessageDto, AdminReportDto, AdminAuditLogDto, AnalyticsDto, SystemSettingDto,
  AuditLogParams, CommandPermissionDto, UpdateCommandPermissionDto, PermissionCategory,
} from '../types/admin';

// ─── Shared mini-components ───────────────────────────────────────────────────

const StatCard = ({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
  <div style={{
    background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 8,
    padding: '16px 20px', minWidth: 140, flex: 1,
  }}>
    <div style={{ color: color ?? 'var(--ch-accent)', fontSize: 26, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{value}</div>
    <div style={{ color: 'var(--ch-text-2)', fontSize: 12, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ color: 'var(--ch-text-3)', fontSize: 11, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    background: color + '22', color, border: `1px solid ${color}55`,
    borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
  }}>{label}</span>
);

const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? 'var(--ch-accent)' : 'var(--ch-border)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left 0.2s',
      }} />
    </div>
    <span style={{ color: 'var(--ch-text)', fontSize: 13 }}>{label}</span>
  </label>
);

const Pagination = ({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--ch-text-2)', fontSize: 12 }}>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} style={btnStyle(page <= 1)}>Prev</button>
      <span>Page {page} of {totalPages} ({total} total)</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} style={btnStyle(page >= totalPages)}>Next</button>
    </div>
  );
};

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder ?? 'Search...'}
    style={{
      background: 'var(--ch-input-bg)', border: '1px solid var(--ch-border)',
      borderRadius: 6, padding: '6px 10px', color: 'var(--ch-text)',
      fontSize: 13, outline: 'none', width: '100%',
    }}
  />
);

const ConfirmModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => {
  const { t } = useTranslation();
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--ch-modal-bg)', border: '1px solid var(--ch-border)',
        borderRadius: 10, padding: 24, maxWidth: 400, width: '90%',
      }}>
        <div style={{ color: 'var(--ch-text)', marginBottom: 20, fontSize: 14 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnStyle(false)}>{t('common.cancel')}</button>
          <button onClick={onConfirm} style={{ ...btnStyle(false), background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const MiniBarChart = ({ data, labels, color }: { data: number[]; labels: string[]; color: string }) => {
  const max = Math.max(...data, 1);
  const bw = 32, bh = 60, gap = 6;
  const totalW = data.length * (bw + gap);
  return (
    <svg viewBox={`0 0 ${totalW} ${bh + 18}`} style={{ width: '100%', maxHeight: 90, overflow: 'visible' }}>
      {data.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * bh));
        const x = i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={bh - h} width={bw} height={h} fill={color} opacity={0.75} rx={2} />
            <text x={x + bw / 2} y={bh + 14} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{labels[i]}</text>
            <title>{`${labels[i]}: ${v}`}</title>
          </g>
        );
      })}
    </svg>
  );
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'transparent' : 'var(--ch-bg-3)',
    border: '1px solid var(--ch-border)',
    borderRadius: 5, padding: '4px 10px',
    color: disabled ? 'var(--ch-text-3)' : 'var(--ch-text)',
    fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function tableStyle(): React.CSSProperties {
  return { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
}

function thStyle(): React.CSSProperties {
  return {
    textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--ch-border)',
    color: 'var(--ch-text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
  };
}

function tdStyle(): React.CSSProperties {
  return { padding: '7px 10px', borderBottom: '1px solid var(--ch-border)22', color: 'var(--ch-text)', verticalAlign: 'middle' };
}

// ─── ActionMenu ───────────────────────────────────────────────────────────────

const ActionMenu = ({ items }: { items: { label: string; danger?: boolean; onClick: () => void }[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...btnStyle(false), padding: '3px 8px', fontSize: 14, lineHeight: 1 }}>⋯</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 100,
          background: 'var(--ch-modal-bg)', border: '1px solid var(--ch-border)',
          borderRadius: 6, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 14px', background: 'none', border: 'none',
                color: item.danger ? '#ef4444' : 'var(--ch-text)',
                fontSize: 13, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ch-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── BanModal ─────────────────────────────────────────────────────────────────

const BanModal = ({ onBan, onClose }: { onBan: (reason: string, expiresAt?: string) => void; onClose: () => void }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [expires, setExpires] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--ch-modal-bg)', border: '1px solid var(--ch-border)', borderRadius: 10, padding: 24, maxWidth: 380, width: '90%' }}>
        <div style={{ color: 'var(--ch-text)', fontWeight: 600, marginBottom: 16 }}>{t('admin.ban')} User</div>
        <input
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason..."
          style={{ width: '100%', marginBottom: 12, background: 'var(--ch-input-bg)', border: '1px solid var(--ch-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--ch-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <input
          type="date" value={expires} onChange={e => setExpires(e.target.value)}
          placeholder="Expires (optional)"
          style={{ width: '100%', marginBottom: 16, background: 'var(--ch-input-bg)', border: '1px solid var(--ch-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--ch-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnStyle(false)}>{t('common.cancel')}</button>
          <button onClick={() => reason && onBan(reason, expires || undefined)} style={{ ...btnStyle(!reason), background: reason ? '#ef4444' : undefined, color: reason ? '#fff' : undefined, borderColor: reason ? '#ef4444' : undefined }}>{t('admin.ban')}</button>
        </div>
      </div>
    </div>
  );
};

// ─── ErrorBanner ─────────────────────────────────────────────────────────────

const ErrorBanner = ({ error }: { error: string }) => (
  <div style={{
    margin: '0 0 12px', padding: '10px 14px', borderRadius: 7,
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444', fontSize: 12, fontFamily: 'DM Mono, monospace',
  }}>
    {error}
  </div>
);

// ─── OverviewPanel ────────────────────────────────────────────────────────────

const OverviewPanel = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch((e: any) => setError(`GET /api/admin/stats — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, []);

  if (error) return <div style={panelStyle()}><h2 style={h2Style()}>{t('admin.overview')}</h2><ErrorBanner error={error} /></div>;
  if (!stats) return <div style={loadingStyle()}>Loading stats...</div>;

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.overview')}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatCard label={t('admin.totalUsers')} value={stats.totalUsers} />
        <StatCard label={t('admin.onlineNow')} value={stats.onlineNow} color="var(--ch-online-dot)" />
        <StatCard label={t('admin.activeRooms')} value={stats.activeRooms} color="#a78bfa" />
        <StatCard label={t('admin.messagesToday')} value={stats.messagesToday} color="#60a5fa" />
        <StatCard label={t('admin.bannedUsers')} value={stats.bannedUsers} color="#ef4444" />
        <StatCard label={t('admin.pendingReports')} value={stats.pendingReports} color="#f59e0b" />
        <StatCard label={t('admin.serverUptime')} value={stats.serverUptime} color="var(--ch-text-2)" />
        <StatCard label={t('admin.connections')} value={stats.signalRConnections} color="var(--ch-accent)" />
      </div>
    </div>
  );
};

// ─── LivePanel ────────────────────────────────────────────────────────────────

const StatusLight = ({ ok, label }: { ok: boolean | null; label: string }) => {
  const color = ok === null ? 'var(--ch-text-3)' : ok ? '#22c55e' : '#ef4444';
  const glow  = ok === null ? 'none' : ok ? '0 0 6px #22c55e99' : '0 0 6px #ef444499';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: glow, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--ch-text-2)' }}>{label}</span>
    </div>
  );
};

const LivePanel = () => {
  const [live, setLive]         = useState<AdminLiveDataDto | null>(null);
  const [apiOk, setApiOk]       = useState<boolean | null>(null);
  const [socketOk, setSocketOk] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminService.getLiveData();
        setLive(data);
        setApiOk(true);
      } catch {
        setApiOk(false);
      }
      setSocketOk(getSocket('chat').connected);
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={panelStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ ...h2Style(), margin: 0 }}>Live Monitoring <span style={{ fontSize: 12, color: 'var(--ch-text-3)' }}>(auto-refresh 5s)</span></h2>
        <div style={{ display: 'flex', gap: 16 }}>
          <StatusLight ok={apiOk} label="API" />
          <StatusLight ok={socketOk} label="Socket.IO" />
        </div>
      </div>
      {!live && <div style={loadingStyle()}>Connecting to live feed...</div>}
      {live && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, height: 'calc(100% - 80px)' }}>
        <div style={columnStyle()}>
          <div style={colHeaderStyle()}>Online Users ({live.onlineUsers.length})</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {live.onlineUsers.map(u => (
              <div key={u.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--ch-border)22', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ch-online-dot)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: 'var(--ch-text)', fontSize: 13 }}>{u.nickname}</span>
                {u.awayMessage && <span style={{ color: 'var(--ch-text-3)', fontSize: 11 }}>away</span>}
                {u.badge && <Badge label={u.badge} color="var(--ch-accent)" />}
              </div>
            ))}
            {live.onlineUsers.length === 0 && <div style={{ color: 'var(--ch-text-3)', fontSize: 12, padding: '8px 0' }}>No one online</div>}
          </div>
        </div>
        <div style={columnStyle()}>
          <div style={colHeaderStyle()}>Active Rooms ({live.activeRooms.length})</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {live.activeRooms.map(r => (
              <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--ch-border)22', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ch-text)', fontSize: 13 }}>#{r.name}</span>
                <span style={{ color: 'var(--ch-text-3)', fontSize: 12 }}>{r.memberCount} members</span>
              </div>
            ))}
          </div>
        </div>
        <div style={columnStyle()}>
          <div style={colHeaderStyle()}>Recent Messages</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {live.recentMessages.map(m => (
              <div key={m.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--ch-border)22' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--ch-accent)', fontSize: 12, fontWeight: 600 }}>{m.userNickname}</span>
                  <span style={{ color: 'var(--ch-text-3)', fontSize: 11 }}>#{m.roomName}</span>
                </div>
                <div style={{ color: 'var(--ch-text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {m.isDeleted ? <em style={{ color: 'var(--ch-text-3)' }}>[deleted]</em> : m.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

// ─── UsersPanel ───────────────────────────────────────────────────────────────

const UsersPanel = () => {
  const [result, setResult] = useState<PagedResult<AdminUserDto> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: number, s: string) => {
    adminService.getUsers(p, 20, s || undefined)
      .then(r => { setResult(r); setError(null); })
      .catch((e: any) => setError(`GET /api/admin/users — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, []);

  useEffect(() => { load(1, ''); }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, search); }, 400);
  }, [search, load]);

  const act = (fn: () => Promise<unknown>, msg?: string) => {
    const go = () => fn().then(() => load(page, search)).catch(e => alert(e?.response?.data ?? 'Error'));
    if (msg) { setConfirm({ msg, fn: go }); } else { go(); }
  };

  const { t } = useTranslation();

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.users')}</h2>
      {error && <ErrorBanner error={error} />}
      <div style={{ marginBottom: 10 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by nickname or email..." />
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={tableStyle()}>
          <thead>
            <tr>
              {['', 'Nickname', 'Email', 'Country', 'Created', 'Last Seen', 'Nickname Ч', 'Flags', 'Actions'].map(h => (
                <th key={h} style={thStyle()}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result?.items.map(u => (
              <tr key={u.id} style={{ background: u.isDeactivated ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                <td style={tdStyle()}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.isOnline ? 'var(--ch-online-dot)' : 'var(--ch-text-3)', display: 'inline-block' }} />
                </td>
                <td style={tdStyle()}>
                  <span style={{ color: 'var(--ch-text)', fontWeight: 500 }}>{u.nickname}</span>
                  {u.globalBadge && <> <Badge label={u.globalBadge} color="var(--ch-accent)" /></>}
                </td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)' }}>{u.email}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)' }}>{u.countryCode ?? '—'}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)', fontFamily: 'DM Mono,monospace' }}>{fmtDate(u.createdAt)}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)', fontFamily: 'DM Mono,monospace' }}>{fmtDate(u.lastSeen)}</td>
                <td style={{ ...tdStyle(), textAlign: 'center', color: 'var(--ch-text-2)' }}>{u.nicknameChangeCount}/3</td>
                <td style={tdStyle()}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {u.isAdmin && <Badge label="admin" color="#a78bfa" />}
                    {u.isBanned && <Badge label="banned" color="#ef4444" />}
                    {u.isDeactivated && <Badge label="deactivated" color="#f59e0b" />}
                  </div>
                </td>
                <td style={tdStyle()}>
                  <ActionMenu items={[
                    { label: u.isBanned ? t('admin.unban') : t('admin.ban'), onClick: () => u.isBanned ? act(() => adminService.unbanUser(u.id)) : setBanTarget(u.id) },
                    { label: t('admin.kick'), onClick: () => act(() => adminService.kickUser(u.id), `Kick ${u.nickname}?`) },
                    { label: u.isDeactivated ? 'Reactivate' : t('admin.deactivate'), onClick: () => act(() => adminService.deactivateUser(u.id), `${u.isDeactivated ? 'Reactivate' : 'Deactivate'} ${u.nickname}?`), danger: !u.isDeactivated },
                    { label: t('admin.mute') + ' (all rooms)', onClick: () => act(() => adminService.muteUser(u.id)) },
                    { label: t('admin.unmute'), onClick: () => act(() => adminService.unmuteUser(u.id)) },
                    { label: t('admin.forceLogout'), onClick: () => act(() => adminService.forceLogout(u.id), `Force logout ${u.nickname}?`), danger: true },
                    { label: u.isAdmin ? 'Revoke Admin' : t('admin.toggleAdmin'), onClick: () => act(() => adminService.toggleAdmin(u.id, !u.isAdmin), `${u.isAdmin ? 'Revoke admin from' : 'Grant admin to'} ${u.nickname}?`), danger: u.isAdmin },
                    { label: t('admin.resetNickname'), onClick: () => act(() => adminService.resetNicknameChanges(u.id)) },
                    { label: t('admin.deleteAll'), onClick: () => act(() => adminService.bulkDeleteUserMessages(u.id), `Delete all messages from ${u.nickname}?`), danger: true },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && <Pagination page={page} total={result.total} pageSize={20} onChange={p => { setPage(p); load(p, search); }} />}
      {banTarget && <BanModal onBan={(reason, expiresAt) => { act(() => adminService.banUser(banTarget, { reason, expiresAt })); setBanTarget(null); }} onClose={() => setBanTarget(null)} />}
      {confirm && <ConfirmModal message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
};

// ─── RoomsPanel ───────────────────────────────────────────────────────────────

const RoomsPanel = () => {
  const [rooms, setRooms] = useState<AdminRoomDto[]>([]);
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => adminService.getRooms().then(r => { setRooms(r); setError(null); })
    .catch((e: any) => setError(`GET /api/admin/rooms — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  useEffect(() => { load(); }, []);

  const act = (fn: () => Promise<unknown>, msg?: string) => {
    const go = () => fn().then(load).catch(e => alert(e?.response?.data ?? 'Error'));
    if (msg) setConfirm({ msg, fn: go }); else go();
  };

  const { t } = useTranslation();

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.rooms')}</h2>
      {error && <ErrorBanner error={error} />}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle()}>
          <thead>
            <tr>{['Name', 'Type', 'Creator', 'Members', 'Messages', 'Created', 'Status', 'Actions'].map(h => <th key={h} style={thStyle()}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rooms.map(r => (
              <tr key={r.id}>
                <td style={{ ...tdStyle(), fontWeight: 500, color: 'var(--ch-text)' }}>#{r.name}</td>
                <td style={tdStyle()}><Badge label={r.isPrivate ? 'private' : 'public'} color={r.isPrivate ? '#f59e0b' : '#22c55e'} /></td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)' }}>{r.createdByNickname ?? '—'}</td>
                <td style={{ ...tdStyle(), textAlign: 'center', color: 'var(--ch-text-2)' }}>{r.memberCount}</td>
                <td style={{ ...tdStyle(), textAlign: 'center', color: 'var(--ch-text-2)' }}>{r.messageCount}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)', fontFamily: 'DM Mono,monospace' }}>{fmtDate(r.createdAt)}</td>
                <td style={tdStyle()}>{r.isLocked && <Badge label="locked" color="#ef4444" />}</td>
                <td style={tdStyle()}>
                  <ActionMenu items={[
                    { label: r.isLocked ? t('admin.unlock') : t('admin.lock'), onClick: () => act(r.isLocked ? () => adminService.unlockRoom(r.id) : () => adminService.lockRoom(r.id)) },
                    { label: t('admin.clearMessages'), onClick: () => act(() => adminService.clearRoomMessages(r.id), `Clear all messages in #${r.name}?`), danger: true },
                    { label: t('admin.deleteRoom'), onClick: () => act(() => adminService.deleteRoom(r.id), `Delete room #${r.name}? This cannot be undone.`), danger: true },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm && <ConfirmModal message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
};

// ─── MessagesPanel ────────────────────────────────────────────────────────────

const MessagesPanel = () => {
  const [result, setResult] = useState<PagedResult<AdminMessageDto> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p = 1) => {
    adminService.searchMessages({ query: query || undefined, userId: userId || undefined, roomId: roomId || undefined, includeDeleted, page: p, pageSize: 20 })
      .then(r => { setResult(r); setError(null); })
      .catch((e: any) => setError(`GET /api/admin/messages — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, [query, userId, roomId, includeDeleted]);

  useEffect(() => { setPage(1); load(1); }, [load]);

  const act = (fn: () => Promise<unknown>, msg?: string) => {
    const go = () => fn().then(() => load(page)).catch(e => alert(e?.response?.data ?? 'Error'));
    if (msg) setConfirm({ msg, fn: go }); else go();
  };

  const { t } = useTranslation();

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.messages')}</h2>
      {error && <ErrorBanner error={error} />}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 2, minWidth: 160 }}><SearchInput value={query} onChange={setQuery} placeholder="Search content..." /></div>
        <div style={{ flex: 1, minWidth: 120 }}><SearchInput value={userId} onChange={setUserId} placeholder="User ID..." /></div>
        <div style={{ flex: 1, minWidth: 120 }}><SearchInput value={roomId} onChange={setRoomId} placeholder="Room ID..." /></div>
        <Toggle value={includeDeleted} onChange={setIncludeDeleted} label="Show deleted" />
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={tableStyle()}>
          <thead>
            <tr>{['Time', 'Room', 'User', 'Content', 'Status', 'Reports', 'Actions'].map(h => <th key={h} style={thStyle()}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {result?.items.map(m => (
              <tr key={m.id} style={{ opacity: m.isDeleted ? 0.5 : 1 }}>
                <td style={{ ...tdStyle(), fontFamily: 'DM Mono,monospace', color: 'var(--ch-text-3)', whiteSpace: 'nowrap' }}>{fmtTime(m.timestamp)}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)' }}>#{m.roomName}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-accent)', fontWeight: 500 }}>{m.userNickname}</td>
                <td style={{ ...tdStyle(), maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.isDeleted ? <em style={{ color: 'var(--ch-text-3)' }}>[deleted]</em> : m.content}
                </td>
                <td style={tdStyle()}>{m.isDeleted && <Badge label="deleted" color="#ef4444" />}</td>
                <td style={{ ...tdStyle(), textAlign: 'center', color: m.reportCount > 0 ? '#f59e0b' : 'var(--ch-text-3)' }}>{m.reportCount}</td>
                <td style={tdStyle()}>
                  {!m.isDeleted && (
                    <ActionMenu items={[
                      { label: t('admin.deleteMessage'), onClick: () => act(() => adminService.deleteMessage(m.id), 'Delete this message?'), danger: true },
                      { label: t('admin.deleteAll'), onClick: () => act(() => adminService.bulkDeleteUserMessages(m.userId), `Delete all messages from ${m.userNickname}?`), danger: true },
                    ]} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && <Pagination page={page} total={result.total} pageSize={20} onChange={p => { setPage(p); load(p); }} />}
      {confirm && <ConfirmModal message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
};

// ─── ReportsPanel ─────────────────────────────────────────────────────────────

const ReportsPanel = () => {
  const [result, setResult] = useState<PagedResult<AdminReportDto> | null>(null);
  const [page, setPage] = useState(1);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p = 1) => {
    adminService.getReports(unresolvedOnly, p, 20)
      .then(r => { setResult(r); setError(null); })
      .catch((e: any) => setError(`GET /api/admin/reports — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, [unresolvedOnly]);

  useEffect(() => { setPage(1); load(1); }, [load]);

  const resolve = (id: string) => adminService.resolveReport(id).then(() => load(page)).catch(() => {});

  const { t } = useTranslation();

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.reports')}</h2>
      {error && <ErrorBanner error={error} />}
      <div style={{ marginBottom: 10 }}>
        <Toggle value={unresolvedOnly} onChange={setUnresolvedOnly} label="Unresolved only" />
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={tableStyle()}>
          <thead>
            <tr>{['Reported By', 'Reported User', 'Reason', 'Message', 'Date', 'Status', 'Actions'].map(h => <th key={h} style={thStyle()}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {result?.items.map(r => (
              <tr key={r.id}>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)' }}>{r.reportedByNickname}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-accent)', fontWeight: 500 }}>{r.reportedUserNickname ?? '—'}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text)' }}>{r.reason}</td>
                <td style={{ ...tdStyle(), maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ch-text-2)' }}>
                  {r.messageContent ?? '—'}
                </td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)', fontFamily: 'DM Mono,monospace' }}>{fmtDate(r.createdAt)}</td>
                <td style={tdStyle()}><Badge label={r.isResolved ? 'resolved' : 'open'} color={r.isResolved ? '#22c55e' : '#f59e0b'} /></td>
                <td style={tdStyle()}>
                  {!r.isResolved && <button onClick={() => resolve(r.id)} style={{ ...btnStyle(false), fontSize: 11 }}>{t('admin.resolve')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && <Pagination page={page} total={result.total} pageSize={20} onChange={p => { setPage(p); load(p); }} />}
    </div>
  );
};

// ─── AuditPanel ───────────────────────────────────────────────────────────────

const AuditPanel = () => {
  const [result, setResult] = useState<PagedResult<AdminAuditLogDto> | null>(null);
  const [page, setPage] = useState(1);
  const [params, setParams] = useState<Omit<AuditLogParams, 'page' | 'pageSize'>>({});

  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p = 1) => {
    adminService.getAuditLogs({ ...params, page: p, pageSize: 30 })
      .then(r => { setResult(r); setError(null); })
      .catch((e: any) => setError(`GET /api/admin/auditlogs — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, [params]);

  useEffect(() => { setPage(1); load(1); }, [load]);

  const { t } = useTranslation();

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>{t('admin.audit')}</h2>
      {error && <ErrorBanner error={error} />}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <SearchInput value={params.action ?? ''} onChange={v => setParams(p => ({ ...p, action: v || undefined }))} placeholder="Action type..." />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <SearchInput value={params.adminId ?? ''} onChange={v => setParams(p => ({ ...p, adminId: v || undefined }))} placeholder="Admin ID..." />
        </div>
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={tableStyle()}>
          <thead>
            <tr>{['Time', 'Admin', 'Action', 'Target Type', 'Target', 'Details'].map(h => <th key={h} style={thStyle()}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {result?.items.map(l => (
              <tr key={l.id}>
                <td style={{ ...tdStyle(), fontFamily: 'DM Mono,monospace', color: 'var(--ch-text-3)', whiteSpace: 'nowrap' }}>{fmtTime(l.timestamp)}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-accent)', fontWeight: 500 }}>{l.adminNickname}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text)', fontWeight: 500 }}>{l.action}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)' }}>{l.targetType ?? '—'}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)' }}>{l.targetDisplay ?? l.targetId ?? '—'}</td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.details ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result && <Pagination page={page} total={result.total} pageSize={30} onChange={p => { setPage(p); load(p); }} />}
    </div>
  );
};

// ─── AnalyticsPanel ───────────────────────────────────────────────────────────

const AnalyticsPanel = () => {
  const [data, setData] = useState<AnalyticsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminService.getAnalytics().then(setData)
      .catch((e: any) => setError(`GET /api/admin/analytics — ${e?.response?.status ?? 'network error'}: ${JSON.stringify(e?.response?.data ?? e?.message)}`));
  }, []);
  if (error) return <div style={panelStyle()}><h2 style={h2Style()}>Analytics</h2><ErrorBanner error={error} /></div>;
  if (!data) return <div style={loadingStyle()}>Loading analytics...</div>;

  const maxRoom = Math.max(...data.topRooms.map(r => r.messageCount), 1);

  return (
    <div style={panelStyle()}>
      <h2 style={h2Style()}>Analytics (last 7 days)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 8, padding: 16 }}>
          <div style={{ color: 'var(--ch-text-2)', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>Daily Messages</div>
          <MiniBarChart data={data.dailyMessages} labels={data.dailyLabels} color="var(--ch-accent)" />
        </div>
        <div style={{ background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 8, padding: 16 }}>
          <div style={{ color: 'var(--ch-text-2)', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>Daily Active Users</div>
          <MiniBarChart data={data.dailyActiveUsers} labels={data.dailyLabels} color="var(--ch-online-dot)" />
        </div>
        <div style={{ background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 8, padding: 16, gridColumn: '1 / -1' }}>
          <div style={{ color: 'var(--ch-text-2)', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>Top Rooms by Messages</div>
          {data.topRooms.map(r => (
            <div key={r.name} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                <span style={{ color: 'var(--ch-text)' }}>#{r.name}</span>
                <span style={{ color: 'var(--ch-text-3)', fontFamily: 'DM Mono,monospace' }}>{r.messageCount}</span>
              </div>
              <div style={{ height: 6, background: 'var(--ch-bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(r.messageCount / maxRoom) * 100}%`, background: 'var(--ch-accent)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── SettingsPanel ────────────────────────────────────────────────────────────

const SettingsPanel = () => {
  const { t, language, locale, timezone, autoDetect, setLanguage } = useTranslation();
  const [settings, setSettings] = useState<SystemSettingDto[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getSettings().then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const update = (key: string, value: string) =>
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  const getVal = (key: string) => settings.find(s => s.key === key)?.value ?? '';

  const save = () =>
    adminService.updateSettings(settings)
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch(() => alert('Save failed'));

  const maintenance = getVal('MaintenanceMode') === 'true';

  if (loading) return <div style={loadingStyle()}>Loading settings...</div>;

  return (
    <div style={panelStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ ...h2Style(), margin: 0 }}>{t('admin.settings')}</h2>
        <button
          onClick={save}
          style={{ ...btnStyle(false), background: 'var(--ch-accent)', color: 'var(--ch-btn-text, #fff)', borderColor: 'var(--ch-accent)', padding: '6px 18px', fontWeight: 600 }}
        >
          {saved ? '✓ Saved' : t('common.save')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left column: System settings ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ch-border)', fontSize: 12, fontWeight: 700, color: 'var(--ch-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            System
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ch-border)22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ch-text)', fontWeight: 500 }}>Allow Room Creation</div>
              <div style={{ fontSize: 11, color: 'var(--ch-text-3)', marginTop: 2 }}>Users can create new rooms</div>
            </div>
            <Toggle value={getVal('AllowRoomCreation') === 'true'} onChange={v => update('AllowRoomCreation', v ? 'true' : 'false')} label="" />
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ch-border)22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ch-text)', fontWeight: 500 }}>Allow Private Chats</div>
              <div style={{ fontSize: 11, color: 'var(--ch-text-3)', marginTop: 2 }}>Users can send direct messages</div>
            </div>
            <Toggle value={getVal('AllowPrivateChats') === 'true'} onChange={v => update('AllowPrivateChats', v ? 'true' : 'false')} label="" />
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ch-border)22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ch-text)', fontWeight: 500 }}>Max Nickname Changes / day</div>
              <div style={{ fontSize: 11, color: 'var(--ch-text-3)', marginTop: 2 }}>Resets at 00:00 UTC</div>
            </div>
            <input
              type="number" min={0} max={99}
              value={getVal('MaxNicknameChanges')}
              onChange={e => update('MaxNicknameChanges', e.target.value)}
              style={{ ...inputStyle(), width: 64 }}
            />
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ch-border)22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ch-text)', fontWeight: 500 }}>Spam Threshold (msg/min)</div>
              <div style={{ fontSize: 11, color: 'var(--ch-text-3)', marginTop: 2 }}>Rate limit per user per room</div>
            </div>
            <input
              type="number" min={1} max={200}
              value={getVal('SpamThreshold')}
              onChange={e => update('SpamThreshold', e.target.value)}
              style={{ ...inputStyle(), width: 64 }}
            />
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ch-border)22' }}>
            <div style={{ fontSize: 13, color: 'var(--ch-text)', fontWeight: 500, marginBottom: 8 }}>Global Announcement Banner</div>
            <input
              value={getVal('GlobalAnnouncementBanner')}
              onChange={e => update('GlobalAnnouncementBanner', e.target.value)}
              placeholder="Empty = no banner shown"
              style={{ ...inputStyle(), width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{
            padding: '14px 16px',
            background: maintenance ? 'rgba(239,68,68,0.06)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: maintenance ? '#ef4444' : 'var(--ch-text)' }}>Maintenance Mode</div>
              <div style={{ fontSize: 11, color: maintenance ? '#ef4444' : 'var(--ch-text-3)', marginTop: 2 }}>
                {maintenance ? 'Active — all users see maintenance page' : 'Disabled'}
              </div>
            </div>
            <Toggle value={maintenance} onChange={v => update('MaintenanceMode', v ? 'true' : 'false')} label="" />
          </div>
        </div>

        {/* ── Right column: Interface / language ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ch-border)', fontSize: 12, fontWeight: 700, color: 'var(--ch-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Interface Language
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ch-text-3)', marginBottom: 12 }}>
                {t('admin.interfaceLanguage')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { value: 'auto' as const,  label: 'Auto-detect', desc: 'Follows browser language' },
                  { value: 'es' as const,    label: 'Español',     desc: 'ES — Rioplatense' },
                  { value: 'en' as const,    label: 'English',     desc: 'EN — Default' },
                  { value: 'pt-BR' as const, label: 'Português',   desc: 'PT-BR' },
                ].map(opt => {
                  const isActive = opt.value === 'auto' ? autoDetect : (!autoDetect && language === opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setLanguage(opt.value)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                        background: isActive ? 'var(--ch-accent-dim)' : 'transparent',
                        border: `1px solid ${isActive ? 'var(--ch-accent)' : 'var(--ch-border)'}`,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--ch-accent)' : 'var(--ch-text)' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ch-text-3)' }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ch-text-3)', marginTop: 12 }}>
                {t('chat.detectedLocale', { locale, timezone })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

function settingRow(): React.CSSProperties { return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }; }
function settingLabel(): React.CSSProperties { return { color: 'var(--ch-text)', fontSize: 13, fontWeight: 500 }; }
function inputStyle(): React.CSSProperties {
  return { background: 'var(--ch-input-bg)', border: '1px solid var(--ch-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--ch-text)', fontSize: 13, outline: 'none', width: 80 };
}

// ─── ConsolePanel ─────────────────────────────────────────────────────────────

type ConsoleLine = { type: 'in' | 'out' | 'err'; text: string };

const ConsolePanel = () => {
  const [history, setHistory] = useState<ConsoleLine[]>([{ type: 'out', text: 'opn·admin console — type /help for commands' }]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  const print = (type: ConsoleLine['type'], text: string) => setHistory(h => [...h, { type, text }]);

  const parseDuration = (s: string): Date | undefined => {
    const m = s.match(/^(\d+)(h|m|d)$/);
    if (!m) return undefined;
    const n = parseInt(m[1]);
    const unit = m[2];
    const d = new Date();
    if (unit === 'h') d.setHours(d.getHours() + n);
    else if (unit === 'm') d.setMinutes(d.getMinutes() + n);
    else d.setDate(d.getDate() + n);
    return d;
  };

  const lookupUser = async (nick: string) => {
    const res = await adminService.getUsers(1, 5, nick);
    return res.items.find(u => u.nickname.toLowerCase() === nick.toLowerCase()) ?? res.items[0];
  };

  const lookupRoom = async (name: string) => {
    const rooms = await adminService.getRooms();
    return rooms.find(r => r.name.toLowerCase() === name.replace(/^#/, '').toLowerCase());
  };

  const run = async (cmd: string) => {
    print('in', `> ${cmd}`);
    const parts = cmd.trim().split(/\s+/);
    const op = parts[0]?.toLowerCase();

    try {
      if (op === '/help') {
        print('out', '/ban nick reason — permanent ban');
        print('out', '/tempban nick 1h|1d|30m reason — temporary ban');
        print('out', '/kick nick — disconnect user');
        print('out', '/mute nick — mute in all rooms');
        print('out', '/unmute nick — unmute');
        print('out', '/unban nick — lift ban');
        print('out', '/announce message — global announcement');
        print('out', '/lock #room — lock room');
        print('out', '/unlock #room — unlock room');
        print('out', '/delete #room — delete room');
        return;
      }

      if (op === '/ban') {
        const [, nick, ...rest] = parts;
        const reason = rest.join(' ');
        if (!nick || !reason) { print('err', 'Usage: /ban nick reason'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.banUser(u.id, { reason });
        print('out', `✓ Banned ${u.nickname}: ${reason}`);
        return;
      }

      if (op === '/tempban') {
        const [, nick, dur, ...rest] = parts;
        const reason = rest.join(' ');
        if (!nick || !dur || !reason) { print('err', 'Usage: /tempban nick 1h reason'); return; }
        const expires = parseDuration(dur);
        if (!expires) { print('err', 'Invalid duration. Use: 1h, 30m, 7d'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.banUser(u.id, { reason, expiresAt: expires.toISOString() });
        print('out', `✓ Temp-banned ${u.nickname} until ${expires.toLocaleString()}: ${reason}`);
        return;
      }

      if (op === '/kick') {
        const [, nick] = parts;
        if (!nick) { print('err', 'Usage: /kick nick'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.kickUser(u.id);
        print('out', `✓ Kicked ${u.nickname}`);
        return;
      }

      if (op === '/mute') {
        const [, nick] = parts;
        if (!nick) { print('err', 'Usage: /mute nick'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.muteUser(u.id);
        print('out', `✓ Muted ${u.nickname} in all rooms`);
        return;
      }

      if (op === '/unmute') {
        const [, nick] = parts;
        if (!nick) { print('err', 'Usage: /unmute nick'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.unmuteUser(u.id);
        print('out', `✓ Unmuted ${u.nickname}`);
        return;
      }

      if (op === '/unban') {
        const [, nick] = parts;
        if (!nick) { print('err', 'Usage: /unban nick'); return; }
        const u = await lookupUser(nick);
        if (!u) { print('err', `User not found: ${nick}`); return; }
        await adminService.unbanUser(u.id);
        print('out', `✓ Unbanned ${u.nickname}`);
        return;
      }

      if (op === '/announce') {
        const msg = parts.slice(1).join(' ');
        if (!msg) { print('err', 'Usage: /announce message'); return; }
        await adminService.sendAnnouncement(msg);
        print('out', `✓ Announcement sent: ${msg}`);
        return;
      }

      if (op === '/lock') {
        const [, roomName] = parts;
        if (!roomName) { print('err', 'Usage: /lock #room'); return; }
        const r = await lookupRoom(roomName);
        if (!r) { print('err', `Room not found: ${roomName}`); return; }
        await adminService.lockRoom(r.id);
        print('out', `✓ Locked #${r.name}`);
        return;
      }

      if (op === '/unlock') {
        const [, roomName] = parts;
        if (!roomName) { print('err', 'Usage: /unlock #room'); return; }
        const r = await lookupRoom(roomName);
        if (!r) { print('err', `Room not found: ${roomName}`); return; }
        await adminService.unlockRoom(r.id);
        print('out', `✓ Unlocked #${r.name}`);
        return;
      }

      if (op === '/delete') {
        const [, roomName] = parts;
        if (!roomName) { print('err', 'Usage: /delete #room'); return; }
        const r = await lookupRoom(roomName);
        if (!r) { print('err', `Room not found: ${roomName}`); return; }
        print('out', `Confirm delete #${r.name}? Type: confirm`);
        setInput('confirm');
        return;
      }

      if (cmd.trim() === 'confirm' && history.at(-1)?.text.startsWith('Confirm delete')) {
        const match = history.at(-1)!.text.match(/#(\w+)\?/);
        if (match) {
          const r = await lookupRoom(match[1]);
          if (r) { await adminService.deleteRoom(r.id); print('out', `✓ Deleted #${r.name}`); }
        }
        return;
      }

      print('err', `Unknown command: ${op}. Type /help`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      print('err', `Error: ${err?.response?.data ?? String(e)}`);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      const cmd = input;
      setInput('');
      run(cmd);
    }
  };

  const { t } = useTranslation();

  return (
    <div style={{ ...panelStyle(), background: 'var(--ch-bg)', fontFamily: 'DM Mono, monospace' }}>
      <h2 style={{ ...h2Style(), fontFamily: 'DM Mono, monospace', color: 'var(--ch-accent)' }}>{t('admin.console')}</h2>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {history.map((line, i) => (
          <div key={i} style={{
            padding: '2px 0', fontSize: 13, lineHeight: 1.6,
            color: line.type === 'err' ? '#ef4444' : line.type === 'in' ? 'var(--ch-text-3)' : '#4ade80',
          }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--ch-border)', paddingTop: 10 }}>
        <span style={{ color: 'var(--ch-accent)', fontSize: 14, lineHeight: '30px' }}>&gt;</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a command... (/help)"
          autoFocus
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ch-text)', fontSize: 13, fontFamily: 'DM Mono, monospace',
          }}
        />
      </div>
    </div>
  );
};

// ─── Helper styles ────────────────────────────────────────────────────────────

function panelStyle(): React.CSSProperties {
  return { padding: 20, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' };
}

function h2Style(): React.CSSProperties {
  return { color: 'var(--ch-text)', fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 };
}

function columnStyle(): React.CSSProperties {
  return { background: 'var(--ch-bg-2)', border: '1px solid var(--ch-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
}

function colHeaderStyle(): React.CSSProperties {
  return { color: 'var(--ch-text-2)', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' };
}

function loadingStyle(): React.CSSProperties {
  return { padding: 40, color: 'var(--ch-text-3)', textAlign: 'center', fontSize: 13 };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── PermissionsPanel ─────────────────────────────────────────────────────────

const CATEGORIES: ('All' | PermissionCategory)[] = ['All', 'Messaging', 'Moderation', 'Room Management', 'Identity', 'Admin'];

const ROLE_KEYS: { key: keyof UpdateCommandPermissionDto; label: string }[] = [
  { key: 'memberAllowed',   label: 'Member' },
  { key: 'operatorAllowed', label: 'Operator' },
  { key: 'founderAllowed',  label: 'Founder' },
  { key: 'adminAllowed',    label: 'Admin' },
];

function PermBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
      padding: '1px 5px', borderRadius: 3, marginLeft: 4,
      background: bg, color,
    }}>{label}</span>
  );
}

function PermIcon({ allowed }: { allowed: boolean }) {
  return (
    <span style={{ fontWeight: 700, fontSize: 14, color: allowed ? '#22c55e' : '#ef4444' }}>
      {allowed ? '✓' : '✗'}
    </span>
  );
}

function PermissionsPanel() {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<CommandPermissionDto[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | PermissionCategory>('All');
  const [selected, setSelected] = useState<CommandPermissionDto | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    adminService.getCommandPermissions().then(setPermissions).catch(() => {});
  }, []);

  const filtered = permissions
    .filter(p => category === 'All' || p.category === category)
    .filter(p =>
      p.commandName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    );

  const handleToggle = async (perm: CommandPermissionDto, key: keyof UpdateCommandPermissionDto) => {
    const updated: CommandPermissionDto = { ...perm, [key]: !perm[key] };
    setPermissions(prev => prev.map(p => p.commandName === perm.commandName ? updated : p));
    if (selected?.commandName === perm.commandName) setSelected(updated);
    try {
      await adminService.updateCommandPermission(perm.commandName, {
        memberAllowed:   updated.memberAllowed,
        operatorAllowed: updated.operatorAllowed,
        founderAllowed:  updated.founderAllowed,
        adminAllowed:    updated.adminAllowed,
      });
    } catch {
      setPermissions(prev => prev.map(p => p.commandName === perm.commandName ? perm : p));
      if (selected?.commandName === perm.commandName) setSelected(perm);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all permissions to default values?')) return;
    setResetting(true);
    try {
      await adminService.resetCommandPermissions();
      const fresh = await adminService.getCommandPermissions();
      setPermissions(fresh);
      setSelected(null);
    } catch { /* ignore */ }
    finally { setResetting(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--ch-border)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search commands…"
          style={{
            background: 'var(--ch-input-bg)', border: '1px solid var(--ch-border)',
            borderRadius: 5, padding: '4px 10px', color: 'var(--ch-text)', fontSize: 12, width: 200,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                ...btnStyle(false),
                background: category === cat ? 'var(--ch-accent-dim)' : 'var(--ch-bg-3)',
                color: category === cat ? 'var(--ch-accent)' : 'var(--ch-text-2)',
                border: category === cat ? '1px solid var(--ch-accent)' : '1px solid var(--ch-border)',
                padding: '3px 9px', fontSize: 11,
              }}
            >{cat}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{ ...btnStyle(resetting), color: '#f97316', borderColor: '#f97316' }}
          >{resetting ? 'Resetting…' : '↺ Restore Defaults'}</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ ...tableStyle(), tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(), position: 'sticky', top: 0, background: 'var(--ch-bg-2)', zIndex: 1, width: '22%' }}>Command</th>
              <th style={{ ...thStyle(), position: 'sticky', top: 0, background: 'var(--ch-bg-2)', zIndex: 1, width: '28%' }}>Description</th>
              {ROLE_KEYS.map(r => (
                <th key={r.key} style={{ ...thStyle(), position: 'sticky', top: 0, background: 'var(--ch-bg-2)', zIndex: 1, width: '10%', textAlign: 'center' }}>
                  {r.label}
                </th>
              ))}
              <th style={{ ...thStyle(), position: 'sticky', top: 0, background: 'var(--ch-bg-2)', zIndex: 1, width: '20%' }}>Badges</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(perm => (
              <tr
                key={perm.commandName}
                onClick={() => setSelected(perm)}
                style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ch-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={tdStyle()}>
                  <span style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 12,
                    textDecoration: perm.isDeprecated ? 'line-through' : 'none',
                    color: perm.isDeprecated ? 'var(--ch-text-3)' : 'var(--ch-accent)',
                  }}>/{perm.commandName}</span>
                </td>
                <td style={{ ...tdStyle(), color: 'var(--ch-text-2)', fontSize: 11 }}>{perm.description}</td>
                {ROLE_KEYS.map(r => (
                  <td
                    key={r.key}
                    style={{ ...tdStyle(), textAlign: 'center' }}
                    onClick={e => { e.stopPropagation(); handleToggle(perm, r.key); }}
                  >
                    <PermIcon allowed={perm[r.key]} />
                  </td>
                ))}
                <td style={tdStyle()}>
                  {perm.isDangerous && <PermBadge label="⚠ DANGEROUS" color="#fca5a5" bg="#7f1d1d" />}
                  {perm.isSystem   && <PermBadge label="SYSTEM"      color="#93c5fd" bg="#1e3a5f" />}
                  {perm.isDeprecated && <PermBadge label="DEPRECATED" color="#fde68a" bg="#3b3523" />}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...tdStyle(), textAlign: 'center', color: 'var(--ch-text-3)', padding: 32 }}>No commands match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: 'var(--ch-modal-bg)', border: '1px solid var(--ch-border)', borderRadius: 10,
              padding: 24, minWidth: 420, maxWidth: 560, width: '90%',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, color: 'var(--ch-accent)', fontWeight: 700 }}>
                /{selected.commandName}
              </span>
              {selected.isDangerous  && <PermBadge label="⚠ DANGEROUS" color="#fca5a5" bg="#7f1d1d" />}
              {selected.isSystem     && <PermBadge label="SYSTEM"      color="#93c5fd" bg="#1e3a5f" />}
              {selected.isDeprecated && <PermBadge label="DEPRECATED"  color="#fde68a" bg="#3b3523" />}
            </div>

            <p style={{ margin: '0 0 12px', color: 'var(--ch-text-2)', fontSize: 13 }}>{selected.description}</p>

            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--ch-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Syntax</span>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--ch-text)', marginTop: 4 }}>{selected.syntax}</div>
            </div>

            {selected.examples.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--ch-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Examples</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                  {selected.examples.map((ex, i) => (
                    <li key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--ch-text-2)', marginBottom: 2 }}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--ch-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissions</span>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                {ROLE_KEYS.map(r => (
                  <div key={r.key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--ch-text-3)', marginBottom: 2 }}>{r.label}</div>
                    <PermIcon allowed={selected[r.key]} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setSelected(null)} style={btnStyle(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    key: 'admin.overview'    },
  { id: 'live',        key: 'admin.live'        },
  { id: 'users',       key: 'admin.users'       },
  { id: 'rooms',       key: 'admin.rooms'       },
  { id: 'messages',    key: 'admin.messages'    },
  { id: 'reports',     key: 'admin.reports'     },
  { id: 'audit',       key: 'admin.audit'       },
  { id: 'analytics',   key: 'admin.analytics'   },
  { id: 'settings',    key: 'admin.settings'    },
  { id: 'console',     key: 'admin.console'     },
  { id: 'permissions', key: 'admin.permissions' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [tab, setTab] = useState<TabId>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('chat-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('chat-theme', next);
  };

  const handleSignOut = async () => {
    await authService.logout().catch(() => {});
    navigate('/login');
  };

  const renderPanel = () => {
    switch (tab) {
      case 'overview': return <OverviewPanel />;
      case 'live': return <LivePanel />;
      case 'users': return <UsersPanel />;
      case 'rooms': return <RoomsPanel />;
      case 'messages': return <MessagesPanel />;
      case 'reports': return <ReportsPanel />;
      case 'audit': return <AuditPanel />;
      case 'analytics': return <AnalyticsPanel />;
      case 'settings': return <SettingsPanel />;
      case 'console': return <ConsolePanel />;
      case 'permissions': return <PermissionsPanel />;
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--ch-bg)', color: 'var(--ch-text)',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        background: 'var(--ch-header)', borderBottom: '1px solid var(--ch-border)',
        paddingInline: 12, gap: 12, zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
            animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--ch-text)' }}>
            opn<span style={{ color: 'var(--ch-accent)' }}>·</span>{t('admin.dashboard')}
          </span>
        </div>

        {/* Tab nav */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              style={{
                background: tab === tabItem.id ? 'var(--ch-bg-2)' : 'transparent',
                border: tab === tabItem.id ? '1px solid var(--ch-border)' : '1px solid transparent',
                borderRadius: 5, padding: '3px 10px',
                color: tab === tabItem.id ? 'var(--ch-accent)' : 'var(--ch-text-2)',
                fontSize: 12, cursor: 'pointer', fontWeight: tab === tabItem.id ? 600 : 400,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t(tabItem.key)}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 12 }}>
          <span style={{ color: 'var(--ch-text-3)' }}>{user?.nickname}</span>
          <button onClick={toggleTheme} style={{ ...btnStyle(false), padding: '3px 7px', fontSize: 13 }}>{theme === 'dark' ? '☀' : '☾'}</button>
          <button onClick={() => navigate('/chat')} style={{ ...btnStyle(false), padding: '3px 8px' }}>← {t('admin.backToChat')}</button>
          <button onClick={handleSignOut} style={{ ...btnStyle(false), padding: '3px 8px', color: '#ef4444' }}>Sign out</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderPanel()}
      </div>
    </div>
  );
}
