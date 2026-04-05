import React from 'react';
import { classificarPostoGraduacao } from '@/utils/postoQuadroCompatibilidade';

function valorComFallback(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto ? texto : fallback;
}

function montarIdentidade(militar) {
  const rg = String(militar?.rg || '').trim();
  const orgao = String(militar?.orgao_expedidor_rg || '').trim();
  if (rg && orgao) return `${rg} / ${orgao}`;
  if (rg) return rg;
  if (orgao) return orgao;
  return 'Não informado';
}

function obterObm(militar) {
  return valorComFallback(militar?.unidade || militar?.unidade_lotacao || militar?.lotacao);
}

export default function FolhaAlteracoesDocumento({
  previa,
  historicoPorAnoMes,
  loadingHistorico,
  localFechamento,
  dataFechamento,
  impressaoConfig,
  variant = 'screen',
  formatarData,
}) {
  if (!previa) return null;

  let contadorEventos = 0;
  const isPrint = variant === 'print';
  const localAssinatura = String(impressaoConfig?.localAssinatura || '').trim() || localFechamento;
  const dataAssinatura = String(dataFechamento || '').trim();
  const cabecalhoAssinatura = localAssinatura
    ? `${localAssinatura}, ${dataAssinatura}.`
    : `${dataAssinatura}.`;
  const classificacaoMilitar = classificarPostoGraduacao(previa?.militar?.posto_graduacao);
  const exibirComportamento = classificacaoMilitar === 'praca';

  return (
    <article
      className={[
        'fa-doc',
        isPrint ? 'fa-doc-print' : 'fa-doc-screen rounded-md border border-slate-300 bg-white p-6',
      ].join(' ')}
    >
      <header className="text-center">
        <p className="text-[11pt] font-semibold uppercase tracking-wide">ESTADO DE MATO GROSSO DO SUL</p>
        <p className="text-[11pt] font-semibold uppercase tracking-wide">CORPO DE BOMBEIROS MILITAR</p>
        <p className="text-[10.5pt] uppercase tracking-wide">{valorComFallback(impressaoConfig?.cabecalhoLinha3, obterObm(previa.militar))}</p>
        <p className="text-[10.5pt] uppercase tracking-wide">{valorComFallback(impressaoConfig?.cabecalhoLinha4)}</p>
        <div className="my-2 border-t border-black" />
        <h1 className="text-[14pt] font-bold uppercase">FOLHA DE ALTERAÇÕES</h1>
      </header>

      <section className="mt-4 border border-black p-3 text-[10.5pt]">
        <div className="grid grid-cols-1 gap-y-1 md:grid-cols-2 md:gap-x-6">
          <p><strong>Nome:</strong> {valorComFallback(previa.militar.nome_completo)}</p>
          <p><strong>Matrícula:</strong> {valorComFallback(previa.militar.matricula)}</p>
          <p><strong>Posto/Graduação:</strong> {valorComFallback(previa.militar.posto_graduacao)}</p>
          <p><strong>Quadro:</strong> {valorComFallback(previa.militar.quadro)}</p>
          <p><strong>Identidade / Órgão Expedidor:</strong> {montarIdentidade(previa.militar)}</p>
          <p><strong>OBM:</strong> {obterObm(previa.militar)}</p>
          <p>
            <strong>Período da folha:</strong> {formatarData(previa.periodo.dataInicial)} a {formatarData(previa.periodo.dataFinal)}
          </p>
          {exibirComportamento && (
            <p><strong>Comportamento:</strong> {valorComFallback(previa.militar.comportamento, 'Sem alteração')}</p>
          )}
        </div>
      </section>

      <section className="mt-4 text-[11pt]">
        {loadingHistorico && <p>Carregando histórico do período...</p>}

        {!loadingHistorico && historicoPorAnoMes.length === 0 && (
          <p>Não foi possível montar o histórico para o período selecionado.</p>
        )}

        {!loadingHistorico && historicoPorAnoMes.length > 0 && historicoPorAnoMes.map((ano) => (
          <div key={ano.ano} className="mt-3">
            <h2 className="font-bold uppercase">ANO {ano.ano}</h2>

            {ano.meses.map((mes) => (
              <div key={mes.chave} className="mt-2 pl-3">
                <h3 className="font-semibold uppercase">{mes.titulo}</h3>

                {mes.eventos.length === 0 ? (
                  <p className="italic">Sem alteração</p>
                ) : (
                  <ol className="mt-1 space-y-1">
                    {mes.eventos.map((evento, index) => {
                      contadorEventos += 1;
                      return (
                        <li
                          key={`${evento.origem}-${evento.data}-${index}`}
                          className="grid grid-cols-[auto,1fr] gap-x-2 leading-[1.5]"
                        >
                          <span className="font-semibold">({contadorEventos})</span>
                          <div>
                            <p className="m-0 text-justify [text-justify:inter-word] whitespace-pre-line">{evento.texto}</p>
                            {evento.referenciaBoletim && (
                              <p className="mt-0.5 text-[10pt] text-slate-700">{evento.referenciaBoletim}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      <footer className="mt-8 text-[11pt]">
        <p className="text-right">
          {cabecalhoAssinatura}
        </p>

        <div className="mt-16 mx-auto w-[110mm] max-w-full text-center px-2">
          <div className="border-t border-black px-2 pt-1">
            <p className="fa-signature-line mx-auto w-fit max-w-full whitespace-nowrap break-keep font-semibold uppercase leading-tight text-[10.5pt]">
              {valorComFallback(impressaoConfig?.signatarioLinha1, '')}
            </p>
            <p className="font-semibold uppercase leading-tight text-[10.5pt]">
              {valorComFallback(impressaoConfig?.signatarioLinha2, '')}
            </p>
            <p className="font-semibold leading-tight text-[10.5pt]">{valorComFallback(impressaoConfig?.cargoFuncao, 'ASSINATURA')}</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
