import React from 'react';
import { Badge } from '@/components/ui/badge';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function ListaCodigos({ titulo, itens = [], vazio = 'Nenhum registro.' }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {itens.map((item, index) => {
            const codigo = item?.codigo || item?.motivo || item?.detalhe || item;
            return <Badge key={`${titulo}-${codigo}-${index}`} variant="outline">{formatValue(codigo)}</Badge>;
          })}
        </div>
      )}
    </div>
  );
}

export default function TransicaoDesignacaoPeriodoDetalhes({ periodo = {}, decisao = null }) {
  const dadosPeriodo = periodo.periodo || periodo;
  const ferias = periodo.feriasVinculadas || periodo.ferias_vinculadas || [];
  const riscos = periodo.riscos || [];
  const alertas = periodo.alertas || [];
  const conflitos = periodo.conflitos || [];
  const motivosSugestao = periodo.motivosSugestao || periodo.motivos_sugestao || [];
  const acoesPermitidas = periodo.acoesPermitidas || periodo.acoes_permitidas || [];

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-2">
      <section className="rounded-md border border-slate-200 bg-white p-3 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Férias vinculadas</p>
        {ferias.length === 0 ? (
          <p className="mt-2 text-slate-500">Nenhuma férias vinculada ao período.</p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {ferias.map((feriasItem, index) => (
              <div key={feriasItem.id || `${feriasItem.periodo_aquisitivo_ref}-${index}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{feriasItem.periodo_aquisitivo_ref || feriasItem.id || 'Férias sem referência'}</span>
                  {feriasItem.status && <Badge variant="secondary">{feriasItem.status}</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">ID: {formatValue(feriasItem.id)} • Atualizado em: {formatValue(feriasItem.updated_date || feriasItem.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <ListaCodigos titulo="Riscos completos" itens={riscos} vazio="Nenhum risco identificado." />
      <ListaCodigos titulo="Alertas" itens={alertas} vazio="Nenhum alerta identificado." />
      <ListaCodigos titulo="Conflitos" itens={conflitos} vazio="Nenhum conflito identificado." />
      <ListaCodigos titulo="Motivos da sugestão" itens={motivosSugestao} vazio="Nenhum motivo informado." />
      <ListaCodigos titulo="Ações permitidas" itens={acoesPermitidas} vazio="Nenhuma ação permitida informada." />

      <section className="rounded-md border border-slate-200 bg-white p-3 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dados brutos principais</p>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
          {[
            ['Período ID', periodo.periodoId || periodo.periodo_id || dadosPeriodo.id],
            ['Referência', dadosPeriodo.ano_referencia || dadosPeriodo.periodo_aquisitivo_ref],
            ['Início aquisitivo', dadosPeriodo.inicio_aquisitivo],
            ['Fim aquisitivo', dadosPeriodo.fim_aquisitivo],
            ['Status', dadosPeriodo.status],
            ['Origem', dadosPeriodo.origem_periodo],
            ['Legado ativa', dadosPeriodo.legado_ativa],
            ['Excluído da cadeia', dadosPeriodo.excluido_da_cadeia_designacao],
            ['Ação local', decisao?.acao],
            ['Motivo local', decisao?.motivo],
            ['Documento local', decisao?.documento],
            ['Atualização', dadosPeriodo.updated_date || dadosPeriodo.updated_at],
          ].map(([label, value]) => (
            <div key={label} className="rounded bg-slate-50 p-2">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-slate-800">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
