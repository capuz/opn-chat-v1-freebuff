export const formatTimestamp = (date: string | Date, locale: string): string =>
  new Date(date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

export const formatFullDate = (date: string | Date, locale: string): string =>
  new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });

export const formatDateTime = (date: string | Date, locale: string): string =>
  new Date(date).toLocaleString(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
