import React from 'react';

export default function SgpThemeBombeiroDecorations() {
  return (
    <div
      className="sgp-bombeiro-decor"
      aria-hidden="true"
    >
      <div className="sgp-bombeiro-siren">
        <span className="sgp-bombeiro-siren__light" />
      </div>

      <div className="sgp-bombeiro-side-glow sgp-bombeiro-side-glow--left" />
      <div className="sgp-bombeiro-side-glow sgp-bombeiro-side-glow--right" />

      <div className="sgp-bombeiro-bottom-stripe">
        <span>🚒 MODO BOMBEIRO ATIVO · DISCIPLINA · CORAGEM · ABNEGAÇÃO</span>
      </div>
    </div>
  );
}
