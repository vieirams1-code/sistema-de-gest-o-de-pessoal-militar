import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { obterVinculoAtestado, avaliarFluxoJiso } from '@/components/quadro/quadroHelpers';
import {
  Calendar,
  MessageSquare,
  User,
  CheckSquare,
  AlertTriangle,
  Tag,
  ShieldPlus,
  MoreVertical,
  ArrowRight,
} from 'lucide-react';

const PRIORIDADE_COR = {
  Urgente: 'bg-red-500',
  Alta: 'bg-orange-400',
  Média: 'bg-blue-400',
  Baixa: 'bg-slate-300',
};

function formatPrazo(prazo) {
  if (!prazo) return null;
  const d = new Date(`${prazo}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((d - hoje) / 86400000);
  const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (diff < 0) return { str, cls: 'bg-red-100 text-red-700 font-semibold', icon: true };
  if (diff <= 3) return { str, cls: 'bg-amber-100 text-amber-700 font-semibold', icon: true };
  return { str, cls: 'bg-slate-100 text-slate-500', icon: false };
}

function formatDate(value) {
  if (!value) return '--';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '--' : d.toLocaleDateString('pt-BR');
}

function calcularDiasRestantes(dataFinal) {
  if (!dataFinal) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(`${dataFinal}T00:00:00`);
  if (Number.isNaN(fim.getTime())) return null;
  return Math.round((fim - hoje) / 86400000);
}

function obterAlertaJiso(fluxoJiso) {
  if (!fluxoJiso.jisoAgendada) {
    return { texto: 'JISO não agendada', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  if (!fluxoJiso.decisaoJisoRegistrada) {
    return { texto: 'Aguardando decisão da JISO', className: 'bg-violet-50 text-violet-700 border-violet-200' };
  }

  return { texto: 'Decisão da JISO registrada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

function obterCtaJiso(fluxoJiso) {
  if (!fluxoJiso.jisoAgendada) return 'Agendar JISO';
  if (!fluxoJiso.decisaoJisoRegistrada) return 'Registrar decisão';
  return 'Ver decisão';
}

export default function CardItem({ card, onClick }) {
  const prazo = formatPrazo(card.prazo);
  const dotPrioridade = PRIORIDADE_COR[card.prioridade] || 'bg-slate-300';
  const origemExcluida = card.origem_status === 'Excluída' || card.status === 'Origem Excluída';

  const { data: vinculos = [] } = useQuery({
    queryKey: ['vinculos', card.id],
    queryFn: () => base44.entities.CardVinculo.filter({ card_id: card.id }),
    enabled: card.origem_tipo === 'Atestado/JISO' && !!card.criado_automaticamente,
  });

  const vinculoAtestado = useMemo(() => obterVinculoAtestado(vinculos), [vinculos]);

  const { data: atestadoVinculado } = useQuery({
    queryKey: ['atestado', vinculoAtestado?.referencia_id],
    queryFn: () => base44.entities.Atestado.get(vinculoAtestado.referencia_id),
    enabled: !!vinculoAtestado?.referencia_id,
  });

  const fluxoJiso = useMemo(
    () => avaliarFluxoJiso({ card, atestadoVinculado, vinculoAtestado }),
    [card, atestadoVinculado, vinculoAtestado]
  );

  if (fluxoJiso.isCardJisoElegivel) {
    const alerta = obterAlertaJiso(fluxoJiso);
    const ctaLabel = obterCtaJiso(fluxoJiso);
    const diasRestantes = calcularDiasRestantes(atestadoVinculado?.data_termino);

    return (
      <div
        onClick={() => onClick(card)}
        className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/60 p-3.5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <ShieldPlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{card.militar_nome_snapshot || card.titulo}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {(atestadoVinculado?.militar_posto || 'Posto/Graduação não informado')}
                {atestadoVinculado?.militar_matricula ? ` · Mat: ${atestadoVinculado.militar_matricula}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            {atestadoVinculado?.status_jiso || 'JISO em análise'}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {atestadoVinculado?.tipo_afastamento || card.tipo || 'Afastamento'}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {fluxoJiso.jisoAgendada ? 'JISO agendada' : 'JISO pendente'}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-2.5">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-slate-400">Início</p>
              <p className="font-semibold text-slate-700">{formatDate(atestadoVinculado?.data_inicio)}</p>
            </div>
            <div>
              <p className="text-slate-400">Retorno previsto</p>
              <p className="font-semibold text-slate-700">{formatDate(atestadoVinculado?.data_termino)}</p>
            </div>
          </div>
          {typeof diasRestantes === 'number' && (
            <p className="mt-2 text-[11px] text-slate-500">
              {diasRestantes >= 0 ? `${diasRestantes} dia(s) para retorno` : `${Math.abs(diasRestantes)} dia(s) em atraso`}
            </p>
          )}
        </div>

        <div className={`mt-2.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${alerta.className}`}>
          {alerta.texto}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(card);
            }}
            className="w-full h-8 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
          >
            {ctaLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick(card)}
      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition-all group"
    >
      {card.etiqueta_texto && (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 text-white"
          style={{ backgroundColor: card.etiqueta_cor || '#6366f1' }}
        >
          <Tag className="w-2.5 h-2.5" />
          {card.etiqueta_texto}
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotPrioridade}`} />
        <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-slate-900 flex-1">{card.titulo}</p>
      </div>

      {card.militar_nome_snapshot && (
        <div className="flex items-center gap-1 mt-1.5 ml-4">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500 truncate">{card.militar_nome_snapshot}</span>
        </div>
      )}

      {origemExcluida && (
        <div className="mt-2 ml-4">
          <span className="inline-flex items-center text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold">
            Origem Excluída
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 ml-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {prazo && (
            <span className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${prazo.cls}`}>
              {prazo.icon && <AlertTriangle className="w-2.5 h-2.5" />}
              <Calendar className="w-2.5 h-2.5" />
              {prazo.str}
            </span>
          )}
          {card.checklist_resumo && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CheckSquare className="w-3 h-3" />
              {card.checklist_resumo}
            </span>
          )}
        </div>
        {card.comentarios_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <MessageSquare className="w-3 h-3" />
            {card.comentarios_count}
          </span>
        )}
      </div>

      {card.origem_tipo && card.origem_tipo !== 'Manual' ? (
        <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
          {card.origem_tipo && card.origem_tipo !== 'Manual' && (
            <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
              {card.origem_tipo}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
