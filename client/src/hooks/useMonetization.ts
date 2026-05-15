// NOTE: All limits here are client-side UI hints only. Server-side enforcement
// is required for real monetization gates. These values can be bypassed via
// browser DevTools by editing localStorage.
import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'opnchat-monetization';
const BOOST_DURATION_MS = 60 * 60 * 1000;       // 60 minutes
const ROOM_SLOT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const NICK_AD_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours (matches NickAd:UnlockHours)

interface MonetizationState {
  freeRoomUsed: boolean;
  nickChangesUsedToday: number;
  nickChangesDate: string;
  nickAdExpiry: number | null;
  temporaryRoomSlots: number;
  temporaryRoomSlotsExpiry: number | null;
  roomBoosts: Record<string, number>;
  boostTokens: Record<string, number>;
  dismissedAnnouncements: string[];
}

const DEFAULT_STATE: MonetizationState = {
  freeRoomUsed: false,
  nickChangesUsedToday: 0,
  nickChangesDate: '',
  nickAdExpiry: null,
  temporaryRoomSlots: 0,
  temporaryRoomSlotsExpiry: null,
  roomBoosts: {},
  boostTokens: {},
  dismissedAnnouncements: [],
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): MonetizationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function save(state: MonetizationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export interface UseMonetizationReturn {
  canCreateRoom: boolean;
  hasActiveRoomSlot: boolean;
  nickChangesLeftToday: number;
  nickChangesMaxToday: number;
  nickAdExpiry: number | null;
  isRoomBoosted: (id: string) => boolean;
  getBoostExpiry: (id: string) => number | null;
  consumeFreeRoom: () => void;
  consumeRoomSlot: () => void;
  watchAdForRoomSlot: () => void;
  watchAdForNickChange: (expiryTs: number) => void;
  consumeNickChange: () => void;
  boostRoom: (id: string) => void;
  grantBoostToken: (roomId: string) => void;
  consumeBoostToken: (roomId: string) => void;
  hasBoostToken: (roomId: string) => boolean;
  dismissAnnouncement: (id: string) => void;
  isAnnouncementDismissed: (id: string) => boolean;
  resetDismissedAnnouncements: () => void;
  state: MonetizationState;
}

export function useMonetization(): UseMonetizationReturn {
  const [state, setState] = useState<MonetizationState>(load);

  const update = useCallback((updater: (prev: MonetizationState) => MonetizationState) => {
    setState(prev => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  // Auto-clear expired nick ad unlock
  useEffect(() => {
    if (state.nickAdExpiry !== null) {
      const remaining = state.nickAdExpiry - Date.now();
      if (remaining <= 0) {
        update(prev => ({ ...prev, nickAdExpiry: null }));
        return;
      }
      const timer = setTimeout(() => {
        update(prev => ({ ...prev, nickAdExpiry: null }));
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [state.nickAdExpiry, update]);

  // Auto-clear expired room slots
  useEffect(() => {
    if (state.temporaryRoomSlots > 0 && state.temporaryRoomSlotsExpiry !== null) {
      const remaining = state.temporaryRoomSlotsExpiry - Date.now();
      if (remaining <= 0) {
        update(prev => ({ ...prev, temporaryRoomSlots: 0, temporaryRoomSlotsExpiry: null }));
        return;
      }
      const timer = setTimeout(() => {
        update(prev => ({ ...prev, temporaryRoomSlots: 0, temporaryRoomSlotsExpiry: null }));
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [state.temporaryRoomSlots, state.temporaryRoomSlotsExpiry, update]);

  // Auto-clear expired boosts every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setState(prev => {
        const hasExpired = Object.values(prev.roomBoosts).some(exp => exp <= now);
        if (!hasExpired) return prev;
        const cleaned = Object.fromEntries(
          Object.entries(prev.roomBoosts).filter(([, exp]) => exp > now)
        );
        const next = { ...prev, roomBoosts: cleaned };
        save(next);
        return next;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const hasActiveRoomSlot = useMemo(() => {
    return (
      state.temporaryRoomSlots > 0 &&
      state.temporaryRoomSlotsExpiry !== null &&
      Date.now() < state.temporaryRoomSlotsExpiry
    );
  }, [state.temporaryRoomSlots, state.temporaryRoomSlotsExpiry]);

  const nickChangesMaxToday = useMemo(() => {
    const adBonus = state.nickAdExpiry !== null && state.nickAdExpiry > Date.now() ? 1 : 0;
    return 1 + adBonus;
  }, [state.nickAdExpiry]);

  const nickChangesLeftToday = useMemo(() => {
    const today = todayStr();
    const usedToday = state.nickChangesDate === today ? state.nickChangesUsedToday : 0;
    return Math.max(0, nickChangesMaxToday - usedToday);
  }, [state.nickChangesDate, state.nickChangesUsedToday, nickChangesMaxToday]);

  const canCreateRoom = !state.freeRoomUsed || hasActiveRoomSlot;

  const isRoomBoosted = useCallback((id: string) => {
    const expiry = state.roomBoosts[id];
    return expiry !== undefined && expiry > Date.now();
  }, [state.roomBoosts]);

  const getBoostExpiry = useCallback((id: string) => {
    return state.roomBoosts[id] ?? null;
  }, [state.roomBoosts]);

  const consumeFreeRoom = useCallback(() => {
    update(prev => ({ ...prev, freeRoomUsed: true }));
  }, [update]);

  const consumeRoomSlot = useCallback(() => {
    update(prev => ({
      ...prev,
      temporaryRoomSlots: Math.max(0, prev.temporaryRoomSlots - 1),
      temporaryRoomSlotsExpiry: prev.temporaryRoomSlots <= 1 ? null : prev.temporaryRoomSlotsExpiry,
    }));
  }, [update]);

  const watchAdForRoomSlot = useCallback(() => {
    const expiry = Date.now() + ROOM_SLOT_DURATION_MS;
    update(prev => ({
      ...prev,
      temporaryRoomSlots: prev.temporaryRoomSlots + 1,
      temporaryRoomSlotsExpiry: expiry,
    }));
  }, [update]);

  const watchAdForNickChange = useCallback((expiryTs: number) => {
    update(prev => ({ ...prev, nickAdExpiry: expiryTs }));
  }, [update]);

  const consumeNickChange = useCallback(() => {
    const today = todayStr();
    update(prev => {
      const usedToday = prev.nickChangesDate === today ? prev.nickChangesUsedToday : 0;
      return { ...prev, nickChangesUsedToday: usedToday + 1, nickChangesDate: today };
    });
  }, [update]);

  const boostRoom = useCallback((id: string) => {
    const expiry = Date.now() + BOOST_DURATION_MS;
    update(prev => ({
      ...prev,
      roomBoosts: { ...prev.roomBoosts, [id]: expiry },
    }));
  }, [update]);

  const grantBoostToken = useCallback((roomId: string) => {
    update(prev => ({
      ...prev,
      boostTokens: { ...prev.boostTokens, [roomId]: (prev.boostTokens[roomId] ?? 0) + 1 },
    }));
  }, [update]);

  const consumeBoostToken = useCallback((roomId: string) => {
    update(prev => ({
      ...prev,
      boostTokens: { ...prev.boostTokens, [roomId]: Math.max(0, (prev.boostTokens[roomId] ?? 0) - 1) },
    }));
  }, [update]);

  const hasBoostToken = useCallback((roomId: string) => {
    return (state.boostTokens[roomId] ?? 0) > 0;
  }, [state.boostTokens]);

  const dismissAnnouncement = useCallback((id: string) => {
    update(prev => ({
      ...prev,
      dismissedAnnouncements: prev.dismissedAnnouncements.includes(id)
        ? prev.dismissedAnnouncements
        : [...prev.dismissedAnnouncements, id],
    }));
  }, [update]);

  const isAnnouncementDismissed = useCallback((id: string) => {
    return state.dismissedAnnouncements.includes(id);
  }, [state.dismissedAnnouncements]);

  const resetDismissedAnnouncements = useCallback(() => {
    update(prev => ({ ...prev, dismissedAnnouncements: [] }));
  }, [update]);

  return {
    canCreateRoom,
    hasActiveRoomSlot,
    nickChangesLeftToday,
    nickChangesMaxToday,
    nickAdExpiry: state.nickAdExpiry,
    isRoomBoosted,
    getBoostExpiry,
    consumeFreeRoom,
    consumeRoomSlot,
    watchAdForRoomSlot,
    watchAdForNickChange,
    consumeNickChange,
    boostRoom,
    grantBoostToken,
    consumeBoostToken,
    hasBoostToken,
    dismissAnnouncement,
    isAnnouncementDismissed,
    resetDismissedAnnouncements,
    state,
  };
}
