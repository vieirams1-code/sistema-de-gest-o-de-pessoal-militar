import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LayoutDashboard, Plus, Search, RefreshCw } from 'lucide-react';
import ColunaBoard from '@/components/quadro/ColunaBoard';
import CardDetalheModal from '@/components/quadro/CardDetalheModal';
import NovoCardModal from '@/components/quadro/NovoCardModal';
import { buildChecklistResumo, criarChecklistPreset } from '@/components/quadro/quadroHelpers';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const QUADRO_NOME = 'Operacional';
const ORDER_STEP = 1024;

function toOrderNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupCardsByColuna(cards = [], colunas = []) {
  const mapa = {};
  colunas.forEach((coluna) => {
    mapa[coluna.id] = [];
  });

  cards.forEach((card) => {
    if (mapa[card.coluna_id]) {
      mapa[card.coluna_id].push(card);
    }
  });

  Object.values(mapa).forEach((lista) => {
    lista.sort((a, b) => toOrderNumber(a.ordem) - toOrderNumber(b.ordem));
  });

  return mapa;
}

function calcularProximaOrdemAoCriar(cardsDaColuna = []) {
  if (!cardsDaColuna.length) return ORDER_STEP;
  const ultimaOrdem = toOrderNumber(cardsDaColuna[cardsDaColuna.length - 1]?.ordem);
  return ultimaOrdem + ORDER_STEP;
}

function calcularOrdemDeInsercao(listaSemMovido = [], destinationIndex = 0) {
  if (!listaSemMovido.length) {
    return ORDER_STEP;
  }

  const anterior = destinationIndex > 0 ? listaSemMovido[destinationIndex - 1] : null;
  const proximo = destinationIndex < listaSemMovido.length ? listaSemMovido[destinationIndex] : null;

  if (!anterior && proximo) {
    return Math.max(1, toOrderNumber(proximo.ordem) - ORDER_STEP);
  }

  if (anterior && !proximo) {
    return toOrderNumber(anterior.ordem) + ORDER_STEP;
  }

  if (anterior && proximo) {
    const ordemAnterior = toOrderNumber(anterior.ordem);
    const ordemProxima = toOrderNumber(proximo.ordem);
    const diferenca = ordemProxima - ordemAnterior;

    if (diferenca > 1) {
      return Math.floor((ordemAnterior + ordemProxima) / 2);
    }

    return null;
  }

  return ORDER_STEP;
}

async function reindexarColunaComEspacos(colunaId, cardsDaColuna = []) {
  const ordenados = [...cardsDaColuna]
    .sort((a, b) => toOrderNumber(a.ordem) - toOrderNumber(b.ordem))
    .map((card, index) => ({
      ...card,
      coluna_id: colunaId,
      ordem: (index + 1) * ORDER_STEP,
    }));

  for (const card of ordenados) {
    await base44.entities.CardOperacional.update(card.id, {
      coluna_id: colunaId,
      ordem: card.ordem,
    });
  }

  return ordenados;
}

function substituirCardNaLista(cards = [], cardAtualizado) {
  return cards.map((card) => (card.id === cardAtualizado.id ? { ...card, ...cardAtualizado } : card));
}

