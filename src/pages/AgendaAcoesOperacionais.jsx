import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock3, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardDetalheModal from '@/components/quadro/CardDetalheModal';
import { deleteCardAcao, listAllCardAcoes, updateCardAcao } from '@/components/quadro/cardAcoesService';
import { formatarDataBR, isConcluidaAcao, montarPayloadAcao, normalizarAcao, toDateKey } from '@/components/quadro/cardAcoesUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

function atualizarAcaoNoCache(lista, acaoId, payloadAtualizado) {
  if (!Array.isArray(lista)) return lista;
  return lista.map((item) => (item.id === acaoId ? { ...item, ...payloadAtualizado } : item));
}

function contarAcoesNosGrupos(grupos) {
  if (!Array.isArray(grupos)) return 0;
  return grupos.reduce((total, grupo) => total + (grupo?.acoes?.length || 0), 0);
}

function GrupoAcoes({
  titulo,
  descricao,
  icon: Icon,
  grupos,
  onOpenCard,
  onToggleConcluida,
  onDelete,
  onStartEdit,
  onChangeDraft,
  onSaveEdit,
  editingAcaoId,
  acaoDrafts,
  loadingToggleId,
  loadingDeleteId,
  loadingSaveId,
}) {
  const totalAcoes = contarAcoesNosGrupos(grupos);


  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          <span className="text-xs text-slate-400">({totalAcoes})</span>
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
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {grupo.card.titulo || grupo.card.militar_nome_snapshot || 'Card sem título'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {grupo.acoes.length} ação(ões) aberta(s) vinculada(s) a este card
                  </p>
                </div>

                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => onOpenCard(grupo.card.id)}>
                  Abrir card
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Button>
              </header>

              <div className="px-3 py-2.5">
                <div className="border-l-2 border-indigo-100 pl-3 space-y-2">
                  {grupo.acoes.map((acao) => {
                    const draft = acaoDrafts[acao.id] || acao;
                    const concluida = isConcluidaAcao(draft);

                    return (
                      <div
                        key={acao.id}
                        className={`bg-white border rounded-lg px-3 py-2.5 ${
                          concluida ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                concluida ? 'text-emerald-700 line-through' : 'text-slate-800'
                              }`}
                            >
                              {draft.titulo}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>Prazo: {formatarDataBR(draft.data_prevista)}</span>
                              <span className={concluida ? 'font-semibold text-emerald-700' : ''}>
                                {concluida ? 'Concluída' : (draft.status || 'Pendente')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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
                              <Button
                                variant="secondary"
                                size="sm"
                                className={`h-8 ${concluida ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : ''}`}
                                onClick={() => onToggleConcluida(acao, !concluida)}
                                disabled={loadingToggleId === acao.id}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {concluida ? 'Desmarcar concluída' : 'Marcar concluída'}
                              </Button>
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
                              value={draft.titulo || ''}
                              onChange={(event) => onChangeDraft(acao.id, 'titulo', event.target.value)}
                              placeholder="Título da ação"
                            />
                            <Input
                              type="date"
                              value={toDateKey(draft.data_prevista) || ''}
                              onChange={(event) => onChangeDraft(acao.id, 'data_prevista', event.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasQuadroOperacionalAccess = canAccessModule('quadro_operacional');


  const canFetch = isAccessResolved && hasQuadroOperacionalAccess;

  const { data: quadros = [] } = useQuery({
    queryKey: ['quadros'],
    queryFn: () => base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem'),
    enabled: canFetch,
  });

  const quadro = quadros[0] || null;

  const { data: colunas = [] } = useQuery({
    queryKey: ['colunas', quadro?.id],
    queryFn: () => base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem'),
    enabled: canFetch && !!quadro?.id,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['cards', quadro?.id],
    queryFn: async () => {
      if (!colunas.length) return [];
      const cardsBrutos = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
      const colunasIds = new Set(colunas.map((coluna) => coluna.id));
      return cardsBrutos.filter((card) => colunasIds.has(card.coluna_id));
    },
    enabled: canFetch && !!quadro?.id && colunas.length > 0,
  });

  const { data: acoesRaw = [] } = useQuery({
    queryKey: ['acoes-consolidadas-quadro'],
    queryFn: () => listAllCardAcoes(3000),
    enabled: canFetch,
  });

  const toggleConclusaoMutation = useMutation({
    mutationFn: async ({ acao, status }) => {
      const payload = montarPayloadAcao({
        titulo: acao.titulo,
        data_prevista: acao.data_prevista,
        status,
      });
      await updateCardAcao(acao.id, payload);
      return { acaoId: acao.id, payload };
    },
    onSuccess: ({ acaoId, payload }) => {
      queryClient.setQueryData(['acoes-consolidadas-quadro'], (antigo) =>
        atualizarAcaoNoCache(antigo, acaoId, payload)
      );
      queryClient.setQueriesData({ queryKey: ['card-acoes'] }, (antigo) =>
        atualizarAcaoNoCache(antigo, acaoId, payload)
      );
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    },
  });

  const salvarEdicaoMutation = useMutation({
    mutationFn: async ({ acaoId, payload }) => {
      const payloadFinal = montarPayloadAcao(payload);
      await updateCardAcao(acaoId, payloadFinal);
      return { acaoId, payload: payloadFinal };
    },
    onSuccess: ({ acaoId, payload }) => {
      setEditingAcaoId(null);
      queryClient.setQueryData(['acoes-consolidadas-quadro'], (antigo) =>
        atualizarAcaoNoCache(antigo, acaoId, payload)
      );
      queryClient.setQueriesData({ queryKey: ['card-acoes'] }, (antigo) =>
        atualizarAcaoNoCache(antigo, acaoId, payload)
      );
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

  const { atrasadas, hoje, proximas, cardSelecionado, colunaCardSelecionado } = useMemo(() => {
    const mapaCards = new Map(cards.map((card) => [card.id, card]));
    const mapaColunas = new Map(colunas.map((coluna) => [coluna.id, coluna]));
    const hojeKey = toDateKey(new Date());

    const agrupadas = { atrasadas: [], hoje: [], proximas: [] };

    acoesRaw
      .map(normalizarAcao)
      .forEach((acao) => {
        if (isConcluidaAcao(acao)) return;

        const card = mapaCards.get(acao.card_id);
        if (!card) return;

        const dataKey = toDateKey(acao.data_prevista);
        const acaoComCard = { ...acao, card };

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
    const colunaSelecionadaAtual = cardSelecionadoAtual
      ? mapaColunas.get(cardSelecionadoAtual.coluna_id)
      : null;

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
    onToggleConcluida: (acao, concluir) => {
      if (!canAccessAction('gerir_acoes_operacionais')) {
        alert('Ação negada: você não tem permissão para alterar ações operacionais.');
        return;
      }
      toggleConclusaoMutation.mutate({ acao, status: concluir ? 'Concluída' : 'Pendente' });
    },
    onDelete: (acao) => {
      if (!canAccessAction('excluir_acao_operacional')) {
        alert('Ação negada: você não tem permissão para excluir ações operacionais.');
        return;
      }
      excluirAcaoMutation.mutate(acao.id);
    },
    onStartEdit: (acao) => {
      if (!canAccessAction('gerir_acoes_operacionais')) {
        alert('Ação negada: você não tem permissão para editar ações operacionais.');
        return;
      }
      setEditingAcaoId(acao.id);
      setAcaoDrafts((anterior) => ({ ...anterior, [acao.id]: { ...acao } }));
    },
    onChangeDraft: (acaoId, campo, valor) => {
      setAcaoDrafts((anterior) => ({
        ...anterior,
        [acaoId]: { ...(anterior[acaoId] || {}), [campo]: valor },
      }));
    },
    onSaveEdit: (acao) => {
      if (!canAccessAction('gerir_acoes_operacionais')) {
        alert('Ação negada: você não tem permissão para salvar edições de ações operacionais.');
        return;
      }
      salvarEdicaoMutation.mutate({ acaoId: acao.id, payload: acaoDrafts[acao.id] || acao });
    },
    editingAcaoId,
    acaoDrafts,
    loadingToggleId: toggleConclusaoMutation.isPending
      ? toggleConclusaoMutation.variables?.acao?.id
      : null,
    loadingDeleteId: excluirAcaoMutation.isPending ? excluirAcaoMutation.variables : null,
    loadingSaveId: salvarEdicaoMutation.isPending
      ? salvarEdicaoMutation.variables?.acaoId
      : null,
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasQuadroOperacionalAccess) return <AccessDenied modulo="Quadro Operacional" />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-4">
      <header className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-indigo-600">Ações v3.1</p>
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
          onCardUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
            queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
            queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
          }}
        />
      )}
    </div>
  );
}