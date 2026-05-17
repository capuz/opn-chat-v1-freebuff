import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'opnchat-nick-ad-expiry';

function loadExpiry(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export interface UseNickAdUnlockReturn {
  isAdUnlocked: boolean;
  adUnlockExpiry: number | null;
  onAdWatched: (expiryTs: number) => void;
  clearAdUnlock: () => void;
}

export function useNickAdUnlock(): UseNickAdUnlockReturn {
  const [adUnlockExpiry, setAdUnlockExpiry] = useState<number | null>(() => {
    const stored = loadExpiry();
    if (stored !== null && stored <= Date.now()) return null;
    return stored;
  });

  useEffect(() => {
    if (adUnlockExpiry === null) return;
    const remaining = adUnlockExpiry - Date.now();
    if (remaining <= 0) {
      setAdUnlockExpiry(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const timer = setTimeout(() => {
      setAdUnlockExpiry(null);
      localStorage.removeItem(STORAGE_KEY);
    }, remaining);
    return () => clearTimeout(timer);
  }, [adUnlockExpiry]);

  const onAdWatched = useCallback((expiryTs: number) => {
    localStorage.setItem(STORAGE_KEY, String(expiryTs));
    setAdUnlockExpiry(expiryTs);
  }, []);

  const clearAdUnlock = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAdUnlockExpiry(null);
  }, []);

  return {
    isAdUnlocked: adUnlockExpiry !== null && adUnlockExpiry > Date.now(),
    adUnlockExpiry,
    onAdWatched,
    clearAdUnlock,
  };
}
