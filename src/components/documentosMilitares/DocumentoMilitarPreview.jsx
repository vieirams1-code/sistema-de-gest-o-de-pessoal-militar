import React, { useMemo } from 'react';

import { montarDadosDocumentoMilitarPreview } from '@/services/documentosMilitares/documentoMilitarPrintConfig';
import './documento-militar-preview.css';

export default function DocumentoMilitarPreview({ texto = '', config, brasaoSrc = '' }) {
  const dados = useMemo(
    () => montarDadosDocumentoMilitarPreview(config, { brasaoSrc }),
    [config, brasaoSrc]
  );

  return (
    <article className="documento-militar-print-area documento-militar-a4" aria-label="Prévia do documento militar">
      {dados.mostrarCabecalho && (
        <header className="documento-militar-cabecalho">
          {dados.brasaoSrc && <img className="documento-militar-brasao" src={dados.brasaoSrc} alt="Brasão institucional" />}
          <div>
            {[dados.orgaoLinha1, dados.orgaoLinha2, dados.orgaoLinha3].filter(Boolean).map((linha, index) => (
              <p key={index} className="documento-militar-orgao">{linha}</p>
            ))}
            <p className="documento-militar-titulo">{dados.tituloDocumentoPadrao}</p>
          </div>
        </header>
      )}

      <section className="documento-militar-corpo">{texto}</section>

      {dados.mostrarAssinatura && (
        <footer className="documento-militar-assinatura">
          {dados.localAssinatura && <p className="documento-militar-local">{dados.localAssinatura}</p>}
          <div className="documento-militar-linha-assinatura" />
          <p className="documento-militar-signatario">{dados.nomeSignatario || 'Signatário responsável'}</p>
          {dados.cargoSignatario && <p>{dados.cargoSignatario}</p>}
          {dados.matriculaSignatario && <p>Matrícula: {dados.matriculaSignatario}</p>}
        </footer>
      )}
    </article>
  );
}
