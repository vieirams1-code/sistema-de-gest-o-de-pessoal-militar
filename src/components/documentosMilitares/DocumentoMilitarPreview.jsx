import React, { useMemo } from 'react';

import { montarDadosDocumentoMilitarPreview } from '@/services/documentosMilitares/documentoMilitarPrintConfig';
import { normalizarTextoDocumentoMilitar } from '@/services/documentosMilitares/normalizarTextoDocumentoMilitar';
import './documento-militar-preview.css';

export default function DocumentoMilitarPreview({ texto = '', config, brasaoSrc = '', tituloDocumento = '' }) {
  const dados = useMemo(
    () => montarDadosDocumentoMilitarPreview(config, { brasaoSrc, tituloDocumento }),
    [config, brasaoSrc, tituloDocumento]
  );
  const textoNormalizado = useMemo(() => normalizarTextoDocumentoMilitar(texto), [texto]);

  return (
    <article className="documento-militar-print-area documento-militar-a4" aria-label="Prévia do documento militar">
      {dados.mostrarCabecalho && (
        <header className="documento-militar-cabecalho">
          {dados.imagemCabecalhoSrc && (
            <img
              className="documento-militar-imagem-cabecalho"
              src={dados.imagemCabecalhoSrc}
              alt="Imagem institucional do cabeçalho"
            />
          )}
          <div className="documento-militar-instituicao">
            {dados.linhasInstitucionais.map((linha, index) => (
              <p key={`${linha}-${index}`} className="documento-militar-orgao">{linha}</p>
            ))}
          </div>
        </header>
      )}

      {dados.tituloDocumento && (
        <h1 className="documento-militar-titulo">{dados.tituloDocumento}</h1>
      )}

      <section className="documento-militar-corpo">{textoNormalizado}</section>

      {dados.mostrarAssinatura && (
        <section className="documento-militar-assinatura" aria-label="Assinatura do documento militar">
          {dados.localAssinatura && <p className="documento-militar-local">{dados.localAssinatura}</p>}
          <div className="documento-militar-linha-assinatura" />
          <p className="documento-militar-signatario">{dados.nomeSignatario || 'Signatário responsável'}</p>
          {dados.cargoSignatario && <p>{dados.cargoSignatario}</p>}
          {dados.matriculaSignatario && <p>Matrícula: {dados.matriculaSignatario}</p>}
        </section>
      )}

      {dados.rodapeLinhas.length > 0 && (
        <footer className="documento-militar-rodape" aria-label="Rodapé institucional do documento militar">
          {dados.rodapeLinhas.map((linha, index) => (
            <p key={`${linha}-${index}`}>{linha}</p>
          ))}
        </footer>
      )}
    </article>
  );
}
