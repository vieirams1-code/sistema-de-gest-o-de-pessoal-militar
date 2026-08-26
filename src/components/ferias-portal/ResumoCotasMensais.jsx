import React, { useState, useMemo } from 'react';

const MESES = [
  { id: 'jan', val: '01', nome: 'Jan', nomeCompleto: 'Janeiro' },
  { id: 'fev', val: '02', nome: 'Fev', nomeCompleto: 'Fevereiro' },
  { id: 'mar', val: '03', nome: 'Mar', nomeCompleto: 'Março' },
  { id: 'abr', val: '04', nome: 'Abr', nomeCompleto: 'Abril' },
  { id: 'mai', val: '05', nome: 'Mai', nomeCompleto: 'Maio' },
  { id: 'jun', val: '06', nome: 'Jun', nomeCompleto: 'Junho' },
  { id: 'jul', val: '07', nome: 'Jul', nomeCompleto: 'Julho' },
  { id: 'ago', val: '08', nome: 'Ago', nomeCompleto: 'Agosto' },
  { id: 'set', val: '09', nome: 'Set', nomeCompleto: 'Setembro' },
  { id: 'out', val: '10', nome: 'Out', nomeCompleto: 'Outubro' },
  { id: 'nov', val: '11', nome: 'Nov', nomeCompleto: 'Novembro' },
  { id: 'dez', val: '12', nome: 'Dez', nomeCompleto: 'Dezembro' },
];

function normalizarMes(mesStr) {
  if (!mesStr) return '';
  const str = String(mesStr).toLowerCase().trim();
  const m = MESES.find(
    (item) =>
      item.id === str ||
      item.val === str ||
      item.nome.toLowerCase() === str ||
      item.nomeCompleto.toLowerCase() === str
  );
  return m ? m.id : str;
}

