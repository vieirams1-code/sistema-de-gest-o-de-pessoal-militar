import React from 'react';
import useSgpThemeMode from './useSgpThemeMode';
import SgpThemeToggle from './SgpThemeToggle';
import SgpThemeBombeiroDecorations from './SgpThemeBombeiroDecorations';

import './theme-modes.css';
import './theme-bombeiro.css';
import './theme-noturno.css';

export default function SgpThemeModeMount() {
  const {
    themeMode,
    setThemeMode,
    isBombeiroMode,
  } = useSgpThemeMode();

  return (
    <>
      <SgpThemeToggle
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />

      {isBombeiroMode && <SgpThemeBombeiroDecorations />}
    </>
  );
}