export default function QuadroOperacionalPage() {
  const queryClient = useQueryClient();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  
  const hasAccess = canAccessModule('quadro_operacional');
  const canMoverCard = canAccessAction('mover_card');
  const canGerirColunas = canAccessAction('gerir_colunas');
  const canGerirQuadro = canAccessAction('gerir_quadro');

  const [busca, setBusca] = useState('');
  const [cardAberto, setCardAberto] = useState(null);
  const [colunaNovoCard, setColunaNovoCard] = useState(null);
  const [salvandoCard, setSalvandoCard] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [novaColuna, setNovaColuna] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchCardsDoQuadro = async () => {
    if (!colunas.length) return [];
    const cardsBrutos = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
    const colunasIds = new Set(colunas.map((coluna) => coluna.id));
    return cardsBrutos.filter((card) => colunasIds.has(card.coluna_id));
  };

  const { data: quadros = [], isLoading: loadQ } = useQuery({
    queryKey: ['quadros'],
    queryFn: () => base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem'),
    enabled: isAccessResolved && hasAccess,
  });
  const quadro = quadros[0] || null;

  const { data: colunas = [], isLoading: loadC } = useQuery({
    queryKey: ['colunas', quadro?.id],
    queryFn: () => base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem'),
    enabled: isAccessResolved && hasAccess && !!quadro?.id,
  });

  const { data: cards = [], isLoading: loadCards } = useQuery({
    queryKey: ['cards', quadro?.id],
    queryFn: fetchCardsDoQuadro,
    enabled: isAccessResolved && hasAccess && !!quadro?.id && colunas.length > 0,
  });

  const { data: checklistItens = [] } = useQuery({
    queryKey: ['checklist-board', quadro?.id],
    queryFn: () => base44.entities.CardChecklistItem.list('-created_date', 2000),
    enabled: isAccessResolved && hasAccess && !!quadro?.id,
  });

  const isLoading = loadQ || loadC || loadCards;

  const invalidateBoardData = () => {
    queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['colunas', quadro?.id] });
    queryClient.invalidateQueries({ queryKey: ['colunas'] });
    queryClient.invalidateQueries({ queryKey: ['quadros'] });
    queryClient.invalidateQueries({ queryKey: ['checklist-board', quadro?.id] });
    queryClient.invalidateQueries({ queryKey: ['checklist-board'] });
  };

  const cardsComResumo = useMemo(() => {
    const checklistPorCard = checklistItens.reduce((acc, item) => {
      if (!acc[item.card_id]) acc[item.card_id] = [];
      acc[item.card_id].push(item);
      return acc;
    }, {});

    return cards.map((card) => {
      const itens = checklistPorCard[card.id] || [];
      return {
        ...card,
        checklist_resumo: itens.length ? buildChecklistResumo(itens) : card.checklist_resumo,
      };
    });
  }, [cards, checklistItens]);

  const cardsFiltrados = useMemo(() => {
    if (!busca.trim()) return cardsComResumo;
    const q = busca.toLowerCase();
    return cardsComResumo.filter((c) =>
      c.titulo?.toLowerCase().includes(q) ||
      c.militar_nome_snapshot?.toLowerCase().includes(q) ||
      c.protocolo?.toLowerCase().includes(q)
    );
  }, [cardsComResumo, busca]);

  const cardsPorColuna = useMemo(() => {
    const base = busca.trim() ? cardsFiltrados : cardsComResumo;
    return groupCardsByColuna(base, colunas);
  }, [cardsFiltrados, cardsComResumo, colunas, busca]);

  useEffect(() => {
    const cardId = searchParams.get('cardId');
    if (!cardId || !cardsComResumo.length) return;

    const alvo = cardsComResumo.find((card) => card.id === cardId);
    if (!alvo) return;

    setCardAberto(alvo);
    const next = new URLSearchParams(searchParams);
    next.delete('cardId');
    setSearchParams(next, { replace: true });
  }, [cardsComResumo, searchParams, setSearchParams]);

  const criarCard = async (form) => {
    if (!canGerirQuadro) {
      window.alert('Ação negada: Sem permissão para gerir o quadro e criar cards.');
      return;
    }
    setSalvandoCard(true);
    try {
      const cardsDaColuna = [...cardsComResumo]
        .filter((card) => card.coluna_id === colunaNovoCard.id)
        .sort((a, b) => toOrderNumber(a.ordem) - toOrderNumber(b.ordem));

      const novoCard = await base44.entities.CardOperacional.create({
        ...form,
        coluna_id: colunaNovoCard.id,
        ordem: calcularProximaOrdemAoCriar(cardsDaColuna),
        status: 'Ativo',
        arquivado: false,
        criado_automaticamente: false,
        comentarios_count: 0,
      });

      if (form.preset && form.preset !== 'Nenhum') {
        await criarChecklistPreset(novoCard.id, form.preset);
      }

      invalidateBoardData();
      setColunaNovoCard(null);
    } finally {
      setSalvandoCard(false);
    }
  };

  const onDragEnd = async ({ source, destination }) => {
    if (!destination || busca.trim() || movendo) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (!canMoverCard) {
      window.alert('Ação negada: Sem permissão para mover cards.');
      return;
    }

    const sourceColunaId = source.droppableId;
    const destinationColunaId = destination.droppableId;
    const grouped = groupCardsByColuna(cardsComResumo, colunas);

    const sourceCards = [...(grouped[sourceColunaId] || [])];
    const destinationCards = sourceColunaId === destinationColunaId
      ? [...sourceCards]
      : [...(grouped[destinationColunaId] || [])];

    const previousCards = queryClient.getQueryData(['cards', quadro?.id]);
    let movedCard = null;

    try {
      setMovendo(true);

      if (sourceColunaId === destinationColunaId) {
        const listaBase = [...sourceCards];
        [movedCard] = listaBase.splice(source.index, 1);

        if (!movedCard) return;

        let ordemNova = calcularOrdemDeInsercao(listaBase, destination.index);

        if (ordemNova === null) {
          const reindexados = await reindexarColunaComEspacos(sourceColunaId, sourceCards);
          const listaReindexada = [...reindexados];
          const indiceMovido = listaReindexada.findIndex((item) => item.id === movedCard.id);
          if (indiceMovido >= 0) {
            listaReindexada.splice(indiceMovido, 1);
          }
          ordemNova = calcularOrdemDeInsercao(listaReindexada, destination.index);
        }

        if (ordemNova === null) {
          throw new Error('Não foi possível calcular a nova posição do card na coluna.');
        }

        const movedCardAtualizado = {
          ...movedCard,
          coluna_id: sourceColunaId,
          ordem: ordemNova,
        };

        queryClient.setQueryData(['cards', quadro?.id], (current = []) =>
          substituirCardNaLista(current, movedCardAtualizado)
        );

        if (cardAberto?.id === movedCard.id) {
          setCardAberto((prev) => (prev ? { ...prev, ...movedCardAtualizado } : prev));
        }

        await base44.entities.CardOperacional.update(movedCard.id, {
          coluna_id: sourceColunaId,
          ordem: ordemNova,
        });

        queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
        queryClient.invalidateQueries({ queryKey: ['cards'] });
        return;
      }

      [movedCard] = sourceCards.splice(source.index, 1);
      if (!movedCard) return;

      let ordemNova = calcularOrdemDeInsercao(destinationCards, destination.index);

      if (ordemNova === null) {
        const reindexadosDestino = await reindexarColunaComEspacos(destinationColunaId, destinationCards);
        ordemNova = calcularOrdemDeInsercao(reindexadosDestino, destination.index);
      }

      if (ordemNova === null) {
        throw new Error('Não foi possível calcular a nova posição do card na coluna de destino.');
      }

      const movedCardAtualizado = {
        ...movedCard,
        coluna_id: destinationColunaId,
        ordem: ordemNova,
        comentarios_count: (movedCard.comentarios_count || 0) + 1,
      };

      queryClient.setQueryData(['cards', quadro?.id], (current = []) =>
        substituirCardNaLista(current, movedCardAtualizado)
      );

      if (cardAberto?.id === movedCard.id) {
        setCardAberto((prev) => (prev ? { ...prev, ...movedCardAtualizado } : prev));
      }

      await base44.entities.CardOperacional.update(movedCard.id, {
        coluna_id: destinationColunaId,
        ordem: ordemNova,
        comentarios_count: movedCardAtualizado.comentarios_count,
      });

      const origem = colunas.find((coluna) => coluna.id === sourceColunaId);
      const destino = colunas.find((coluna) => coluna.id === destinationColunaId);

      await base44.entities.CardComentario.create({
        card_id: movedCard.id,
        mensagem: `Card movido de [${origem?.nome || 'Origem'}] para [${destino?.nome || 'Destino'}]`,
        tipo_registro: 'Sistema',
        data_hora: new Date().toISOString(),
        origem_automatica: true,
        autor_nome: 'Sistema',
      });

      queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card-comentarios', movedCard.id] });
    } catch (error) {
      queryClient.setQueryData(['cards', quadro?.id], previousCards);

      if (cardAberto?.id === movedCard?.id) {
        const cardAnterior = Array.isArray(previousCards)
          ? previousCards.find((item) => item.id === movedCard.id)
          : null;
        if (cardAnterior) {
          setCardAberto(cardAnterior);
        }
      }

      window.alert(error?.message || 'Não foi possível concluir a movimentação do card.');
    } finally {
      setMovendo(false);
    }
  };

  const onDragEndColuna = async ({ source, destination }) => {
    if (!destination || busca.trim() || movendo) return;
    if (source.index === destination.index) return;

    if (!canGerirColunas) {
      window.alert('Ação negada: Sem permissão para reordenar colunas.');
      return;
    }

    const colunasAnteriores = [...colunas];
    const ordemOriginal = new Map(colunas.map((coluna) => [coluna.id, Number(coluna.ordem)]));

    const reordered = [...colunas];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const colunasComNovaOrdem = reordered.map((coluna, index) => ({ ...coluna, ordem: index + 1 }));
    queryClient.setQueryData(['colunas', quadro?.id], colunasComNovaOrdem);

    try {
      const updates = colunasComNovaOrdem
        .filter((coluna) => ordemOriginal.get(coluna.id) !== coluna.ordem)
        .map((coluna) => base44.entities.ColunaOperacional.update(coluna.id, { ordem: coluna.ordem }));

      if (updates.length) {
        await Promise.all(updates);
      }

      queryClient.invalidateQueries({ queryKey: ['colunas', quadro?.id] });
    } catch (error) {
      queryClient.setQueryData(['colunas', quadro?.id], colunasAnteriores);
      window.alert(error?.message || 'Não foi possível reordenar as colunas.');
    }
  };

  const criarColunaManual = async () => {
    if (!canGerirColunas) {
      window.alert('Ação negada: Sem permissão para criar colunas.');
      return;
    }

    const nome = novaColuna.trim();
    if (!nome || !quadro?.id) return;

    const jaExiste = colunas.some(
      (coluna) => (coluna.nome || '').trim().toUpperCase() === nome.toUpperCase()
    );

    if (jaExiste) {
      window.alert('Já existe uma coluna com esse nome.');
      return;
    }

    await base44.entities.ColunaOperacional.create({
      quadro_id: quadro.id,
      nome,
      cor: '#64748b',
      ordem: (colunas.at(-1)?.ordem || colunas.length || 0) + 1,
      ativa: true,
      fixa: false,
      origem_coluna: 'manual',
    });

    setNovaColuna('');
    queryClient.invalidateQueries({ queryKey: ['colunas', quadro?.id] });
  };

  const renomearColunaManual = async (coluna) => {
    if (!canGerirColunas) {
      window.alert('Ação negada: Sem permissão para renomear colunas.');
      return;
    }

    if (coluna.fixa || coluna.origem_coluna === 'automacao') return;

    const novoNome = window.prompt('Novo nome da coluna:', coluna.nome || '');
    if (!novoNome) return;

    const nome = novoNome.trim();
    if (!nome || nome === coluna.nome) return;

    const jaExiste = colunas.some(
      (item) =>
        item.id !== coluna.id &&
        (item.nome || '').trim().toUpperCase() === nome.toUpperCase()
    );

    if (jaExiste) {
      window.alert('Já existe outra coluna com esse nome.');
      return;
    }

    await base44.entities.ColunaOperacional.update(coluna.id, { nome });
    queryClient.invalidateQueries({ queryKey: ['colunas', quadro?.id] });
  };

  const excluirColunaManual = async (coluna) => {
    if (!canGerirColunas) {
      window.alert('Ação negada: Sem permissão para excluir colunas.');
      return;
    }

    const colunaFixa =
      coluna.fixa ||
      coluna.origem_coluna === 'automacao' ||
      (coluna.nome || '').trim().toUpperCase() === 'JISO';

    if (colunaFixa) {
      window.alert('Colunas fixas/automáticas não podem ser excluídas.');
      return;
    }

    const cardsDaColuna = cardsComResumo.filter((card) => card.coluna_id === coluna.id && !card.arquivado);
    if (cardsDaColuna.length > 0) {
      window.alert('Só é permitido excluir coluna manual vazia. Mova ou arquive os cards antes de excluir.');
      return;
    }

    const confirmar = window.confirm(`Excluir a coluna "${coluna.nome}"?`);
    if (!confirmar) return;

    await base44.entities.ColunaOperacional.update(coluna.id, { ativa: false });
    queryClient.invalidateQueries({ queryKey: ['colunas', quadro?.id] });
  };

  const setupInicial = async () => {
    if (!canGerirQuadro) {
      window.alert('Ação negada: Sem permissão para configurar o quadro.');
      return;
    }

    const q = await base44.entities.QuadroOperacional.create({
      nome: QUADRO_NOME,
      descricao: 'Quadro operacional da seção',
      ativo: true,
      ordem: 1,
      cor_tema: '#1e3a5f',
    });

    const colunasPadrao = [
      { nome: 'PENDENTE', cor: '#94a3b8', ordem: 1, fixa: false, origem_coluna: 'manual' },
      { nome: 'ATENÇÃO AO PRAZO', cor: '#f59e0b', ordem: 2, fixa: false, origem_coluna: 'manual' },
      { nome: 'JISO', cor: '#8b5cf6', ordem: 3, fixa: true, origem_coluna: 'automacao' },
      { nome: 'ATESTADOS', cor: '#ef4444', ordem: 4, fixa: false, origem_coluna: 'manual' },
      { nome: 'FÉRIAS', cor: '#10b981', ordem: 5, fixa: false, origem_coluna: 'manual' },
      { nome: 'NOTAS BG', cor: '#3b82f6', ordem: 6, fixa: false, origem_coluna: 'manual' },
      { nome: 'ASSINATURAS', cor: '#f97316', ordem: 7, fixa: false, origem_coluna: 'manual' },
      { nome: 'PROCESSOS E-MS', cor: '#6366f1', ordem: 8, fixa: false, origem_coluna: 'manual' },
      { nome: 'ACESSOS', cor: '#0ea5e9', ordem: 9, fixa: false, origem_coluna: 'manual' },
      { nome: 'COBRANÇAS', cor: '#dc2626', ordem: 10, fixa: false, origem_coluna: 'manual' },
    ];

    await base44.entities.ColunaOperacional.bulkCreate(
      colunasPadrao.map((coluna) => ({ ...coluna, quadro_id: q.id, ativa: true }))
    );

    queryClient.invalidateQueries({ queryKey: ['quadros'] });
    queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Quadro Operacional" />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando quadro...</span>
        </div>
      </div>
    );
  }

  if (!quadro && !loadQ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-14 h-14 bg-[#1e3a5f]/10 rounded-2xl flex items-center justify-center">
          <LayoutDashboard className="w-7 h-7 text-[#1e3a5f]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Quadro Operacional</h2>
          <p className="text-sm text-slate-500 mb-4">Nenhum quadro configurado ainda.</p>
          <Button onClick={setupInicial} disabled={!canGerirQuadro} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white disabled:opacity-50">
            <Plus className="w-4 h-4 mr-2" /> Criar quadro padrão
          </Button>
        </div>
      </div>
    );
  }

  const colunaDoCardAberto = colunas.find((coluna) => coluna.id === cardAberto?.coluna_id);

  return (
    <div className="h-screen flex flex-col bg-[#1e3a5f] overflow-hidden">
      <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">{quadro?.nome || 'Quadro Operacional'}</h1>
            <p className="text-[11px] text-white/50">{colunas.length} colunas · {cardsComResumo.length} cards</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Input
              value={novaColuna}
              onChange={(e) => setNovaColuna(e.target.value)}
              placeholder="Nova coluna manual"
              disabled={!canGerirColunas}
              className="h-8 text-xs w-44 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 disabled:opacity-50"
            />
            <Button onClick={criarColunaManual} disabled={!canGerirColunas} className="h-8 text-xs bg-white text-[#1e3a5f] hover:bg-white/90 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5 mr-1" /> Coluna
            </Button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 h-8 text-xs w-40 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15"
            />
          </div>

          <button
            onClick={invalidateBoardData}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <DragDropContext
        onDragEnd={(result) => {
          if (result.type === 'COLUMN') {
            onDragEndColuna(result);
            return;
          }
          onDragEnd(result);
        }}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <Droppable
            droppableId="board-columns"
            direction="horizontal"
            type="COLUMN"
            isDropDisabled={!!busca.trim() || movendo}
          >
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-3 p-4 h-full items-start">
                {colunas.map((coluna, index) => (
                  <Draggable
                    key={coluna.id}
                    draggableId={`col-${coluna.id}`}
                    index={index}
                    isDragDisabled={!!busca.trim() || movendo || !canGerirColunas}
                  >
                    {(dragProvided) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                        <div {...dragProvided.dragHandleProps}>
                          <ColunaBoard
                            coluna={coluna}
                            cards={cardsPorColuna[coluna.id] || []}
                            onCardClick={setCardAberto}
                            onAddCard={setColunaNovoCard}
                            onRenomearColuna={renomearColunaManual}
                            onExcluirColuna={excluirColunaManual}
                            dragDisabled={!!busca.trim() || movendo || !canMoverCard}
                          />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

      {cardAberto && (
        <CardDetalheModal
          card={cardAberto}
          colunaNome={colunaDoCardAberto?.nome || ''}
          onClose={() => setCardAberto(null)}
          onCardUpdate={(payload) => {
            setCardAberto((prev) => (prev ? { ...prev, ...payload } : prev));
            queryClient.setQueryData(['cards', quadro?.id], (old = []) => (
              Array.isArray(old)
                ? old.map((item) => (item.id === payload.id ? { ...item, ...payload } : item))
                : old
            ));
            queryClient.invalidateQueries({ queryKey: ['cards', quadro?.id] });
          }}
        />
      )}

      {colunaNovoCard && (
        <NovoCardModal
          coluna={colunaNovoCard}
          onSalvar={criarCard}
          onClose={() => setColunaNovoCard(null)}
          salvando={salvandoCard}
        />
      )}
    </div>
  );
}