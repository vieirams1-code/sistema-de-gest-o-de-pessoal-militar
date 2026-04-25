export const THEME_MODES = Object.freeze({
  PADRAO: 'padrao',
  NOTURNO: 'noturno',
  BOMBEIRO: 'bombeiro',
});

export const DEFAULT_THEME_MODE = THEME_MODES.PADRAO;

export const THEME_MODE_STORAGE_KEY = 'sgp-theme-mode-v1';

export const THEME_MODE_LABELS = Object.freeze({
  [THEME_MODES.PADRAO]: 'Padrão',
  [THEME_MODES.NOTURNO]: 'Noturno',
  [THEME_MODES.BOMBEIRO]: 'Bombeiro',
});

export function isValidThemeMode(mode) {
  return Object.values(THEME_MODES).includes(mode);
}
