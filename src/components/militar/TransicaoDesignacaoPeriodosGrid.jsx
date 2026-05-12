import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import TransicaoDesignacaoPeriodoDetalhes from './TransicaoDesignacaoPeriodoDetalhes';

export const ACOES_LABELS = {
  manter: 'Manter',
  marcar_legado_ativa: 'Marcar legado da ativa',
  marcar_indenizado: 'Marcar indenizado',
  excluir_cadeia_operacional: 'Excluir da cadeia operacional',
  cancelar_periodo_futuro_indevido: 'Cancelar futuro indevido',
};

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

function getPeriodoKey(item, index) {
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

export function acaoExigeMotivo(periodo, decisao) {
  if (!decisao?.acao || decisao.acao === 'manter') return false;
  return Boolean(periodo?.exigeMotivo || periodo?.exige_motivo || getRiscos(periodo).length > 0 || decisao.acao !== getAcaoSugerida(periodo));
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
  if (acaoExigeMotivo(periodo, decisao) && !String(decisao?.motivo || '').trim()) pendencias.push('Informe motivo/observação.');
  if (acaoExigeDocumento(periodo, decisao) && !String(decisao?.documento || '').trim()) pendencias.push('Informe documento.');

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
      motivo: '',
      documento: '',
    };
    return acc;
  }, {});
}

export default function TransicaoDesignacaoPeriodosGrid({ periodos = [], acoesSelecionadas = {}, onChange }) {
  const [filtro, setFiltro] = useState('todos');
  const [detalhesAbertos, setDetalhesAbertos] = useState({});

  const linhas = useMemo(() => periodos.map((item, index) => {
    const key = getPeriodoKey(item, index);
    const decisao = acoesSelecionadas[key] || { acao: getAcaoSugerida(item), motivo: '', documento: '' };
    return { item, index, key, decisao, pendencias: validarDecisaoPeriodo(item, decisao) };
  }).filter(({ item, decisao }) => periodoPassaFiltro(item, decisao, filtro)), [periodos, acoesSelecionadas, filtro]);

  function atualizarDecisao(key, patch) {
    onChange?.({
      ...acoesSelecionadas,
      [key]: { ...(acoesSelecionadas[key] || {}), ...patch },
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant={filtro === value ? 'default' : 'outline'} onClick={() => setFiltro(value)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[1500px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-2">Período</th>
              <th className="p-2">Aquisitivo</th>
              <th className="p-2">Status/origem</th>
              <th className="p-2">Saldo</th>
              <th className="p-2">Dias</th>
              <th className="p-2">Férias</th>
              <th className="p-2">Situação</th>
              <th className="p-2">Sugestão</th>
              <th className="p-2">Riscos</th>
              <th className="p-2">Bloqueantes</th>
              <th className="p-2">Ação escolhida</th>
              <th className="p-2">Motivo/observação</th>
              <th className="p-2">Documento</th>
              <th className="p-2">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={14} className="p-4 text-center text-slate-500">Nenhum período encontrado para o filtro selecionado.</td></tr>
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

              return (
                <React.Fragment key={key}>
                  <tr className={`border-t align-top ${pendencias.length > 0 ? 'bg-amber-50/40' : ''}`}>
                    <td className="p-2 font-medium text-slate-800">{periodo.ano_referencia || periodo.periodo_aquisitivo_ref || item.periodoId || item.periodo_id || index + 1}</td>
                    <td className="p-2 text-slate-600">{formatDate(periodo.inicio_aquisitivo)} até {formatDate(periodo.fim_aquisitivo)}</td>
                    <td className="p-2 text-slate-600">{periodo.status || '—'}<br /><span className="text-xs">{periodo.origem_periodo || '—'}</span></td>
                    <td className="p-2">{numero(periodo.dias_saldo ?? periodo.saldo ?? periodo.diasSaldo)} dia(s)</td>
                    <td className="p-2 text-xs">Gozados: {numero(periodo.dias_gozados ?? periodo.diasGozados)}<br />Previstos: {numero(periodo.dias_previstos ?? periodo.diasPrevistos)}</td>
                    <td className="p-2"><Badge variant="outline">{ferias.length}</Badge></td>
                    <td className="p-2"><Badge variant="secondary">{item.situacaoAtual || item.situacao_atual || '—'}</Badge></td>
                    <td className="p-2">{ACOES_LABELS[acaoSugerida] || acaoSugerida || '—'}</td>
                    <td className="p-2"><div className="flex flex-wrap gap-1">{riscos.length ? riscos.map((risco) => <Badge key={risco} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{risco}</Badge>) : '—'}</div></td>
                    <td className="p-2"><div className="flex flex-wrap gap-1">{bloqueantes.length ? bloqueantes.map((bloqueante) => <Badge key={bloqueante} variant="outline" className="border-red-300 bg-red-50 text-red-700">{bloqueante}</Badge>) : '—'}</div></td>
                    <td className="p-2 min-w-52">
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-100"
                        value={acaoEscolhida}
                        disabled={bloqueado}
                        onChange={(event) => atualizarDecisao(key, { acao: event.target.value })}
                      >
                        {(bloqueado ? ['manter'] : acoesPermitidas).map((acao) => <option key={acao} value={acao}>{ACOES_LABELS[acao] || acao}</option>)}
                      </select>
                      {pendencias.length > 0 && (
                        <div className="mt-1 space-y-1 text-xs text-amber-700">
                          {pendencias.map((pendencia) => <p key={pendencia} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3" />{pendencia}</p>)}
                        </div>
                      )}
                    </td>
                    <td className="p-2 min-w-56">
                      <Textarea
                        value={decisao.motivo || ''}
                        onChange={(event) => atualizarDecisao(key, { motivo: event.target.value })}
                        placeholder={exigeMotivo ? 'Obrigatório para esta decisão' : 'Motivo/observação local'}
                        className="min-h-20"
                      />
                    </td>
                    <td className="p-2 min-w-48">
                      <Input
                        value={decisao.documento || ''}
                        onChange={(event) => atualizarDecisao(key, { documento: event.target.value })}
                        placeholder={exigeDocumento ? 'Documento obrigatório' : 'Documento textual'}
                      />
                    </td>
                    <td className="p-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDetalhesAbertos((atual) => ({ ...atual, [key]: !detalhesAberto }))}>
                        {detalhesAberto ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}Detalhes
                      </Button>
                    </td>
                  </tr>
                  {detalhesAberto && (
                    <tr className="border-t bg-slate-50"><td colSpan={14} className="p-3"><TransicaoDesignacaoPeriodoDetalhes periodo={item} decisao={decisao} /></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
