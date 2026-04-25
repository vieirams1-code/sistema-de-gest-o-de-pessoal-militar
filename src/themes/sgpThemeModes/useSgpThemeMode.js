import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME_MODE,
  THEME_MODES,
  isValidThemeMode,
} from './themeModes.constants';
import {
  clearStoredThemeMode,
  getStoredThemeMode,
  setStoredThemeMode,
} from './themeModes.storage';

function applyThemeModeToDocument(mode) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (!isValidThemeMode(mode) || mode === THEME_MODES.PADRAO) {
    delete root.dataset.sgpTheme;
    return;
  }

  root.dataset.sgpTheme = mode;
}

export default function useSgpThemeMode() {
  const [themeMode, setThemeModeState] = useState(() => getStoredThemeMode());

  useEffect(() => {
    applyThemeModeToDocument(themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback((nextMode) => {
    const safeMode = isValidThemeMode(nextMode) ? nextMode : DEFAULT_THEME_MODE;

    if (safeMode === THEME_MODES.PADRAO) {
      clearStoredThemeMode();
    } else {
      setStoredThemeMode(safeMode);
    }

    setThemeModeState(safeMode);
    applyThemeModeToDocument(safeMode);
  }, []);

  return useMemo(() => ({
    themeMode,
    setThemeMode,
    isPadraoMode: themeMode === THEME_MODES.PADRAO,
    isNoturnoMode: themeMode === THEME_MODES.NOTURNO,
    isBombeiroMode: themeMode === THEME_MODES.BOMBEIRO,
  }), [themeMode, setThemeMode]);
}