export default function ResumoCotasMensais({
  totalEfetivo = 238,
  solicitacoes = [],
  titulo = 'Distribuição Mensal & Teto de Pagamento (10%)',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('teto'); // 'teto' | 'ocupacao'

  const teto10Porcento = Math.ceil((totalEfetivo || 1) * 0.1);

  // Cálculos reativos por mês
  const estatisticasPorMes = useMemo(() => {
    const mapa = {};
    MESES.forEach((m) => {
      mapa[m.id] = {
        mes: m,
        integrais: 0,
        fracao1: 0,
        fracao2e3: 0,
        totalGeral: 0,
        iniciosPagamento: 0,
        percentualInicios: 0,
        excedeuTeto: false,
      };
    });

    (solicitacoes || []).forEach((item) => {
      // Verifica se a opção está salva / confirmada
      const isConfirmado =
        item.status === 'Homologado' ||
        item.status === 'Salvo' ||
        item.status_camada_1 === 'Aprovado_Gestor' ||
        item.status_camada_1 === 'Salvo' ||
        Boolean(item.decisao_camada_1_meses) ||
        Boolean(item.escala_definida);

      // Usamos tanto as decisões reais quanto as preferências mockadas para pré-visualização
      const modalidade = item.modalidade || item.modalidadeResumo || '2_ETAPAS_15';
      const isIntegral =
        modalidade.includes('1_ETAPA') ||
        modalidade.toLowerCase().includes('integral') ||
        modalidade.includes('30');
      const isFracionado3 =
        modalidade.includes('3_ETAPAS') ||
        modalidade.includes('10+10+10') ||
        modalidade.includes('3 Frações');

      // Frações definidas
      let m1 = null;
      let m2 = null;
      let m3 = null;

      if (item.decisao_camada_1_detalhes) {
        try {
          const arr = JSON.parse(item.decisao_camada_1_detalhes);
          if (arr[0]?.mes) m1 = normalizarMes(arr[0].mes);
          if (arr[1]?.mes) m2 = normalizarMes(arr[1].mes);
          if (arr[2]?.mes) m3 = normalizarMes(arr[2].mes);
        } catch (_e) {}
      }

      if (!m1 && item.fracao1) m1 = normalizarMes(item.fracao1);
      if (!m2 && item.fracao2) m2 = normalizarMes(item.fracao2);
      if (!m3 && item.fracao3) m3 = normalizarMes(item.fracao3);

      // Fallback para as preferências do militar no preview
      if (!m1 && Array.isArray(item.preferencias)) {
        m1 = normalizarMes(item.preferencias[0]?.replace(/^1º\s*/i, ''));
        m2 = normalizarMes(item.preferencias[1]?.replace(/^2º\s*/i, ''));
        m3 = normalizarMes(item.preferencias[2]?.replace(/^3º\s*/i, ''));
      }

      // 1ª Fração ou Integral (Gera Pagamento)
      if (m1 && mapa[m1]) {
        if (isIntegral) {
          mapa[m1].integrais += 1;
        } else {
          mapa[m1].fracao1 += 1;
        }
        mapa[m1].iniciosPagamento += 1;
        mapa[m1].totalGeral += 1;
      }

      // 2ª Fração (NÃO gera novo pagamento)
      if (!isIntegral && m2 && mapa[m2]) {
        mapa[m2].fracao2e3 += 1;
        mapa[m2].totalGeral += 1;
      }

      // 3ª Fração (NÃO gera novo pagamento)
      if (!isIntegral && isFracionado3 && m3 && mapa[m3]) {
        mapa[m3].fracao2e3 += 1;
        mapa[m3].totalGeral += 1;
      }
    });

    // Calcula percentuais e flags de estouro
    Object.values(mapa).forEach((st) => {
      st.percentualInicios =
        totalEfetivo > 0
          ? ((st.iniciosPagamento / totalEfetivo) * 100).toFixed(1)
          : '0.0';
      st.excedeuTeto = st.iniciosPagamento > teto10Porcento;
    });

    return mapa;
  }, [solicitacoes, totalEfetivo, teto10Porcento]);

  const mesesComAlerta = useMemo(() => {
    return Object.values(estatisticasPorMes).filter((st) => st.excedeuTeto);
  }, [estatisticasPorMes]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all mb-6 font-sans">
      {/* CABEÇALHO DA BARRA SUPERIOR FIXADA / RECOLHÍVEL */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
            <i className="ph ph-chart-bar text-lg text-green-400"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">{titulo}</h3>
              {mesesComAlerta.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  <i className="ph ph-warning"></i> {mesesComAlerta.length}{' '}
                  {mesesComAlerta.length === 1 ? 'mês excede 10%' : 'meses excedem 10%'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Efetivo Total: <strong>{totalEfetivo}</strong> • Teto Legal de Pagamento:{' '}
              <strong className="text-blue-900">{teto10Porcento} militares/mês (10%)</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Alternador de Abas quando Expandido */}
          {isExpanded && (
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAbaAtiva('teto')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  abaAtiva === 'teto'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teto Financeiro (10%)
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva('ocupacao')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  abaAtiva === 'ocupacao'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ocupação por Fração
              </button>
            </div>
          )}

          {/* Botão de Expandir / Recolher */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
          >
            {isExpanded ? (
              <>
                <i className="ph ph-caret-up font-bold"></i> Recolher Painel
              </>
            ) : (
              <>
                <i className="ph ph-caret-down font-bold"></i> Expandir Detalhes (12 Meses)
              </>
            )}
          </button>
        </div>
      </div>

      {/* VISÃO RESUMIDA (QUANDO RECOLHIDO) - MINI CHIPS EM LINHA */}
      {!isExpanded && (
        <div className="p-3 bg-white flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-thin">
          {MESES.map((m) => {
            const st = estatisticasPorMes[m.id];
            const isAlerta = st.excedeuTeto;

            return (
              <div
                key={m.id}
                onClick={() => setIsExpanded(true)}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium shrink-0 cursor-pointer transition-all ${
                  isAlerta
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-300/60 font-bold'
                    : st.totalGeral > 0
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50/50'
                    : 'bg-white border-slate-100 text-slate-400'
                }`}
                title={`${m.nomeCompleto}: ${st.iniciosPagamento} inícios com pagamento (Teto: ${teto10Porcento}) | Total ausentes: ${st.totalGeral}`}
              >
                <span className="font-bold">{m.nome}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isAlerta
                      ? 'bg-amber-200 text-amber-950 font-black'
                      : st.totalGeral > 0
                      ? 'bg-slate-200 text-slate-800 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {st.iniciosPagamento}
                </span>
                {isAlerta && <i className="ph ph-warning-fill text-amber-600 text-xs"></i>}
              </div>
            );
          })}
        </div>
      )}

      {/* VISÃO EXPANDIDA - GRID COMPLETA DE 12 MESES */}
      {isExpanded && (
        <div className="p-4 bg-slate-50/60 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2.5">
            {MESES.map((m) => {
              const st = estatisticasPorMes[m.id];
              const isAlerta = st.excedeuTeto;
              const percentualBarra = Math.min(
                100,
                Math.round((st.iniciosPagamento / (teto10Porcento || 1)) * 100)
              );

              return (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isAlerta
                      ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-300'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  {/* Nome do Mês e Status */}
                  <div className="flex items-center justify-between border-b pb-1.5 mb-2 border-slate-100">
                    <span className="font-extrabold text-xs tracking-tight">
                      {m.nomeCompleto}
                    </span>
                    {isAlerta && (
                      <span
                        className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]"
                        title="Ultrapassa o teto legal de 10% de servidores entrando de férias"
                      >
                        !
                      </span>
                    )}
                  </div>

                  {abaAtiva === 'teto' ? (
                    /* ABA 1: CONTROLE DE IMPACTO FINANCEIRO (10%) */
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          Inícios:
                        </span>
                        <span
                          className={`font-black text-sm ${
                            isAlerta ? 'text-amber-900' : 'text-slate-900'
                          }`}
                        >
                          {st.iniciosPagamento}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">
                            / {teto10Porcento}
                          </span>
                        </span>
                      </div>

                      {/* Barra de Progresso em relação ao Teto */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            isAlerta
                              ? 'bg-amber-500'
                              : percentualBarra >= 75
                              ? 'bg-blue-600'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentualBarra}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <span
                          className={`font-bold ${
                            isAlerta ? 'text-amber-800' : 'text-slate-500'
                          }`}
                        >
                          {st.percentualInicios}% da tropa
                        </span>
                        <span className="text-slate-400 text-[9px]">
                          {st.integrais}int + {st.fracao1}f1
                        </span>
                      </div>

                      {isAlerta && (
                        <div className="pt-1 text-[9px] font-bold text-amber-800 leading-tight">
                          ⚠️ Excede 10% (Teto)
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ABA 2: OCUPAÇÃO GERAL (DISCRIMINAÇÃO POR FRAÇÕES) */
                    <div className="space-y-1 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          Total em Gozo:
                        </span>
                        <span className="font-extrabold text-sm text-slate-900">
                          {st.totalGeral}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-[10px] text-slate-600 pt-1 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span>Integral (30d):</span>
                          <strong className="text-slate-800">{st.integrais}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>1ª Fração:</span>
                          <strong className="text-slate-800">{st.fracao1}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>2ª/3ª Frações:</span>
                          <strong className="text-slate-800">{st.fracao2e3}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda Informativa */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Dentro da cota
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Alerta de Cota:
                Excede 10% do efetivo em inícios de férias no mês
              </span>
            </div>
            <span className="italic text-[10px] text-slate-400">
              * Nota: 2ª e 3ª frações não geram desembolso de pagamento adicional no mês.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
