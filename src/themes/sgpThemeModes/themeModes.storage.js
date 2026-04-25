import {
  DEFAULT_THEME_MODE,
  THEME_MODE_STORAGE_KEY,
  isValidThemeMode,
} from './themeModes.constants';

export function getStoredThemeMode() {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE;

  try {
    const storedValue = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isValidThemeMode(storedValue) ? storedValue : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function setStoredThemeMode(mode) {
  if (typeof window === 'undefined') return;

  try {
    if (!isValidThemeMode(mode)) return;
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Falha silenciosa: tema visual não deve quebrar o sistema.
  }
}

export function clearStoredThemeMode() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(THEME_MODE_STORAGE_KEY);
  } catch {
    // Falha silenciosa: tema visual não deve quebrar o sistema.
  }
}
