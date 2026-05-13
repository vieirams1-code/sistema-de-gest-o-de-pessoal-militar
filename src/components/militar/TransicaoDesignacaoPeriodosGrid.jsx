import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TransicaoDesignacaoPeriodoDetalhes from './TransicaoDesignacaoPeriodoDetalhes';

export const ACOES_LABELS = {
  manter: 'Manter',
  marcar_legado_ativa: 'Marcar como Legado da Ativa',
  marcar_indenizado: 'Marcar como Indenizado',
  excluir_cadeia_operacional: 'Excluir da cadeia operacional',
  cancelar_periodo_futuro_indevido: 'Cancelar futuro indevido',
};

export const ACOES_OPERACIONAIS = [
  'manter',
  'marcar_legado_ativa',
  'marcar_indenizado',
  'cancelar_periodo_futuro_indevido',
];

export const MOTIVOS_PADRAO_TRANSICAO = {
  cancelar_periodo_futuro_indevido: 'Cancelamento operacional por período futuro incompatível com a nova data-base do contrato de designação.',
  marcar_legado_ativa: 'Período preservado como legado da ativa após registro de contrato de designação.',
  marcar_indenizado: 'Período registrado como indenizado no contexto da transição para contrato de designação.',
  manter: 'Período mantido sem alteração operacional.',
};

export function getMotivoPadraoTransicao(acao) {
  return MOTIVOS_PADRAO_TRANSICAO[acao] || MOTIVOS_PADRAO_TRANSICAO.manter;
}

const FILTROS = [
  ['todos', 'Todos'],
  ['sem_decisao', 'Sem decisão'],
  ['bloqueantes', 'Com bloqueantes'],
  ['riscos', 'Com riscos'],
  ['futuros', 'Futuros'],
  ['anteriores', 'Anteriores à data-base'],
  ['ferias', 'Com férias'],
  ['saldo', 'Com saldo'],
  ['ja_legado', 'Já legado'],
  ['overrides', 'Overrides'],
];

function formatDate(date) {
  if (!date) return '—';
  try { return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return date; }
}

