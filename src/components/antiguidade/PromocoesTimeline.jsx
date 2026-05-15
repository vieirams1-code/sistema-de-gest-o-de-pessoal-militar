import React from 'react';
import { FilePenLine, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RankIcon from './RankIcon';

const STATUS_PREVISTO = 'previsto';
const valorTexto = (v) => String(v || '').trim();
const statusRegistro = (registro) => valorTexto(registro?.status_registro || 'ativo').toLowerCase();
const documentoPromocao = (registro) => registro?.boletim_referencia || registro?.ato_referencia || '—';

function Info({ label, value }) {
  return <div className="space-y-0.5">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="font-semibold leading-5 text-slate-800">{value || '—'}</p>
  </div>;
}

function InsigniaBox({ postoGraduacao, destaque = false }) {
  return <div className={`${destaque ? 'h-20 w-20' : 'h-14 w-14'} flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm`}>
    <RankIcon postoGraduacao={postoGraduacao} />
  </div>;
}

function AcoesRegistro({ canManage, registro, onCorrigir, onRetificar }) {
  if (!canManage || !registro?.id) return null;

  return <div className="flex flex-wrap gap-2 md:justify-end">
    <Button size="sm" variant="outline" className="gap-2 border-slate-300 text-slate-700" onClick={() => onCorrigir?.(registro)}>
      <Pencil className="h-4 w-4" />Corrigir cadastro
    </Button>
    <Button size="sm" variant="outline" className="gap-2 border-amber-300 text-amber-800" onClick={() => onRetificar?.(registro)}>
      <FilePenLine className="h-4 w-4" />Retificar ato
    </Button>
  </div>;
}

function PromocaoAtualCard({ promocaoAtual, militar, canManage, onRegistrarAtual, onCorrigir, onRetificar }) {
  const postoAtual = promocaoAtual?.posto_graduacao_novo || militar?.posto_graduacao;

  return <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-4">
        <InsigniaBox postoGraduacao={postoAtual} destaque />
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Promoção Atual</p>
            <h3 className="mt-1 text-2xl font-bold leading-tight text-slate-950">{postoAtual || 'Posto atual não informado'}</h3>
            <p className="text-sm text-slate-600">Quadro {promocaoAtual?.quadro_novo || militar?.quadro || '—'}</p>
          </div>
          {!promocaoAtual && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Sem promoção atual cadastrada.</p>}
        </div>
      </div>
      {promocaoAtual ? (
        <AcoesRegistro canManage={canManage} registro={promocaoAtual} onCorrigir={onCorrigir} onRetificar={onRetificar} />
      ) : canManage ? (
        <Button size="sm" variant="outline" className="gap-2 border-slate-300 text-slate-700" onClick={onRegistrarAtual}>
          <RotateCcw className="h-4 w-4" />Registrar promoção atual
        </Button>
      ) : null}
    </div>

    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-blue-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Data da promoção" value={promocaoAtual?.data_promocao || '—'} />
      <Info label="Publicação / ato" value={documentoPromocao(promocaoAtual)} />
      <Info label="Nº / ordem de antiguidade" value={promocaoAtual?.antiguidade_referencia_ordem ?? '—'} />
      <Info label="Quadro" value={promocaoAtual?.quadro_novo || militar?.quadro || '—'} />
    </div>
  </section>;
}

function PromocaoAnteriorItem({ registro, canManage, onCorrigir, onRetificar }) {
  const posto = registro?.posto_graduacao_novo || registro?.posto_graduacao_anterior;

  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-4">
        <InsigniaBox postoGraduacao={posto} />
        <div className="min-w-0 space-y-3">
          <div>
            <h4 className="text-lg font-bold leading-tight text-slate-900">{posto || 'Posto/graduação não informado'}</h4>
            <p className="text-sm text-slate-600">Quadro {registro?.quadro_novo || registro?.quadro_anterior || '—'}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <Info label="Data da promoção" value={registro?.data_promocao || '—'} />
            <Info label="Publicação / ato" value={documentoPromocao(registro)} />
            <Info label="Nº / ordem de antiguidade" value={registro?.antiguidade_referencia_ordem ?? '—'} />
          </div>
        </div>
      </div>
      <AcoesRegistro canManage={canManage} registro={registro} onCorrigir={onCorrigir} onRetificar={onRetificar} />
    </div>
  </article>;
}

export default function PromocoesTimeline({ historico, promocaoAtual, militar, canManage, onRegistrarAtual, onCorrigirPromocao, onRetificarPromocao }) {
  const anteriores = (historico || []).filter((registro) => {
    if (!registro?.id) return false;
    if (promocaoAtual?.id && String(registro.id) === String(promocaoAtual.id)) return false;
    return statusRegistro(registro) !== STATUS_PREVISTO;
  });

  return <div className="space-y-5">
    <PromocaoAtualCard promocaoAtual={promocaoAtual} militar={militar} canManage={canManage} onRegistrarAtual={onRegistrarAtual} onCorrigir={onCorrigirPromocao} onRetificar={onRetificarPromocao} />

    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Promoções Anteriores</h3>
        <p className="text-sm text-slate-500">Histórico anterior ao posto/graduação atual, sem promoções futuras ou status adicionais.</p>
      </div>
      {anteriores.length === 0
        ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Nenhuma promoção anterior cadastrada.</div>
        : <div className="space-y-3">{anteriores.map((registro) => <PromocaoAnteriorItem key={registro.id} registro={registro} canManage={canManage} onCorrigir={onCorrigirPromocao} onRetificar={onRetificarPromocao} />)}</div>}
    </section>
  </div>;
}
