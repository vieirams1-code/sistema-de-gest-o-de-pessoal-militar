import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock3, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardDetalheModal from '@/components/quadro/CardDetalheModal';
import { deleteCardAcao, listAllCardAcoes, updateCardAcao } from '@/components/quadro/cardAcoesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function getPrimeiroValor(item, campos = []) {
  for (const campo of campos) {
    const valor = item?.[campo];
    if (valor !== undefined && valor !== null && `${valor}`.trim() !== '') return valor;
  }
  return '';
}

function normalizarAcao(acao) {
  return {
    ...acao,
    titulo: getPrimeiroValor(acao, ['titulo', 'nome', 'title']) || 'Ação sem título',
    data_prevista: getPrimeiroValor(acao, ['data_prevista', 'data', 'prazo', 'data_acao']) || null,
    status: getPrimeiroValor(acao, ['status', 'situacao', 'estado']) || 'Pendente',
    responsavel: getPrimeiroValor(acao, ['responsavel', 'responsavel_nome', 'responsavel_acao']) || '',
    observacao: getPrimeiroValor(acao, ['observacao', 'descricao', 'detalhes']) || '',
    anotacoes: getPrimeiroValor(acao, ['anotacoes', 'comentarios', 'comentario_acao']) || '',
  };
}