function numero(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDadosPeriodo(item) {
  return item?.periodo || item || {};
}

function getAcoesPermitidas(item) {
  return item?.acoesPermitidas || item?.acoes_permitidas || ['manter'];
}

function getAcaoSugerida(item) {
  return item?.acaoSugerida || item?.acao_sugerida || 'manter';
}

export function getPeriodoKey(item, index) {
  const periodo = getDadosPeriodo(item);
  return String(item?.periodoId || item?.periodo_id || periodo.id || periodo.periodo_aquisitivo_ref || periodo.ano_referencia || index);
}

function getBloqueantes(item) {
  return item?.bloqueantes || [];
}

function getRiscos(item) {
  return item?.riscos || [];
}

function getFerias(item) {
  return item?.feriasVinculadas || item?.ferias_vinculadas || [];
}

export const ACOES_COM_MOTIVO_OBRIGATORIO = new Set([
  'marcar_legado_ativa',
  'marcar_indenizado',
  'excluir_cadeia_operacional',
  'cancelar_periodo_futuro_indevido',
]);

export function acaoExigeMotivo(periodo, decisao) {
  if (!decisao?.acao || decisao.acao === 'manter') return false;
  return ACOES_COM_MOTIVO_OBRIGATORIO.has(decisao.acao) || Boolean(periodo?.exigeMotivo || periodo?.exige_motivo || getRiscos(periodo).length > 0 || decisao.acao !== getAcaoSugerida(periodo));
}

export function acaoExigeDocumento(periodo, decisao) {
  if (!decisao?.acao || decisao.acao === 'manter') return false;
  return Boolean(periodo?.exigeDocumento || periodo?.exige_documento);
}

export function validarDecisaoPeriodo(periodo, decisao) {
  const pendencias = [];
  const acoesPermitidas = getAcoesPermitidas(periodo);
  const bloqueantes = getBloqueantes(periodo);

  if (!decisao?.acao) pendencias.push('Selecione uma ação.');
  if (decisao?.acao && !acoesPermitidas.includes(decisao.acao)) pendencias.push('Ação fora das ações permitidas.');
  if (bloqueantes.length > 0 && decisao?.acao !== 'manter') pendencias.push('Período com bloqueante só pode ser mantido neste lote.');
  if (acaoExigeDocumento(periodo, decisao) && !String(decisao?.documento || '').trim()) pendencias.push('Informe documento.');
  if (decisao?.acao === 'marcar_indenizado') {
    if (!String(decisao?.documento || '').trim()) pendencias.push('Informe documento para indenização.');
    if (!(Number(decisao?.dias_indenizados || 0) > 0)) pendencias.push('Informe dias indenizados.');
  }

  return pendencias;
}

function possuiSaldo(periodo) {
  return numero(periodo.dias_saldo ?? periodo.saldo ?? periodo.diasSaldo) > 0;
}

function periodoPassaFiltro(item, decisao, filtro) {
  const periodo = getDadosPeriodo(item);
  const ferias = getFerias(item);
  const riscos = getRiscos(item);
  const bloqueantes = getBloqueantes(item);
  const acaoSugerida = getAcaoSugerida(item);
  const pendencias = validarDecisaoPeriodo(item, decisao);

  switch (filtro) {
    case 'sem_decisao': return pendencias.length > 0;
    case 'bloqueantes': return bloqueantes.length > 0;
    case 'riscos': return riscos.length > 0;
    case 'futuros': return item.situacaoAtual === 'futuro_pos_data_base' || item.situacao_atual === 'futuro_pos_data_base' || decisao?.acao === 'cancelar_periodo_futuro_indevido';
    case 'anteriores': return item.situacaoAtual === 'anterior_data_base' || item.situacao_atual === 'anterior_data_base';
    case 'ferias': return ferias.length > 0;
    case 'saldo': return possuiSaldo(periodo);
    case 'ja_legado': return item.situacaoAtual === 'ja_legado' || item.situacao_atual === 'ja_legado' || periodo.legado_ativa === true;
    case 'overrides': return Boolean(decisao?.acao && decisao.acao !== acaoSugerida);
    case 'todos':
    default: return true;
  }
}

export function calcularResumoDecisoes(periodos = [], acoesSelecionadas = {}) {
  return periodos.reduce((acc, item, index) => {
    const key = getPeriodoKey(item, index);
    const decisao = acoesSelecionadas[key] || {};
    const acao = decisao.acao || getAcaoSugerida(item) || 'manter';
    const pendencias = validarDecisaoPeriodo(item, { ...decisao, acao });
    acc.total += 1;
    acc[acao] = (acc[acao] || 0) + 1;
    acc.pendentes += pendencias.length > 0 ? 1 : 0;
    acc.bloqueantes += getBloqueantes(item).length > 0 ? 1 : 0;
    acc.riscos += getRiscos(item).length > 0 ? 1 : 0;
    acc.overrides += acao !== getAcaoSugerida(item) ? 1 : 0;
    return acc;
  }, {
    total: 0,
    pendentes: 0,
    manter: 0,
    marcar_legado_ativa: 0,
    marcar_indenizado: 0,
    excluir_cadeia_operacional: 0,
    cancelar_periodo_futuro_indevido: 0,
    bloqueantes: 0,
    riscos: 0,
    overrides: 0,
  });
}

export function criarDecisoesIniciais(periodos = []) {
  return periodos.reduce((acc, item, index) => {
    const acoesPermitidas = getAcoesPermitidas(item);
    const bloqueado = getBloqueantes(item).length > 0;
    const sugerida = getAcaoSugerida(item);
    acc[getPeriodoKey(item, index)] = {
      acao: bloqueado ? 'manter' : (acoesPermitidas.includes(sugerida) ? sugerida : 'manter'),
      motivo: getMotivoPadraoTransicao(bloqueado ? 'manter' : (acoesPermitidas.includes(sugerida) ? sugerida : 'manter')),
      documento: '',
      dias_indenizados: 0,
    };
    return acc;
  }, {});
}

export default function TransicaoDesignacaoPeriodosGrid({ periodos = [], acoesSelecionadas = {}, onChange }) {
  const [filtro, setFiltro] = useState('todos');
  const [detalhesAbertos, setDetalhesAbertos] = useState({});

  const linhas = useMemo(() => periodos.map((item, index) => {
    const key = getPeriodoKey(item, index);
    const decisao = acoesSelecionadas[key] || { acao: getAcaoSugerida(item), motivo: getMotivoPadraoTransicao(getAcaoSugerida(item)), documento: '' };
    return { item, index, key, decisao, pendencias: validarDecisaoPeriodo(item, decisao) };
  }).filter(({ item, decisao }) => periodoPassaFiltro(item, decisao, filtro)), [periodos, acoesSelecionadas, filtro]);

  function atualizarDecisao(key, patch) {
    onChange?.({
      ...acoesSelecionadas,
      [key]: { ...(acoesSelecionadas[key] || {}), ...patch },
    });
  }

  function atualizarAcao(key, acao) {
    atualizarDecisao(key, { acao, motivo: getMotivoPadraoTransicao(acao) });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
        {FILTROS.map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant={filtro === value ? 'default' : 'outline'} onClick={() => setFiltro(value)} className="h-8 text-xs">
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {linhas.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Nenhum período encontrado para o filtro selecionado.</div>
        ) : linhas.map(({ item, index, key, decisao, pendencias }) => {
          const periodo = getDadosPeriodo(item);
          const acoesPermitidas = getAcoesPermitidas(item);
          const bloqueantes = getBloqueantes(item);
          const riscos = getRiscos(item);
          const ferias = getFerias(item);
          const bloqueado = bloqueantes.length > 0;
          const detalhesAberto = Boolean(detalhesAbertos[key]);
          const acaoSugerida = getAcaoSugerida(item);
          const acaoEscolhida = decisao.acao || acaoSugerida || 'manter';
          const exigeMotivo = acaoExigeMotivo(item, decisao);
          const exigeDocumento = acaoExigeDocumento(item, decisao);
          const referencia = periodo.ano_referencia || periodo.periodo_aquisitivo_ref || item.periodoId || item.periodo_id || index + 1;
          const situacao = item.situacaoAtual || item.situacao_atual || '—';
          const escolhaDiferente = acaoEscolhida !== acaoSugerida;
          const alertaPrincipal = bloqueantes[0]?.codigo || bloqueantes[0] || riscos[0]?.codigo || riscos[0] || situacao || 'Sem alertas';
          const opcoesVisiveis = ACOES_OPERACIONAIS.filter((acao) => acoesPermitidas.includes(acao));
          const opcoesSelect = bloqueado ? ['manter'] : (opcoesVisiveis.includes(acaoEscolhida) ? opcoesVisiveis : [...opcoesVisiveis, acaoEscolhida]).filter(Boolean);

          return (
            <article key={key} className={`rounded-xl border p-3 shadow-sm ${bloqueado ? 'border-red-200 bg-red-50/70' : pendencias.length > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Período</p>
                  <h4 className="break-words text-base font-semibold text-slate-900">{referencia}</h4>
                  <p className="text-xs text-slate-600">{formatDate(periodo.inicio_aquisitivo)} até {formatDate(periodo.fim_aquisitivo)}</p>
                </div>
                <Badge variant="secondary" className="max-w-[45%] whitespace-normal text-left">{periodo.status || 'Sem status'}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 p-2">
                  <p className="font-medium text-slate-500">Saldo</p>
                  <p className="text-sm font-semibold text-slate-900">{numero(periodo.dias_saldo ?? periodo.saldo ?? periodo.diasSaldo)} dia(s)</p>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <p className="font-medium text-slate-500">Férias</p>
                  <p className="text-sm font-semibold text-slate-900">{ferias.length} vínculo(s)</p>
                  <p className="text-slate-500">{numero(periodo.dias_gozados ?? periodo.diasGozados)} gozados</p>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alerta principal</p>
                  <p className={bloqueantes.length > 0 ? 'text-red-700' : riscos.length > 0 ? 'text-amber-700' : 'text-slate-600'}>{String(alertaPrincipal)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ação sugerida</p>
                  <p className="font-medium text-slate-800">{ACOES_LABELS[acaoSugerida] || acaoSugerida || '—'}</p>
                </div>
              </div>

              <div className={`mt-3 rounded-lg border p-2 ${escolhaDiferente ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ação</p>
                  {escolhaDiferente && <Badge variant="outline" className="border-blue-300 text-blue-800">Alterada</Badge>}
                </div>
                <select
                  className={`h-9 w-full min-w-0 rounded-md border px-2 text-sm disabled:bg-slate-100 ${escolhaDiferente ? 'border-blue-300 bg-white font-medium text-blue-900' : 'border-slate-200 bg-white'}`}
                  value={acaoEscolhida}
                  disabled={bloqueado}
                  onChange={(event) => atualizarAcao(key, event.target.value)}
                >
                  {opcoesSelect.map((acao) => <option key={acao} value={acao}>{ACOES_LABELS[acao] || acao}</option>)}
                </select>
                {bloqueado && <p className="mt-1 text-xs text-red-700">Bloqueante: somente “Manter” neste lote.</p>}
                {pendencias.length > 0 && <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3 w-3" />{pendencias.length} pendência(s)</p>}
              </div>

              <Button type="button" size="sm" variant="ghost" onClick={() => setDetalhesAbertos((atual) => ({ ...atual, [key]: !detalhesAberto }))} className="mt-2 w-full justify-center text-slate-600">
                {detalhesAberto ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}Avançado
              </Button>

              {detalhesAberto && (
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <TransicaoDesignacaoPeriodoDetalhes
                    periodo={item}
                    decisao={decisao}
                    exigeMotivo={exigeMotivo}
                    exigeDocumento={exigeDocumento}
                    pendencias={pendencias}
                    onChange={(patch) => atualizarDecisao(key, patch)}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
