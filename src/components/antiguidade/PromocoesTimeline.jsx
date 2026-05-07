import React from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import RankIcon from './RankIcon';

const STATUS_BADGE = {
  ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pendente: 'bg-amber-100 text-amber-800 border-amber-200',
  retificado: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelado: 'bg-rose-100 text-rose-800 border-rose-200',
  previsto: 'bg-amber-100 text-amber-900 border-amber-200',
};

const SECTION_BADGE = {
  historico: 'bg-slate-100 text-slate-700 border-slate-200',
  atual: 'bg-blue-100 text-blue-800 border-blue-200',
  previsto: 'bg-amber-100 text-amber-900 border-amber-200',
};

const valorTexto = (v) => String(v || '').trim();
const statusRegistro = (registro) => valorTexto(registro?.status_registro || 'pendente').toLowerCase();

function Info({ label, value, invert = false }) {
  return <div className="space-y-0.5">
    <p className={`text-[11px] uppercase tracking-wide ${invert ? 'text-blue-100/80' : 'text-slate-500'}`}>{label}</p>
    <p className={`font-semibold leading-5 ${invert ? 'text-white' : 'text-slate-800'}`}>{value}</p>
  </div>;
}

function StatusBadge({ registro }) {
  const status = statusRegistro(registro);
  return <Badge className={`${STATUS_BADGE[status] || STATUS_BADGE.pendente} border capitalize`}>{registro?.status_registro || 'pendente'}</Badge>;
}

function getCardClass(registro, destaqueAtual = false) {
  const status = statusRegistro(registro);
  if (destaqueAtual) return 'border-blue-400 bg-blue-50/80 shadow-md ring-2 ring-blue-100';
  if (status === 'cancelado') return 'border-rose-200 bg-rose-50/70';
  if (status === 'retificado') return 'border-blue-200 bg-blue-50/40';
  if (status === 'previsto') return 'border-amber-200 bg-amber-50/80';
  return 'border-slate-200 bg-white';
}

