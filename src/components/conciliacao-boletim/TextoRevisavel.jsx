import React, { useState } from 'react';

export default function TextoRevisavel({ texto, limite = 220, className = '' }) {
  const [aberto, setAberto] = useState(false);
  const valor = String(texto || '');
  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-sm leading-5 text-slate-700 whitespace-pre-wrap break-words">
        {aberto || valor.length <= limite ? valor : valor.slice(0, limite) + '…'}
      </p>
      {valor.length > limite && (
        <button
          type="button"
          className="text-xs font-medium text-blue-700 hover:underline"
          onClick={() => setAberto(!aberto)}
        >
          {aberto ? 'Recolher texto' : 'Ler texto completo'}
        </button>
      )}
    </div>
  );
}