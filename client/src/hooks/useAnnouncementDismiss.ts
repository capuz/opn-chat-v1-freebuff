import { useState, useCallback } from 'react';

const SS_KEY = 'dismissed-announcements';

function loadFromSession(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useAnnouncementDismiss() {
  const [dismissed, setDismissed] = useState<string[]>(loadFromSession);

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      sessionStorage.setItem(SS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isDismissed = useCallback((id: string) => dismissed.includes(id), [dismissed]);

  return { dismiss, isDismissed };
}
