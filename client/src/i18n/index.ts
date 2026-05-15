// Re-exports from the new React context — use useTranslation() in components
export type { SupportedLanguage } from './I18nContext';
export { useTranslation, I18nProvider } from './I18nContext';

// Standalone t() — for use outside of React components (e.g. utility functions)
export { standaloneT as t } from './I18nContext';
