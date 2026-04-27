import React from 'react';
import {
  Flame,
  Moon,
  Shield,
} from 'lucide-react';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
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

export default function SgpThemeProfileSelector({ themeMode, setThemeMode }) {
  return (
    <>
      <DropdownMenuLabel className="px-2 pb-1 pt-0 text-[11px] uppercase tracking-wide text-slate-500">
        Tema do sistema
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={themeMode}
        onValueChange={setThemeMode}
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {THEME_MODE_LABELS[option.value]}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}