function toDateKey(valor) {
  if (!valor) return null;
  const str = `${valor}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const data = new Date(str);
  if (Number.isNaN(data.getTime())) return null;
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarData(valor) {
  const key = toDateKey(valor);
  if (!key) return 'Sem data';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function normalizarStatus(status) {
  return (status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isConcluida(status) {
  return ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado'].includes(normalizarStatus(status));
}

function extrairComentarios(anotacoes) {
  if (!anotacoes) return [];
  if (Array.isArray(anotacoes)) {
    return anotacoes.map((item) => `${item ?? ''}`.trim()).filter(Boolean);
  }
  return `${anotacoes}`
    .split(/\r?\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function montarPayloadAcao(payload) {
  const titulo = payload.titulo?.trim() || '';
  const observacao = payload.observacao?.trim() || '';
  const dataPrevista = payload.data_prevista || null;
  const status = payload.status || 'Pendente';
  const responsavel = payload.responsavel?.trim() || '';
  const anotacoes = payload.anotacoes?.trim() || '';

  return {
    ...(titulo ? { titulo, nome: titulo, title: titulo } : {}),
    data_prevista: dataPrevista,
    data: dataPrevista,
    prazo: dataPrevista,
    data_acao: dataPrevista,
    status,
    situacao: status,
    estado: status,
    responsavel,
    responsavel_nome: responsavel,
    responsavel_acao: responsavel,
    observacao,
    descricao: observacao,
    detalhes: observacao,
    anotacoes,
    comentarios: anotacoes,
    comentario_acao: anotacoes,
    concluida: status === 'Concluída',
  };
}

function GrupoAcoes({
  titulo,
  descricao,
  icon: Icon,
  grupos,
  onOpenCard,
  onMarkConcluida,
  onDelete,
  onStartEdit,
  onChangeDraft,
  onSaveEdit,
  onChangeComment,
  onSaveComment,
  editingAcaoId,
  acaoDrafts,
  commentDrafts,
  loadingMarkConcluidaId,
  loadingDeleteId,
  loadingSaveId,
  loadingSaveCommentId,
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          <span className="text-xs text-slate-400">({grupos.length})</span>
        </div>
        <span className="text-[11px] text-slate-400">{descricao}</span>
      </div>

      {grupos.length === 0 ? (
        <p className="px-4 py-5 text-xs text-slate-400">Nenhuma ação neste grupo.</p>
      ) : (
        <div className="p-3 space-y-3">
          {grupos.map((grupo) => (
            <article key={grupo.card.id} className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <header className="px-3 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-indigo-50 px-1.5 text-[10px] font-bold text-indigo-600 border border-indigo-100">
                      #{(grupo.card.codigo || grupo.card.id || '').slice(-4).toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{grupo.card.titulo || grupo.card.militar_nome_snapshot || 'Card sem título'}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{grupo.acoes.length} ação(ões) vinculada(s) a este card</p>
                </div>

                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => onOpenCard(grupo.card.id)}>
                  Abrir card
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Button>
              </header>

              <div className="px-3 py-2.5">
                <div className="border-l-2 border-indigo-100 pl-3 space-y-2">
                  {grupo.acoes.map((acao) => (
                    <div key={acao.id} className={`bg-white border rounded-lg px-3 py-2.5 ${isConcluida(acao.status) ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isConcluida(acao.status) ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>{acao.titulo}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>Prazo: {formatarData(acao.data_prevista)}</span>
                          <span>Status: {acao.status}</span>
                          {acao.responsavel && <span>Resp.: {acao.responsavel}</span>}
                          {isConcluida(acao.status) && <span className="font-semibold text-emerald-700">Concluída</span>}
                        </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {editingAcaoId === acao.id ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8"
                              onClick={() => onSaveEdit(acao)}
                              disabled={loadingSaveId === acao.id}
                            >
                              Salvar
                            </Button>
                          ) : (
                            !isConcluida(acao.status) && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                onClick={() => onMarkConcluida(acao)}
                                disabled={loadingMarkConcluidaId === acao.id}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Marcar concluída
                              </Button>
                            )
                          )}
                          {editingAcaoId !== acao.id && (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => onStartEdit(acao)}>
                              Editar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-rose-600"
                            onClick={() => onDelete(acao)}
                            disabled={loadingDeleteId === acao.id}
                          >
                            Excluir
                          </Button>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenCard(grupo.card.id)}>
                            Abrir card
                          </Button>
                        </div>
                      </div>

                      {editingAcaoId === acao.id && (
                        <div className="mt-2 border-t border-slate-100 pt-2 grid gap-2">
                          <Input
                            value={acaoDrafts[acao.id]?.titulo ?? acao.titulo}
                            onChange={(event) => onChangeDraft(acao.id, 'titulo', event.target.value)}
                            placeholder="Título da ação"
                          />
                          <div className="grid sm:grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={toDateKey(acaoDrafts[acao.id]?.data_prevista ?? acao.data_prevista) || ''}
                              onChange={(event) => onChangeDraft(acao.id, 'data_prevista', event.target.value)}
                            />
                            <Input
                              value={acaoDrafts[acao.id]?.responsavel ?? acao.responsavel}
                              onChange={(event) => onChangeDraft(acao.id, 'responsavel', event.target.value)}
                              placeholder="Responsável"
                            />
                          </div>
                          <Textarea
                            value={acaoDrafts[acao.id]?.observacao ?? acao.observacao}
                            onChange={(event) => onChangeDraft(acao.id, 'observacao', event.target.value)}
                            placeholder="Observações da ação"
                            rows={2}
                          />
                        </div>
                      )}

                      <div className="mt-2 border-t border-slate-100 pt-2 space-y-1.5">
                        <div className="flex gap-2">
                          <Input
                            value={commentDrafts[acao.id] || ''}
                            onChange={(event) => onChangeComment(acao.id, event.target.value)}
                            placeholder="Digite um comentário"
                          />
                          <Button
                            size="sm"
                            className="h-9"
                            onClick={() => onSaveComment(acao)}
                            disabled={loadingSaveCommentId === acao.id || !(commentDrafts[acao.id] || '').trim()}
                          >
                            Salvar comentário
                          </Button>
                        </div>
                        <div className="space-y-0.5">
                          {extrairComentarios(acao.anotacoes).length === 0 && <p className="text-[11px] text-slate-400">Sem comentários.</p>}
                          {extrairComentarios(acao.anotacoes).map((comentario, index) => (
                            <p key={`${acao.id}-comentario-${index}`} className="text-[11px] text-slate-500 truncate">
                              {index + 1} - {comentario}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AgendaAcoesOperacionaisPage() {
  const queryClient = useQueryClient();
  const [cardAbertoId, setCardAbertoId] = useState(null);
  const [editingAcaoId, setEditingAcaoId] = useState(null);
  const [acaoDrafts, setAcaoDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const { data: quadros = [] } = useQuery({
    queryKey: ['quadros'],
    queryFn: () => base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem'),
  });

  const quadro = quadros[0] || null;

  const { data: colunas = [] } = useQuery({
    queryKey: ['colunas', quadro?.id],
    queryFn: () => base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem'),
    enabled: !!quadro?.id,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['cards', quadro?.id],
    queryFn: async () => {
      if (!colunas.length) return [];
      const cardsBrutos = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
      const colunasIds = new Set(colunas.map((coluna) => coluna.id));
      return cardsBrutos.filter((card) => colunasIds.has(card.coluna_id));
    },
    enabled: !!quadro?.id && colunas.length > 0,
  });

  const { data: acoesRaw = [] } = useQuery({
    queryKey: ['acoes-consolidadas-quadro'],
    queryFn: () => listAllCardAcoes(3000),
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ acao, status }) => {
      await updateCardAcao(acao.id, montarPayloadAcao({
        titulo: acao.titulo,
        data_prevista: acao.data_prevista,
        status,
        responsavel: acao.responsavel,
        observacao: acao.observacao,
        anotacoes: acao.anotacoes,
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    },
  });

  const salvarEdicaoMutation = useMutation({
    mutationFn: async ({ acaoId, payload }) => updateCardAcao(acaoId, montarPayloadAcao(payload)),
    onSuccess: () => {
      setEditingAcaoId(null);
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    },
  });

  const excluirAcaoMutation = useMutation({
    mutationFn: (acaoId) => deleteCardAcao(acaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    },
  });

  const salvarComentarioMutation = useMutation({
    mutationFn: async ({ acao, comentario }) => {
      const comentariosAtuais = extrairComentarios(acao.anotacoes);
      const anotacoesAtualizadas = [...comentariosAtuais, comentario].join('\n');
      await updateCardAcao(acao.id, montarPayloadAcao({
        titulo: acao.titulo,
        data_prevista: acao.data_prevista,
        status: acao.status,
        responsavel: acao.responsavel,
        observacao: acao.observacao,
        anotacoes: anotacoesAtualizadas,
      }));
    },
    onSuccess: (_, variables) => {
      setCommentDrafts((anterior) => ({ ...anterior, [variables.acao.id]: '' }));
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    },
  });

  const { atrasadas, hoje, proximas, cardSelecionado, colunaCardSelecionado } = useMemo(() => {
    const mapaCards = new Map(cards.map((card) => [card.id, card]));
    const mapaColunas = new Map(colunas.map((coluna) => [coluna.id, coluna]));
    const hojeKey = toDateKey(new Date());

    const agrupadas = { atrasadas: [], hoje: [], proximas: [] };

    acoesRaw
      .map(normalizarAcao)
      .forEach((acao) => {
        const card = mapaCards.get(acao.card_id);
        if (!card) return;

        const dataKey = toDateKey(acao.data_prevista);
        const acaoComCard = {
          ...acao,
          card,
        };

        if (!dataKey || dataKey > hojeKey) {
          agrupadas.proximas.push(acaoComCard);
        } else if (dataKey < hojeKey) {
          agrupadas.atrasadas.push(acaoComCard);
        } else {
          agrupadas.hoje.push(acaoComCard);
        }
      });

    const ordenar = (a, b) => {
      const aKey = toDateKey(a.data_prevista) || '9999-12-31';
      const bKey = toDateKey(b.data_prevista) || '9999-12-31';
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    };

    const agruparPorCard = (acoes) => {
      const gruposMap = new Map();
      acoes.sort(ordenar).forEach((acao) => {
        if (!gruposMap.has(acao.card.id)) {
          gruposMap.set(acao.card.id, { card: acao.card, acoes: [] });
        }
        gruposMap.get(acao.card.id).acoes.push(acao);
      });
      return Array.from(gruposMap.values()).sort((a, b) =>
        (a.card.titulo || '').localeCompare(b.card.titulo || '', 'pt-BR')
      );
    };

    const cardSelecionadoAtual = mapaCards.get(cardAbertoId) || null;
    const colunaSelecionadaAtual = cardSelecionadoAtual ? mapaColunas.get(cardSelecionadoAtual.coluna_id) : null;

    return {
      atrasadas: agruparPorCard(agrupadas.atrasadas),
      hoje: agruparPorCard(agrupadas.hoje),
      proximas: agruparPorCard(agrupadas.proximas),
      cardSelecionado: cardSelecionadoAtual,
      colunaCardSelecionado: colunaSelecionadaAtual,
    };
  }, [acoesRaw, cards, colunas, cardAbertoId]);

  const propsComunsGrupo = {
    onOpenCard: setCardAbertoId,
    onMarkConcluida: (acao) => atualizarStatusMutation.mutate({ acao, status: 'Concluída' }),
    onDelete: (acao) => excluirAcaoMutation.mutate(acao.id),
    onStartEdit: (acao) => {
      setEditingAcaoId(acao.id);
      setAcaoDrafts((anterior) => ({ ...anterior, [acao.id]: { ...acao } }));
    },
    onChangeDraft: (acaoId, campo, valor) => {
      setAcaoDrafts((anterior) => ({ ...anterior, [acaoId]: { ...(anterior[acaoId] || {}), [campo]: valor } }));
    },
    onSaveEdit: (acao) => salvarEdicaoMutation.mutate({ acaoId: acao.id, payload: acaoDrafts[acao.id] || acao }),
    onChangeComment: (acaoId, valor) => setCommentDrafts((anterior) => ({ ...anterior, [acaoId]: valor })),
    onSaveComment: (acao) => salvarComentarioMutation.mutate({ acao, comentario: (commentDrafts[acao.id] || '').trim() }),
    editingAcaoId,
    acaoDrafts,
    commentDrafts,
    loadingMarkConcluidaId: atualizarStatusMutation.isPending ? atualizarStatusMutation.variables?.acao?.id : null,
    loadingDeleteId: excluirAcaoMutation.isPending ? excluirAcaoMutation.variables : null,
    loadingSaveId: salvarEdicaoMutation.isPending ? salvarEdicaoMutation.variables?.acaoId : null,
    loadingSaveCommentId: salvarComentarioMutation.isPending ? salvarComentarioMutation.variables?.acao?.id : null,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-4">
      <header className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-indigo-600">Agenda de Ações v1.3</p>
        <div className="mt-1 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-500" />
          <h1 className="text-lg font-bold text-slate-800">Ações Operacionais</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Visão consolidada de ações abertas do Quadro Operacional.</p>
      </header>

      <GrupoAcoes
        titulo="Atrasadas"
        descricao="Prazo menor que hoje"
        icon={AlertTriangle}
        grupos={atrasadas}
        {...propsComunsGrupo}
      />
      <GrupoAcoes
        titulo="Hoje"
        descricao="Prazo do dia"
        icon={Clock3}
        grupos={hoje}
        {...propsComunsGrupo}
      />
      <GrupoAcoes
        titulo="Próximas"
        descricao="Sem prazo vencido"
        icon={CalendarClock}
        grupos={proximas}
        {...propsComunsGrupo}
      />

      {cardSelecionado && (
        <CardDetalheModal
          card={cardSelecionado}
          colunaNome={colunaCardSelecionado?.nome || 'Coluna'}
          onClose={() => setCardAbertoId(null)}
          onCardUpdate={() => queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] })}
        />
      )}
    </div>
  );
}
