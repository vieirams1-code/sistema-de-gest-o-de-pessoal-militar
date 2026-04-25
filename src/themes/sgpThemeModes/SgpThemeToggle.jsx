import React from 'react';
import {
  Flame,
  Moon,
  Shield,
} from 'lucide-react';
import {
  THEME_MODE_LABELS,
  THEME_MODES,
} from './themeModes.constants';

const THEME_OPTIONS = [
  {
    value: THEME_MODES.PADRAO,
    icon: Shield,
  },
  {
    value: THEME_MODES.NOTURNO,
    icon: Moon,
  },
  {
    value: THEME_MODES.BOMBEIRO,
    icon: Flame,
  },
];

export default function SgpThemeToggle({ themeMode, setThemeMode }) {
  return (
    <div
      className="sgp-theme-toggle"
      aria-label="Alternador de tema do sistema"
    >
      <span className="sgp-theme-toggle__title">
        Tema
      </span>

      <div className="sgp-theme-toggle__buttons">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = themeMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setThemeMode(option.value)}
              className={[
                'sgp-theme-toggle__button',
                active ? 'sgp-theme-toggle__button--active' : '',
                option.value === THEME_MODES.BOMBEIRO ? 'sgp-theme-toggle__button--bombeiro' : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={active}
              aria-label={`Ativar tema ${THEME_MODE_LABELS[option.value]}`}
              title={`Tema ${THEME_MODE_LABELS[option.value]}`}
            >
              <Icon className="sgp-theme-toggle__icon" />
              <span>{THEME_MODE_LABELS[option.value]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
