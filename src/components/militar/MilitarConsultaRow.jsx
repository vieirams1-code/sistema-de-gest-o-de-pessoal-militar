import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Trash2, CalendarClock, Car, HeartPulse, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { isQuadroComDestaque } from '@/utils/postoQuadroCompatibilidade';
import { getQuadroMilitar } from '@/utils/militarPostoGraduacao';
import { resolveTagVisual } from '@/utils/tags/tagPresenter';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import CondicaoBadge from '@/components/militar/CondicaoBadge';

// =====================================================================
// MilitarConsultaRow
// ---------------------------------------------------------------------
// Linha individual da tabela de Consulta Militar, extraída de
// pages/Militares.jsx para permitir virtualização via react-window.
// Mantém o mesmo layout e comportamento original.
// =====================================================================

const MAX_TAGS_INLINE = 5;
const WRAP_COLUMN_KEYS = new Set([
  'nome_completo',
  'endereco',
  'logradouro',
  'lotacao',
  'origem_destino',
  'obs',
  'observacao',
  'observacoes_administrativas',
]);

const TAG_DEFS = {
  '🚑': { label: 'Junta Médica', icon: HeartPulse, bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  '🚗': { label: 'Viatura', icon: Car, bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  '⚠️': { label: 'Restrição', icon: AlertTriangle, bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

const statusBadgeClass = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

const SITUACAO_MILITAR_BADGES = {
  'Designado': { label: 'Designado', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Convocado': { label: 'Convocado', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'Reserva Remunerada': { label: 'Reserva Remunerada', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Reformado': { label: 'Reformado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function MilitarConsultaRow({
  militar,
  style,
  militaresGridTemplate,
  sanitizedVisibleColumnKeys,
  columnMetaByKey,
  getColumnClassName,
  emojisEfetivoByMilitar,
  isSelected,
  onToggleSelection,
  isAdmin,
  canAccessAction,
  onPromocaoAtual,
  onAskDelete,
}) {
  const navigate = useNavigate();
  const destacarQuadro = isQuadroComDestaque(getQuadroMilitar(militar));

  return (
    <div
      style={style}
      className={`grid min-w-full items-center border-b text-sm ${destacarQuadro ? 'bg-amber-50 border-amber-100' : ''}`}
    >
      <div
        className="grid min-w-full items-center h-full"
        style={{ gridTemplateColumns: militaresGridTemplate }}
      >
        <div className="min-w-0 px-2 py-2 flex items-center justify-center">
          <label>
            <input
              type="checkbox"
              aria-label="Selecionar militar"
              checked={isSelected}
              onChange={(e) => onToggleSelection(String(militar.id), e.target.checked)}
            />
          </label>
        </div>
        {sanitizedVisibleColumnKeys.map((key) => {
          const column = columnMetaByKey.get(key) || {};
          if (key === 'nome') {
            const emojisData = emojisEfetivoByMilitar.get(String(militar.id));
            const tagsLinha = Array.isArray(emojisData?.itens) ? emojisData.itens.filter(Boolean) : [];
            const tagsVisiveis = tagsLinha.slice(0, MAX_TAGS_INLINE);
            const excessoTags = Math.max(0, tagsLinha.length - MAX_TAGS_INLINE);
            return (
              <div key={key} className={`min-w-0 px-2 py-2 overflow-hidden ${getColumnClassName(column)}`}>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 min-w-0 max-w-full overflow-hidden">
                    <span className="font-bold text-gray-900 truncate min-w-0 flex-1">
                      {militar.nome_guerra || militar.nome_completo}
                    </span>
                    {tagsVisiveis.length > 0 && (
                      <div className="flex gap-1 items-center overflow-hidden min-w-0 shrink">
                        {tagsVisiveis.map((item, idx) => {
                          const emoji = String(item?.emoji || '').trim();
                          const tagVisual = resolveTagVisual({ nome: item?.nome, emoji });
                          const def = TAG_DEFS[emoji];
                          const label = def?.label || tagVisual?.nome || item?.nome || emoji || 'Tag';
                          const Icon = def?.icon;
                          return (
                            <Tooltip key={`${emoji || label}-${idx}`}>
                              <TooltipTrigger asChild>
                                <span
                                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${def?.bg || 'bg-slate-100'} ${def?.text || 'text-slate-700'} ${def?.border || 'border-slate-200'}`}
                                >
                                  {Icon ? (
                                    <Icon size={11} strokeWidth={3} />
                                  ) : (
                                    <IconeCatalogo value={tagVisual?.emoji || emoji || '🏷️'} />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{label}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {excessoTags > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                                +{excessoTags}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{tagsLinha.slice(MAX_TAGS_INLINE).map((tag) => (
                                resolveTagVisual({ nome: tag?.nome, emoji: String(tag?.emoji || '').trim() })?.nome
                                || tag?.nome
                                || String(tag?.emoji || '').trim()
                                || 'Tag'
                              )).join(', ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 mt-0.5 whitespace-normal break-words leading-snug">
                    {militar.nome_completo}
                  </span>
                </div>
              </div>
            );
          }
          if (key === 'situacao_condicao_militar') {
            return (
              <div key={key} className={`min-w-0 px-2 py-2 overflow-hidden ${getColumnClassName(column)}`}>
                <CondicaoBadge militar={militar} />
              </div>
            );
          }
          if (key === 'situacao_militar') {
            return (
              <div key={key} className={`min-w-0 px-2 py-2 overflow-hidden ${getColumnClassName(column)}`}>
                {SITUACAO_MILITAR_BADGES[militar.situacao_militar] ? (
                  <Badge variant="outline" className={`${SITUACAO_MILITAR_BADGES[militar.situacao_militar].className} border text-xs font-medium`}>
                    {SITUACAO_MILITAR_BADGES[militar.situacao_militar].label}
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            );
          }
          if (key === 'status_cadastro') {
            return (
              <div key={key} className={`min-w-0 px-2 py-2 overflow-hidden ${getColumnClassName(column)}`}>
                <Badge className={`${statusBadgeClass[militar.status_cadastro] || statusBadgeClass.Ativo} border`}>
                  {militar.status_cadastro || 'Ativo'}
                </Badge>
              </div>
            );
          }
          const value = columnMetaByKey.get(key)?.accessor?.(militar) || '—';
          return (
            <div key={key} className={`min-w-0 px-2 py-2 overflow-hidden ${getColumnClassName(column)}`.trim()}>
              <span className={WRAP_COLUMN_KEYS.has(key)
                ? 'block whitespace-normal break-words leading-snug'
                : 'block truncate'}
              >
                {value}
              </span>
            </div>
          );
        })}
        <div className="min-w-0 px-2 py-2 flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militar.id}`)}
                aria-label="Visualizar detalhes"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Visualizar detalhes</TooltipContent>
          </Tooltip>

          {canAccessAction('editar_militares') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`)}
                  aria-label="Editar militar"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar militar</TooltipContent>
            </Tooltip>
          )}

          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPromocaoAtual(militar)}
                  aria-label="Registrar promoção atual"
                >
                  <CalendarClock className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Registrar promoção atual</TooltipContent>
            </Tooltip>
          )}

          {canAccessAction('excluir_militares') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  onClick={() => onAskDelete(militar)}
                  aria-label="Excluir militar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir militar</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(MilitarConsultaRow);