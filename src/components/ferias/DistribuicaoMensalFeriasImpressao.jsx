import React from 'react';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import { isQuadroTemporario } from '@/services/controleAtestadosTemporariosService';

const CSS_IMPRESSAO = `
  @media screen {
    .dme-print-root { display: none !important; }
  }

  @media print {
    @page { size: A4 landscape; margin: 10mm 10mm 8mm 10mm; }

    body { background: #fff !important; }
    body * { visibility: hidden !important; }

    .dme-print-root,
    .dme-print-root * { visibility: visible !important; }

    .dme-print-root {
      display: block !important;
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      color: #111827 !important;
      font-family: "Times New Roman", Times, serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .dme-header {
      text-align: center !important;
      border-bottom: 0.6mm solid #111827 !important;
      padding-bottom: 2mm !important;
    }
    .dme-header h1 { font-size: 14pt !important; font-weight: 700 !important; text-transform: uppercase !important; margin: 0 !important; letter-spacing: normal !important; }
    .dme-sub { font-size: 9.5pt !important; margin: 1mm 0 0 0 !important; }
    .dme-emissao { font-size: 8.5pt !important; margin: 0.6mm 0 0 0 !important; }

    .dme-grid {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 3mm !important;
      margin-top: 3mm !important;
    }

    .dme-bloco {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      border: 0.35mm solid #6b7280 !important;
      padding: 1.6mm 2mm !important;
    }
    .dme-bloco-topo {
      display: flex !important;
      align-items: baseline !important;
      justify-content: space-between !important;
      gap: 2mm !important;
      border-bottom: 0.35mm solid #9ca3af !important;
      padding-bottom: 0.8mm !important;
    }
    .dme-bloco-topo h2 { font-size: 9.5pt !important; font-weight: 700 !important; text-transform: uppercase !important; margin: 0 !important; }
    .dme-contagem { font-size: 9pt !important; font-weight: 700 !important; }

    .dme-lista {
      list-style: none !important;
      margin: 1mm 0 0 0 !important;
      padding: 0 !important;
      columns: 2 !important;
      column-gap: 3mm !important;
    }
    .dme-item {
      display: flex !important;
      justify-content: space-between !important;
      align-items: baseline !important;
      gap: 1.5mm !important;
      font-size: 7.6pt !important;
      line-height: 1.35 !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      padding: 0.2mm 0 !important;
    }
    .dme-item-nome { display: inline-flex !important; align-items: center !important; gap: 0.8mm !important; min-width: 0 !important; }
    .dme-t { font-weight: 700 !important; margin-right: 0.6mm !important; }
    .dme-item-posto { color: #4b5563 !important; white-space: nowrap !important; font-size: 7pt !important; }
    .dme-cov { display: inline-flex !important; align-items: center !important; flex: none !important; }
    .dme-cov svg { width: 2.6mm !important; height: 2.6mm !important; }
    .dme-vazio { font-size: 7.8pt !important; font-style: italic !important; color: #4b5563 !important; margin: 1.2mm 0 0 0 !important; }

    .dme-grupo { margin-top: 1mm !important; }
    .dme-grupo-titulo {
      font-size: 7pt !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      color: #374151 !important;
      margin: 1mm 0 0.4mm 0 !important;
    }

    .dme-rodape {
      margin-top: 3mm !important;
      border-top: 0.35mm solid #6b7280 !important;
      padding-top: 1.2mm !important;
      font-size: 8pt !important;
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 1mm 6mm !important;
    }
    .dme-rodape p { margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 0.8mm !important; }
    .dme-rodape svg { width: 2.8mm !important; height: 2.8mm !important; }
  }
`;

function formatarEmissao(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} às ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function MilitarLinha({ pessoa, militaresCov }) {
  const temporario = isQuadroTemporario(pessoa?.quadro || pessoa?.militar_quadro);
  const temCov = militaresCov?.ids?.has(String(pessoa?.militar_id || ''));

  return (
    <li className="dme-item">
      <span className="dme-item-nome">
        {temporario && <strong className="dme-t">T</strong>}
        <span>{pessoa?.militar_nome || 'Militar'}</span>
        {temCov && (
          <span className="dme-cov">
            <IconeCatalogo value={militaresCov.icone} />
          </span>
        )}
      </span>
      <span className="dme-item-posto">{pessoa?.militar_posto || ''}</span>
    </li>
  );
}

function GrupoImpressao({ titulo, pessoas, militaresCov }) {
  if (!pessoas.length) return null;

  return (
    <div className="dme-grupo">
      <p className="dme-grupo-titulo">{titulo} · {pessoas.length}</p>
      <ul className="dme-lista">
        {pessoas.map((pessoa, index) => (
          <MilitarLinha key={`${pessoa?.id || pessoa?.militar_id}-${index}`} pessoa={pessoa} militaresCov={militaresCov} />
        ))}
      </ul>
    </div>
  );
}

export default function DistribuicaoMensalFeriasImpressao({
  planoTitulo,
  anoReferencia,
  meses,
  distribuicao,
  totalPublico,
  militaresCov,
  emitidoEm,
}) {
  return (
    <section className="dme-print-root" aria-hidden="true">
      <style>{CSS_IMPRESSAO}</style>

      <article className="dme-sheet">
        <header className="dme-header">
          <h1>{planoTitulo || 'Plano de Férias'}</h1>
          <p className="dme-sub">Distribuição mensal das férias · Ano de referência {anoReferencia || '-'}</p>
          <p className="dme-emissao">
            Emitido em {formatarEmissao(emitidoEm)} · {totalPublico} militares no plano
          </p>
        </header>

        <div className="dme-grid">
          {meses.map((mes) => {
            const grupos = distribuicao?.[mes.val] || { integrais: [], fracionados: [] };
            const integrais = grupos.integrais || [];
            const fracionados = grupos.fracionados || [];
            const total = integrais.length + fracionados.length;
            return (
              <section key={mes.val} className="dme-bloco">
                <div className="dme-bloco-topo">
                  <h2>{mes.nome}</h2>
                  <span className="dme-contagem">{total}</span>
                </div>

                {total === 0 && <p className="dme-vazio">Nenhuma definição neste mês.</p>}

                <GrupoImpressao titulo="Integral · 30 dias" pessoas={integrais} militaresCov={militaresCov} />
                <GrupoImpressao titulo="Fracionado" pessoas={fracionados} militaresCov={militaresCov} />
              </section>
            );
          })}
        </div>

        <footer className="dme-rodape">
          <p><strong>T</strong> militar de quadro temporário (QOETBM, QOSTBM ou QPTBM).</p>
          <p>
            <IconeCatalogo value={militaresCov?.icone} /> militar com a tag COV ativa.
          </p>
          <p><strong>Integral</strong> 30 dias gozados em um único mês; <strong>Fracionado</strong> dias divididos em mais de um mês.</p>
          <p>Lista integral de cada mês, do posto/graduação mais antigo ao mais moderno.</p>
        </footer>
      </article>
    </section>
  );
}