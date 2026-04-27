import React from 'react';
import SgpThemeBombeiroDecorations from './SgpThemeBombeiroDecorations';

import './theme-modes.css';
import './theme-bombeiro.css';
import './theme-noturno.css';

export default function SgpThemeModeMount({ isBombeiroMode = false }) {
  return (
    <>
      {isBombeiroMode && <SgpThemeBombeiroDecorations />}
    </>
  );
}