function RegistroActions({ registro, canManage, canExcluir, onDetalhe, onRetificar, onEditarPrevisao, onCancelar, onEfetivar, onExcluir }) {
  const status = statusRegistro(registro);
  const isPrevista = status === 'previsto';
  const isCancelado = status === 'cancelado';
  const isRetificado = status === 'retificado';

  return <div className="flex flex-wrap gap-2 pt-1">
    <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" onClick={() => onDetalhe(registro)}>
      <FileText className="w-4 h-4 mr-1" />Ver detalhes
    </Button>
    {isPrevista && !isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" disabled={!canManage} onClick={() => onEditarPrevisao?.(registro)}>Editar previsão</Button>}
    {isPrevista && !isCancelado && !isRetificado && onEfetivar && <Button size="sm" className="bg-slate-900 hover:bg-slate-800" disabled={!canManage} onClick={() => onEfetivar(registro)}>Efetivar Promoção</Button>}
    {!isPrevista && !isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" disabled={!canManage} onClick={() => onRetificar(registro)}>Retificar</Button>}
    {!isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" disabled={!canManage} onClick={() => onCancelar(registro)}>Cancelar</Button>}
    {canExcluir && <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => onExcluir?.(registro)}>Excluir</Button>}
  </div>;
}

function RegistroCard({ registro, canManage, canExcluir, isRegistroIncompativel, isRegistroIncompleto, onDetalhe, onRetificar, onEditarPrevisao, onCancelar, onEfetivar, onExcluir, compacto = false }) {
  const status = statusRegistro(registro);
  const isPrevista = status === 'previsto';

  return <div className={`rounded-xl border p-4 space-y-3 shadow-sm ${getCardClass(registro)}`}>
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge registro={registro} />
      {isPrevista && <Badge className="border border-amber-300 text-amber-900 bg-amber-100">Previsto</Badge>}
      {status === 'retificado' && <Badge variant="outline" className="border-blue-200 text-blue-700">Retificado</Badge>}
      {status === 'cancelado' && <Badge variant="outline" className="border-rose-200 text-rose-700">Cancelado</Badge>}
      {isRegistroIncompativel(registro) && <Badge variant="outline" className="border-rose-200 text-rose-700">Registro incompatível</Badge>}
      {isRegistroIncompleto(registro) && <Badge variant="outline" className="border-amber-200 text-amber-700">Registro incompleto</Badge>}
    </div>
    <div className={`grid grid-cols-1 gap-3 text-sm ${compacto ? '' : 'sm:grid-cols-2'}`}>
      <Info label={isPrevista ? 'Posto/graduação previsto' : 'Posto/graduação'} value={registro.posto_graduacao_novo || registro.posto_graduacao_anterior || '—'} />
      <Info label="Quadro" value={registro.quadro_novo || registro.quadro_anterior || '—'} />
      <Info label={isPrevista ? 'Data prevista' : 'Data da promoção'} value={registro.data_promocao || '—'} />
      <Info label="Publicação" value={registro.data_publicacao || '—'} />
      <Info label="Boletim / ato" value={registro.boletim_referencia || registro.ato_referencia || '—'} />
      {!isPrevista && <Info label="Nº/ordem de antiguidade" value={registro.antiguidade_referencia_ordem ?? '—'} />}
    </div>
    <RegistroActions registro={registro} canManage={canManage} canExcluir={canExcluir} onDetalhe={onDetalhe} onRetificar={onRetificar} onEditarPrevisao={onEditarPrevisao} onCancelar={onCancelar} onEfetivar={onEfetivar} onExcluir={onExcluir} />
  </div>;
}

function PostoAtualCard({ promocaoAtual, militar, canManage, isRegistroIncompativel, isRegistroIncompleto, onDetalhe, onRetificar, onCancelar }) {
  if (!promocaoAtual) {
    return <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-5 text-sm text-blue-900">
      Nenhum registro ativo atual localizado para compor a referência funcional.
    </div>;
  }

  return <div className={`rounded-2xl border p-5 space-y-4 ${getCardClass(promocaoAtual, true)}`}>
    <div className="flex items-start gap-4">
      <div className="flex h-16 min-w-16 items-center justify-center rounded-2xl border border-blue-200 bg-white shadow-sm">
        <RankIcon postoGraduacao={promocaoAtual.posto_graduacao_novo || militar?.posto_graduacao} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge className={`${SECTION_BADGE.atual} border`}>Atual</Badge>
          <StatusBadge registro={promocaoAtual} />
          {isRegistroIncompativel(promocaoAtual) && <Badge variant="outline" className="border-rose-200 text-rose-700">Registro incompatível</Badge>}
          {isRegistroIncompleto(promocaoAtual) && <Badge variant="outline" className="border-amber-200 text-amber-700">Registro incompleto</Badge>}
        </div>
        <h3 className="text-xl font-bold text-blue-950 leading-tight">{promocaoAtual.posto_graduacao_novo || militar?.posto_graduacao || 'Posto atual não informado'}</h3>
        <p className="text-sm text-blue-800/80">Referência funcional atual para cálculo e validação.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <Info label="Quadro" value={promocaoAtual.quadro_novo || militar?.quadro || '—'} />
      <Info label="Data da promoção" value={promocaoAtual.data_promocao || '—'} />
      <Info label="Nº/ordem de antiguidade" value={promocaoAtual.antiguidade_referencia_ordem ?? '—'} />
      <Info label="Publicação" value={promocaoAtual.data_publicacao || '—'} />
      <Info label="Boletim / ato" value={promocaoAtual.boletim_referencia || promocaoAtual.ato_referencia || '—'} />
    </div>
    <RegistroActions registro={promocaoAtual} canManage={canManage} onDetalhe={onDetalhe} onRetificar={onRetificar} onCancelar={onCancelar} />
  </div>;
}

function AreaHeader({ title, description, badge, badgeClass }) {
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <Badge className={`${badgeClass} border`}>{badge}</Badge>
    </div>
    <p className="text-xs leading-5 text-slate-500">{description}</p>
  </div>;
}

export default function PromocoesTimeline({ historico, promocaoAtual, militar, canManage, isRegistroIncompativel, isRegistroIncompleto, onDetalhe, onRetificar, onEditarPrevisao, onCancelar, onEfetivar, onExcluir }) {
  const registros = historico || [];
  const anteriores = registros.filter((h) => h.id !== promocaoAtual?.id && statusRegistro(h) !== 'previsto');
  const futuras = registros.filter((h) => statusRegistro(h) === 'previsto');
  const militarId = String(militar?.id || '');
  const promocaoAtualId = String(promocaoAtual?.id || '');
  const podeExcluirRegistro = (registro, { emPromocoesAnteriores = false } = {}) => {
    const status = statusRegistro(registro);
    if (!canManage || !onExcluir || !registro?.id || !militarId) return false;
    if (String(registro?.militar_id || '') !== militarId) return false;
    if (String(registro.id) === promocaoAtualId) return false;
    const ehBaseFuncionalAtual = status === 'ativo' && valorTexto(registro?.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(registro?.quadro_novo) === valorTexto(militar?.quadro);
    if (ehBaseFuncionalAtual) return false;
    if (status === 'previsto') return true;
    if (status === 'ativo') return emPromocoesAnteriores;
    return status === 'cancelado' && emPromocoesAnteriores;
  };

  return <div className="space-y-6">
    <div className="relative hidden lg:block px-[16.5%]" aria-hidden="true">
      <div className="h-1 rounded-full bg-gradient-to-r from-slate-300 via-blue-400 to-amber-300" />
      <div className="absolute left-[16.5%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 border-white bg-slate-400 shadow" />
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow" />
      <div className="absolute right-[16.5%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 border-white bg-amber-400 shadow" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_minmax(0,1fr)] gap-4 items-start">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <AreaHeader title="Promoções Anteriores" description="Histórico funcional anterior ao posto atual." badge="Histórico" badgeClass={SECTION_BADGE.historico} />
        {anteriores.length === 0
          ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Nenhuma promoção anterior cadastrada.</div>
          : anteriores.map((h) => <RegistroCard key={h.id} registro={h} canManage={canManage} canExcluir={podeExcluirRegistro(h, { emPromocoesAnteriores: true })} isRegistroIncompativel={isRegistroIncompativel} isRegistroIncompleto={isRegistroIncompleto} onDetalhe={onDetalhe} onRetificar={onRetificar} onEditarPrevisao={onEditarPrevisao} onCancelar={onCancelar} onExcluir={onExcluir} compacto />)}
      </section>

      <section className="space-y-3 rounded-2xl border-2 border-blue-200 bg-white p-4 shadow-sm">
        <AreaHeader title="Posto Atual" description="Centro da progressão e referência funcional vigente." badge="Atual" badgeClass={SECTION_BADGE.atual} />
        <PostoAtualCard promocaoAtual={promocaoAtual} militar={militar} canManage={canManage} isRegistroIncompativel={isRegistroIncompativel} isRegistroIncompleto={isRegistroIncompleto} onDetalhe={onDetalhe} onRetificar={onRetificar} onCancelar={onCancelar} />
      </section>

      <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
        <AreaHeader title="Promoções Futuras / Previstas" description="Etapas planejadas ainda não efetivadas." badge="Previsto" badgeClass={SECTION_BADGE.previsto} />
        {futuras.length === 0
          ? <div className="rounded-xl border border-dashed border-amber-300 bg-white/80 p-4 text-sm text-slate-500">Nenhuma promoção futura prevista.</div>
          : futuras.map((h) => <RegistroCard key={h.id} registro={h} canManage={canManage} canExcluir={podeExcluirRegistro(h)} isRegistroIncompativel={isRegistroIncompativel} isRegistroIncompleto={isRegistroIncompleto} onDetalhe={onDetalhe} onRetificar={onRetificar} onEditarPrevisao={onEditarPrevisao} onCancelar={onCancelar} onEfetivar={onEfetivar} onExcluir={onExcluir} compacto />)}
      </section>
    </div>
  </div>;
}
