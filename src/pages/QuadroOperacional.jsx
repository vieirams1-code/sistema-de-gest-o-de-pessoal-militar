import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LayoutDashboard, Plus, Search, RefreshCw } from 'lucide-react';
import ColunaBoard from '@/components/quadro/ColunaBoard';
import CardDetalheModal from '@/components/quadro/CardDetalheModal';
import NovoCardModal from '@/components/quadro/NovoCardModal';
import { buildChecklistResumo, criarChecklistPreset } from '@/components/quadro/quadroHelpers';

const QUADRO_NOME = 'Operacional';

function groupCardsByColuna(cards = [], colunas = []) {
  const mapa = {};
  colunas.forEach((coluna) => { mapa[coluna.id] = []; });
  cards.forEach((card) => {
    if (mapa[card.coluna_id]) mapa[card.coluna_id].push(card);
  });
  Object.values(mapa).forEach((lista) => lista.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
  return mapa;
}

export default function QuadroOperacionalPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [cardAberto, setCardAberto] = useState(null);
  const [colunaNovoCard, setColunaNovoCard] = useState(null);
  const [salvandoCard, setSalvandoCard] = useState(false);
  const [movendo, setMovendo] = useState(false);

  const { data: quadros = [], isLoading: loadQ } = useQuery({
    queryKey: ['quadros'],
    queryFn: () => base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem'),
  });
  const quadro = quadros[0] || null;

  const { data: colunas = [], isLoading: loadC } = useQuery({
    queryKey: ['colunas', quadro?.id],
    queryFn: () => base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem'),
    enabled: !!quadro?.id,
  });

  const { data: cards = [], isLoading: loadCards } = useQuery({
    queryKey: ['cards', quadro?.id],
    queryFn: async () => {
      if (!colunas.length) return [];
      const cardsBrutos = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
      const colunasIds = new Set(colunas.map((coluna) => coluna.id));
      return cardsBrutos.filter((card) => colunasIds.has(card.coluna_id));
    },
    enabled: !!quadro?.id && colunas.length > 0,
  });

  const { data: checklistItens = [] } = useQuery({
    queryKey: ['checklist-board', quadro?.id],
    queryFn: () => base44.entities.CardChecklistItem.list('-created_date', 2000),
    enabled: !!quadro?.id,
  });

  const isLoading = loadQ || loadC || loadCards;

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

  const criarCard = async (form) => {
    setSalvandoCard(true);
    try {
      const cardsDaColuna = cardsComResumo.filter((card) => card.coluna_id === colunaNovoCard.id);
      const novoCard = await base44.entities.CardOperacional.create({
        ...form,
        coluna_id: colunaNovoCard.id,
        ordem: cardsDaColuna.length + 1,
        status: 'Ativo',
        arquivado: false,
        criado_automaticamente: false,
        comentarios_count: 0,
      });

      if (form.preset && form.preset !== 'Nenhum') {
        await criarChecklistPreset(novoCard.id, form.preset);
      }

      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-board'] });
      setColunaNovoCard(null);
    } finally {
      setSalvandoCard(false);
    }
  };

  const onDragEnd = async ({ source, destination }) => {
    if (!destination || busca.trim() || movendo) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColunaId = source.droppableId;
    const destinationColunaId = destination.droppableId;
    const grouped = groupCardsByColuna(cardsComResumo, colunas);

    const sourceCards = [...(grouped[sourceColunaId] || [])];
    const destinationCards = sourceColunaId === destinationColunaId
      ? sourceCards
      : [...(grouped[destinationColunaId] || [])];

    const [movedCard] = sourceCards.splice(source.index, 1);
    destinationCards.splice(destination.index, 0, movedCard);

    if (!movedCard) return;

    const updates = [];

    sourceCards.forEach((card, index) => {
      const ordem = index + 1;
      if (card.ordem !== ordem) updates.push({ id: card.id, payload: { ordem } });
    });

    destinationCards.forEach((card, index) => {
      const ordem = index + 1;
      const mudouColuna = card.id === movedCard.id && destinationColunaId !== sourceColunaId;
      const payload = {};
      if (card.ordem !== ordem) payload.ordem = ordem;
      if (mudouColuna) payload.coluna_id = destinationColunaId;
      if (mudouColuna) payload.comentarios_count = (card.comentarios_count || 0) + 1;
      if (Object.keys(payload).length > 0) updates.push({ id: card.id, payload });
    });

    if (!updates.length) return;

    setMovendo(true);
    try {
      await Promise.all(updates.map((update) => base44.entities.CardOperacional.update(update.id, update.payload)));

      if (destinationColunaId !== sourceColunaId) {
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
      }

      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card-comentarios', movedCard.id] });
    } finally {
      setMovendo(false);
    }
  };

  const setupInicial = async () => {
    const q = await base44.entities.QuadroOperacional.create({
      nome: QUADRO_NOME,
      descricao: 'Quadro operacional da seção',
      ativo: true,
      ordem: 1,
      cor_tema: '#1e3a5f',
    });
    const colunasPadrao = [
      { nome: 'PENDENTE', cor: '#94a3b8', ordem: 1 },
      { nome: 'ATENÇÃO AO PRAZO', cor: '#f59e0b', ordem: 2 },
      { nome: 'JISO', cor: '#8b5cf6', ordem: 3 },
      { nome: 'ATESTADOS', cor: '#ef4444', ordem: 4 },
      { nome: 'FÉRIAS', cor: '#10b981', ordem: 5 },
      { nome: 'NOTAS BG', cor: '#3b82f6', ordem: 6 },
      { nome: 'ASSINATURAS', cor: '#f97316', ordem: 7 },
      { nome: 'PROCESSOS E-MS', cor: '#6366f1', ordem: 8 },
      { nome: 'ACESSOS', cor: '#0ea5e9', ordem: 9 },
      { nome: 'COBRANÇAS', cor: '#dc2626', ordem: 10 },
    ];
    await base44.entities.ColunaOperacional.bulkCreate(
      colunasPadrao.map((coluna) => ({ ...coluna, quadro_id: q.id, ativa: true }))
    );
    queryClient.invalidateQueries({ queryKey: ['quadros'] });
    queryClient.invalidateQueries({ queryKey: ['colunas'] });
  };

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
          <Button onClick={setupInicial} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
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
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['cards'] });
              queryClient.invalidateQueries({ queryKey: ['colunas'] });
              queryClient.invalidateQueries({ queryKey: ['checklist-board'] });
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full items-start">
            {colunas.map((coluna) => (
              <ColunaBoard
                key={coluna.id}
                coluna={coluna}
                cards={cardsPorColuna[coluna.id] || []}
                onCardClick={setCardAberto}
                onAddCard={setColunaNovoCard}
                dragDisabled={!!busca.trim() || movendo}
              />
            ))}
          </div>
        </div>
      </DragDropContext>

      {cardAberto && (
        <CardDetalheModal
          card={cardAberto}
          colunaNome={colunaDoCardAberto?.nome || ''}
          onClose={() => setCardAberto(null)}
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
