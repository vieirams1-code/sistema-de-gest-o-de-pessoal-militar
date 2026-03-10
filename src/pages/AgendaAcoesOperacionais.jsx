import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock3, AlertTriangle, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { listAllCardAcoes } from '@/components/quadro/cardAcoesService';
import { Button } from '@/components/ui/button';

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

function isConcluida(status) {
  const normalizado = (status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado'].includes(normalizado);
}

function GrupoAcoes({ titulo, descricao, icon: Icon, acoes }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          <span className="text-xs text-slate-400">({acoes.length})</span>
        </div>
        <span className="text-[11px] text-slate-400">{descricao}</span>
      </div>

      {acoes.length === 0 ? (
        <p className="px-4 py-5 text-xs text-slate-400">Nenhuma ação neste grupo.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {acoes.map((acao) => (
            <div key={acao.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{acao.titulo}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Prazo: {formatarData(acao.data_prevista)}</span>
                  <span>Card: {acao.card_titulo}</span>
                  <span>Status: {acao.status}</span>
                  {acao.responsavel && <span>Resp.: {acao.responsavel}</span>}
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="h-8 shrink-0">
                <Link to={`/QuadroOperacional?cardId=${acao.card_id}`}>
                  Abrir card
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AgendaAcoesOperacionaisPage() {
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

  const { atrasadas, hoje, proximas } = useMemo(() => {
    const mapaCards = new Map(cards.map((card) => [card.id, card]));
    const hojeKey = toDateKey(new Date());

    const agrupadas = { atrasadas: [], hoje: [], proximas: [] };

    acoesRaw
      .map(normalizarAcao)
      .filter((acao) => !isConcluida(acao.status))
      .forEach((acao) => {
        const card = mapaCards.get(acao.card_id);
        if (!card) return;

        const dataKey = toDateKey(acao.data_prevista);
        const acaoComCard = {
          ...acao,
          card_titulo: card.titulo || card.militar_nome_snapshot || 'Card sem título',
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

    agrupadas.atrasadas.sort(ordenar);
    agrupadas.hoje.sort(ordenar);
    agrupadas.proximas.sort(ordenar);

    return agrupadas;
  }, [acoesRaw, cards]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-4">
      <header className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-indigo-600">Agenda de Ações v1.0</p>
        <div className="mt-1 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-500" />
          <h1 className="text-lg font-bold text-slate-800">Ações Operacionais</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Visão consolidada de ações abertas do Quadro Operacional.</p>
      </header>

      <GrupoAcoes titulo="Atrasadas" descricao="Prazo menor que hoje" icon={AlertTriangle} acoes={atrasadas} />
      <GrupoAcoes titulo="Hoje" descricao="Prazo do dia" icon={Clock3} acoes={hoje} />
      <GrupoAcoes titulo="Próximas" descricao="Sem prazo vencido" icon={CalendarClock} acoes={proximas} />
    </div>
  );
}
