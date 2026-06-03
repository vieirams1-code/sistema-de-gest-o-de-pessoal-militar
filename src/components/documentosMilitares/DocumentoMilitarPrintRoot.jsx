import React from 'react';

import DocumentoMilitarPreview from './DocumentoMilitarPreview';

/**
 * Container de impressão dedicado.
 *
 * - Renderizado FORA do modal (no final do <body> via React tree raiz do modal).
 * - Invisível na tela (display:none via CSS).
 * - Visível somente em @media print.
 * - Contém exatamente uma <DocumentoMilitarPreview /> (uma única área imprimível).
 * - Não depende de wrappers do modal (sem grid/flex/max-height/overflow).
 */
export default function DocumentoMilitarPrintRoot({ texto = '', config, tituloDocumento = '' }) {
  return (
    <div className="documento-militar-print-root documento-militar-print-only" aria-hidden="true">
      <DocumentoMilitarPreview texto={texto} config={config} tituloDocumento={tituloDocumento} />
    </div>
  );
}