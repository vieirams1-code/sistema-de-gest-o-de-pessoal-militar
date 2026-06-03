import React, { useMemo } from 'react';

import { montarDadosDocumentoMilitarPreview } from '@/services/documentosMilitares/documentoMilitarPrintConfig';
import {
  montarAssinaturaSignatario,
  montarLinhaIdentificacaoSignatario,
} from '@/services/documentosMilitares/documentoMilitarSignatarioService';
import {
  ASSINATURA_SIGNATARIO_MARKER_END,
  ASSINATURA_SIGNATARIO_MARKER_START,
} from '@/services/documentosMilitares/gerarDocumentoMilitarService';
import { normalizarTextoDocumentoMilitar } from '@/services/documentosMilitares/normalizarTextoDocumentoMilitar';
import './documento-militar-preview.css';

function renderizarTextoComAssinaturaCentralizada(texto) {
  const partes = String(texto || '').split(new RegExp(`(${ASSINATURA_SIGNATARIO_MARKER_START}[\\s\\S]*?${ASSINATURA_SIGNATARIO_MARKER_END})`, 'g'));

  return partes.map((parte, index) => {
    if (!parte) return null;

    if (parte.startsWith(ASSINATURA_SIGNATARIO_MARKER_START)) {
      const assinatura = parte
        .replace(ASSINATURA_SIGNATARIO_MARKER_START, '')
        .replace(ASSINATURA_SIGNATARIO_MARKER_END, '')
        .trim();

      if (!assinatura) return null;

      return (
        <div key={`assinatura-${index}`} className="documento-militar-assinatura-inline">
          {assinatura}
        </div>
      );
    }

    return <React.Fragment key={`texto-${index}`}>{parte}</React.Fragment>;
  });
}

export default function DocumentoMilitarPreview({
  texto = '',
  config,
  brasaoSrc = '',
  tituloDocumento = '',
  exibirTituloAutomatico = true,
  variant = 'screen',
}) {
  const dados = useMemo(
    () => montarDadosDocumentoMilitarPreview(config, { brasaoSrc, tituloDocumento }),
    [config, brasaoSrc, tituloDocumento]
  );
  const textoNormalizado = useMemo(() => normalizarTextoDocumentoMilitar(texto), [texto]);
  const assinaturaSignatario = useMemo(() => montarAssinaturaSignatario({
    nome: dados.nomeSignatario,
    postoGraduacao: dados.postoGraduacaoSignatario,
    quadro: dados.quadroSignatario,
    matricula: dados.matriculaSignatario,
    funcao: dados.funcaoSignatario || dados.cargoSignatario,
  }), [dados]);
  const linhaIdentificacaoLegada = useMemo(() => montarLinhaIdentificacaoSignatario({
    nome: dados.nomeSignatario,
    postoGraduacao: dados.postoGraduacaoSignatario,
    quadro: dados.quadroSignatario,
  }), [dados.nomeSignatario, dados.postoGraduacaoSignatario, dados.quadroSignatario]);
  const isPrint = variant === 'print';

  return (
    <article
      className={[
        'documento-militar-documento documento-militar-a4',
        isPrint ? 'documento-militar-print-document' : 'documento-militar-screen-document',
      ].join(' ')}
      aria-label={isPrint ? 'Documento militar para impressão' : 'Prévia do documento militar'}
    >
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

      {exibirTituloAutomatico && dados.tituloDocumento && (
        <h1 className="documento-militar-titulo">{dados.tituloDocumento}</h1>
      )}

      <section className="documento-militar-corpo">{renderizarTextoComAssinaturaCentralizada(textoNormalizado)}</section>

      {dados.mostrarAssinatura && (
        <section className="documento-militar-assinatura" aria-label="Assinatura do documento militar">
          {dados.localAssinatura && <p className="documento-militar-local">{dados.localAssinatura}</p>}
          <div className="documento-militar-linha-assinatura" />
          {assinaturaSignatario ? (
            <div className="documento-militar-assinatura-texto">{assinaturaSignatario}</div>
          ) : (
            <p className="documento-militar-signatario">{linhaIdentificacaoLegada || 'Signatário responsável'}</p>
          )}
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
