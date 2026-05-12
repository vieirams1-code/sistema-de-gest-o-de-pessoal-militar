import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return formatValue(value); }
}

function codigoItem(item) {
  return item?.codigo || item?.motivo || item?.detalhe || item?.acao || item?.status || item;
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{formatValue(value)}</dd>
    </div>
  );
}

function BadgeList({ itens = [], danger = false, vazio = 'Nenhum registro.' }) {
  if (!itens.length) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {itens.map((item, index) => {
        const codigo = codigoItem(item);
        return <Badge key={`${codigo}-${index}`} variant="outline" className={danger ? 'border-red-300 bg-red-50 text-red-700' : ''}>{formatValue(codigo)}</Badge>;
      })}
    </div>
  );
}

function ResumoCard({ value, titulo, vazio, children, danger = false }) {
  return (
    <section className={`rounded-lg border bg-white p-3 ${danger ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className="mt-1 text-sm text-slate-600">{value === 0 ? vazio : 'Detalhes disponíveis para conferência.'}</p>
        </div>
        <Badge variant="outline" className={danger && value > 0 ? 'border-red-300 bg-red-50 text-red-700' : ''}>{value}</Badge>
      </div>
      <Accordion type="single" collapsible className="mt-2">
        <AccordionItem value="detalhes" className="border-0">
          <AccordionTrigger className="py-2 text-xs font-semibold text-slate-600 hover:no-underline">Ver detalhes</AccordionTrigger>
          <AccordionContent className="pb-0">{children}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function FeriasDetalhes({ ferias = [] }) {
  if (!ferias.length) return <p className="text-sm text-slate-500">Nenhuma férias vinculada ao período.</p>;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
  );
}

export default function TransicaoDesignacaoPeriodoDetalhes({
  periodo = {},
  decisao = null,
  onChange,
  exigeMotivo = false,
  exigeDocumento = false,
  pendencias = [],
}) {
  const dadosPeriodo = periodo.periodo || periodo;
  const ferias = periodo.feriasVinculadas || periodo.ferias_vinculadas || [];
  const riscos = periodo.riscos || [];
  const bloqueantes = periodo.bloqueantes || [];
  const alertas = periodo.alertas || [];
  const conflitos = periodo.conflitos || [];
  const motivosSugestao = periodo.motivosSugestao || periodo.motivos_sugestao || [];
  const acoesPermitidas = periodo.acoesPermitidas || periodo.acoes_permitidas || [];
  const periodoId = periodo.periodoId || periodo.periodo_id || dadosPeriodo.id || 'periodo';

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <section className="rounded-lg border border-slate-200 bg-slate-100/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-900">Resumo do período</h4>
          {pendencias.length > 0 && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{pendencias.length} pendência(s)</Badge>}
        </div>
        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Referência" value={dadosPeriodo.ano_referencia || dadosPeriodo.periodo_aquisitivo_ref} />
          <SummaryItem label="Início aquisitivo" value={formatDate(dadosPeriodo.inicio_aquisitivo)} />
          <SummaryItem label="Fim aquisitivo" value={formatDate(dadosPeriodo.fim_aquisitivo)} />
          <SummaryItem label="Status" value={dadosPeriodo.status} />
          <SummaryItem label="Origem" value={dadosPeriodo.origem_periodo} />
          <SummaryItem label="Ação escolhida" value={decisao?.acao} />
          <SummaryItem label="Saldo atual" value={dadosPeriodo.dias_saldo ?? dadosPeriodo.saldo ?? dadosPeriodo.diasSaldo} />
          <SummaryItem label="Excluído da cadeia" value={dadosPeriodo.excluido_da_cadeia_designacao} />
          <SummaryItem label="Legado ativa" value={dadosPeriodo.legado_ativa} />
          <SummaryItem label="Atualização" value={formatDate(dadosPeriodo.updated_date || dadosPeriodo.updated_at)} />
        </dl>
      </section>

      {bloqueantes.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-red-800">Bloqueante impede outras ações</p>
            <Badge variant="outline" className="border-red-300 bg-white text-red-700">{bloqueantes.length}</Badge>
          </div>
          <BadgeList itens={bloqueantes} danger />
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ResumoCard titulo="Férias vinculadas" value={ferias.length} vazio="Nenhuma férias vinculada ao período.">
          <FeriasDetalhes ferias={ferias} />
        </ResumoCard>
        <ResumoCard titulo="Riscos" value={riscos.length} vazio="Nenhum risco identificado.">
          <BadgeList itens={riscos} vazio="Nenhum risco identificado." />
        </ResumoCard>
        <ResumoCard titulo="Alertas" value={alertas.length + conflitos.length} vazio="Nenhum alerta identificado.">
          <div className="space-y-2">
            <BadgeList itens={alertas} vazio="Nenhum alerta identificado." />
            {conflitos.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Conflitos</p>
                <BadgeList itens={conflitos} />
              </div>
            )}
          </div>
        </ResumoCard>
        <ResumoCard titulo="Ações permitidas" value={acoesPermitidas.length} vazio="Nenhuma ação permitida informada.">
          <BadgeList itens={acoesPermitidas} vazio="Nenhuma ação permitida informada." />
        </ResumoCard>
      </div>

      <Accordion type="multiple" className="rounded-lg border border-slate-200 bg-white px-3">
        <AccordionItem value="observacao" className="border-b border-slate-200">
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">Observação/documento opcional</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`motivo-${periodoId}`}>Observação local</Label>
                <Textarea
                  id={`motivo-${periodoId}`}
                  value={decisao?.motivo || ''}
                  onChange={(event) => onChange?.({ motivo: event.target.value })}
                  placeholder={exigeMotivo ? 'Obrigatório para esta decisão' : 'Observação opcional'}
                  className="min-h-20 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`documento-${periodoId}`}>Documento</Label>
                <Input
                  id={`documento-${periodoId}`}
                  value={decisao?.documento || ''}
                  onChange={(event) => onChange?.({ documento: event.target.value })}
                  placeholder={exigeDocumento ? 'Documento obrigatório' : 'Documento opcional'}
                  className="bg-white"
                />
                {pendencias.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {pendencias.map((pendencia) => <p key={pendencia}>• {pendencia}</p>)}
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="dados-tecnicos" className="border-0">
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">Dados técnicos</AccordionTrigger>
          <AccordionContent>
            <dl className="grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
              {[
                ['Período ID', periodoId],
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
                ['Motivos da sugestão', motivosSugestao.map(codigoItem).join(', ')],
                ['Atualização', dadosPeriodo.updated_date || dadosPeriodo.updated_at],
              ].map(([label, value]) => (
                <div key={label} className="rounded bg-slate-50 p-2">
                  <dt className="font-medium text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words text-slate-800">{formatValue(value)}</dd>
                </div>
              ))}
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
