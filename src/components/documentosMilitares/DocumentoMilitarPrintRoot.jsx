import React from 'react';

import DocumentoMilitarPreview from './DocumentoMilitarPreview';

/**
 * Container de impressão dedicado mantido por compatibilidade.
 *
 * O modal atual renderiza a seção equivalente diretamente fora dos wrappers visuais,
 * seguindo o mesmo contrato de classe usado pelo CSS de impressão.
 */
export default function DocumentoMilitarPrintRoot({ texto = '', config, tituloDocumento = '', exibirTituloAutomatico = true }) {
  return (
    <section className="documento-militar-print-only-document" aria-hidden="true">
      <DocumentoMilitarPreview
        texto={texto}
        config={config}
        tituloDocumento={tituloDocumento}
        exibirTituloAutomatico={exibirTituloAutomatico}
        variant="print"
      />
    </section>
  );
}
