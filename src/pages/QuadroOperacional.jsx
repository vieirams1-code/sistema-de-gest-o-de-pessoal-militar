import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LayoutDashboard, Plus, Search, RefreshCw } from 'lucide-react';
import ColunaBoard from '@/components/quadro/ColunaBoard';
import CardDetalheModal from '@/components/quadro/CardDetalheModal';
import NovoCardModal from '@/components/quadro/NovoCardModal';

const QUADRO_NOME = 'Operacional';

export default function QuadroOperacionalPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [cardAberto, setCardAberto] = useState(null);
  const [colunaNovoCard, setColunaNovoCard] = useState(null);
  const [salvandoCard, setSalvandoCard] = useState(false);

  // Busca quadro, colunas e cards
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
      return base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
    },
    enabled: !!quadro?.id && colunas.length > 0,
  });

  const isLoading = loadQ || loadC || loadCards;

  // Filtro por busca
  const cardsFiltrados = useMemo(() => {
    if (!busca.trim()) return cards;
    const q = busca.toLowerCase();
    return cards.filter(c =>
      c.titulo?.toLowerCase().includes(q) ||
      c.militar_nome_snapshot?.toLowerCase().includes(q) ||
      c.protocolo?.toLowerCase().includes(q)
    );
  }, [cards, busca]);

  // Agrupa cards por coluna
  const cardsPorColuna = useMemo(() => {
    const mapa = {};
    colunas.forEach(col => { mapa[col.id] = []; });
    cardsFiltrados.forEach(card => {
      if (mapa[card.coluna_id]) mapa[card.coluna_id].push(card);
    });
    return mapa;
  }, [cardsFiltrados, colunas]);

  const criarCard = async (form) => {
    setSalvandoCard(true);
    await base44.entities.CardOperacional.create({
      ...form,
      coluna_id: colunaNovoCard.id,
      status: 'Ativo',
      arquivado: false,
      criado_automaticamente: false,
      comentarios_count: 0,
    });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    setColunaNovoCard(null);
    setSalvandoCard(false);
  };

  // Setup inicial: cria quadro e colunas padrão se não existir
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
      colunasPadrao.map(c => ({ ...c, quadro_id: q.id, ativa: true }))
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

  const colunaDoCardAberto = colunas.find(c => c.id === cardAberto?.coluna_id);

  return (
    <div className="h-screen flex flex-col bg-[#1e3a5f] overflow-hidden">
      {/* Header do quadro */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">{quadro?.nome || 'Quadro Operacional'}</h1>
            <p className="text-[11px] text-white/50">{colunas.length} colunas · {cards.length} cards</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 h-8 text-xs w-40 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15"
            />
          </div>
          <button
            onClick={() => { queryClient.invalidateQueries({ queryKey: ['cards'] }); queryClient.invalidateQueries({ queryKey: ['colunas'] }); }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Colunas horizontais */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full items-start">
          {colunas.map(coluna => (
            <ColunaBoard
              key={coluna.id}
              coluna={coluna}
              cards={cardsPorColuna[coluna.id] || []}
              onCardClick={setCardAberto}
              onAddCard={setColunaNovoCard}
            />
          ))}

          {/* Botão nova coluna (futuro) */}
          <div className="w-[220px] shrink-0 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center h-16 hover:border-white/30 transition-colors cursor-default">
            <span className="text-xs text-white/30 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nova coluna
            </span>
          </div>
        </div>
      </div>

      {/* Modal detalhe do card */}
      {cardAberto && (
        <CardDetalheModal
          card={cardAberto}
          colunaNome={colunaDoCardAberto?.nome || ''}
          onClose={() => setCardAberto(null)}
        />
      )}

      {/* Modal novo card */}
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