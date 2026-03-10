import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sincronizarDataJisoCardAtestado } from '@/components/quadro/quadroHelpers';
import { createCardAcao, deleteCardAcao, listCardAcoes, updateCardAcao } from '@/components/quadro/cardAcoesService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, Calendar, User, Tag, MessageSquare, Link2,
  Send, Plus, Check, Trash2, AlertTriangle, Cpu, ArrowRightLeft,
  RefreshCw, Bell, SquareCheckBig, ListTodo,
} from 'lucide-react';

const TIPO_COMENTARIO_CONFIG = {
  Comentário: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', icon: MessageSquare },
  Atualização: { dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  Encaminhamento: { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', icon: ArrowRightLeft },
  Lembrete: { dot: 'bg-purple-400', badge: 'bg-purple-100 text-purple-700', icon: Bell },
  Sistema: { dot: 'bg-slate-200', badge: 'bg-slate-50 text-slate-400 italic', icon: Cpu },
};

const PRIORIDADE_COR = { Urgente: 'text-red-600', Alta: 'text-orange-500', Média: 'text-blue-500', Baixa: 'text-slate-400' };
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const ACOES_STATUS = ['Pendente', 'Em andamento', 'Concluída', 'Cancelada'];
const ACOES_STATUS_ESTILO = {
  Pendente: 'bg-slate-100 text-slate-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  Concluída: 'bg-emerald-100 text-emerald-700',
  Cancelada: 'bg-red-100 text-red-700',
};

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
    titulo: getPrimeiroValor(acao, ['titulo', 'nome', 'title']),
    data_prevista: getPrimeiroValor(acao, ['data_prevista', 'data', 'prazo', 'data_acao']) || null,
    status: getPrimeiroValor(acao, ['status', 'situacao', 'estado']) || 'Pendente',
    observacao: getPrimeiroValor(acao, ['observacao', 'descricao', 'detalhes']),
  };
}

function montarPayloadAcao(payload) {
  const titulo = payload.titulo?.trim();
  const observacao = payload.observacao?.trim() || '';
  const dataPrevista = payload.data_prevista || null;
  const status = payload.status || 'Pendente';

  return {
    ...payload,
    ...(titulo !== undefined ? { titulo, nome: titulo, title: titulo } : {}),
    ...(payload.data_prevista !== undefined ? { data_prevista: dataPrevista, data: dataPrevista, prazo: dataPrevista, data_acao: dataPrevista } : {}),
    ...(payload.status !== undefined ? { status, situacao: status, estado: status } : {}),
    ...(payload.observacao !== undefined ? { observacao, descricao: observacao, detalhes: observacao } : {}),
  };
}

function SectionCard({ title, children, icon: Icon }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function ComentarioItem({ item, isLast }) {
  const cfg = TIPO_COMENTARIO_CONFIG[item.tipo_registro] || TIPO_COMENTARIO_CONFIG.Comentário;
  const Icon = cfg.icon;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cfg.dot} bg-opacity-20 border ${cfg.dot.replace('bg-', 'border-')}`}>
          <Icon className={`w-3 h-3 ${cfg.dot.replace('bg-', 'text-')}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-100 mt-0.5" />}
      </div>
      <div className="pb-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}>{item.tipo_registro}</span>
        </div>
        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{item.mensagem}</p>
        <div className="flex gap-1.5 mt-1">
          <span className="text-[10px] font-medium text-slate-400">{item.autor_nome || 'Sistema'}</span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{formatDateTime(item.data_hora || item.created_date)}</span>
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({ cardId }) {
  const queryClient = useQueryClient();
  const [novoItem, setNovoItem] = useState('');

  const { data: itens = [] } = useQuery({
    queryKey: ['checklist', cardId],
    queryFn: () => base44.entities.CardChecklistItem.filter({ card_id: cardId }, 'ordem', 100),
    enabled: !!cardId,
  });

  const concluidos = itens.filter((item) => item.concluido).length;
  const pct = itens.length ? Math.round((concluidos / itens.length) * 100) : 0;

  const invalidateChecklist = () => {
    queryClient.invalidateQueries({ queryKey: ['checklist', cardId] });
    queryClient.invalidateQueries({ queryKey: ['checklist-board'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
  };

  const toggle = async (item) => {
    await base44.entities.CardChecklistItem.update(item.id, {
      concluido: !item.concluido,
      data_conclusao: !item.concluido ? new Date().toISOString().split('T')[0] : null,
    });
    invalidateChecklist();
  };

  const excluir = async (id) => {
    await base44.entities.CardChecklistItem.delete(id);
    invalidateChecklist();
  };

  const adicionar = async () => {
    if (!novoItem.trim()) return;
    await base44.entities.CardChecklistItem.create({
      card_id: cardId,
      titulo: novoItem.trim(),
      ordem: itens.length + 1,
      concluido: false,
    });
    setNovoItem('');
    invalidateChecklist();
  };

  return (
    <SectionCard title="Checklist" icon={SquareCheckBig}>
      {itens.length > 0 && <span className="text-[10px] text-slate-400">{concluidos}/{itens.length} · {pct}%</span>}

      {itens.length > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-1">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button onClick={() => toggle(item)} className="shrink-0">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${item.concluido ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-slate-400'}`}>
                {item.concluido && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            </button>
            <span className={`text-xs flex-1 ${item.concluido ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.titulo}</span>
            <button onClick={() => excluir(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          placeholder="Novo item..."
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={adicionar}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </SectionCard>
  );
}

function VinculosSection({ cardId }) {
  const { data: vinculos = [] } = useQuery({
    queryKey: ['vinculos', cardId],
    queryFn: () => base44.entities.CardVinculo.filter({ card_id: cardId }),
    enabled: !!cardId,
  });

  const vinculosUnicos = useMemo(() => {
    const mapa = new Map();

    vinculos.forEach((vinculo) => {
      const chave = `${vinculo.card_id || ''}:${vinculo.tipo_vinculo || ''}:${vinculo.referencia_id || ''}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, vinculo);
      }
    });

    return Array.from(mapa.values());
  }, [vinculos]);

  if (vinculosUnicos.length === 0) return null;

  return (
    <SectionCard title="Vínculos" icon={Link2}>
      <div className="space-y-1">
        {vinculosUnicos.map((vinculo) => (
          <div key={vinculo.id} className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
            <span className="text-indigo-500 font-semibold">{vinculo.tipo_vinculo}</span>
            <span className="text-slate-600 truncate">{vinculo.titulo_vinculo}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AcoesSection({ cardId }) {
  const queryClient = useQueryClient();
  const [novaAcao, setNovaAcao] = useState({
    titulo: '',
    data_prevista: '',
    status: 'Pendente',
    observacao: '',
  });
  const [savingId, setSavingId] = useState('');
  const [criando, setCriando] = useState(false);
  const [editingAcao, setEditingAcao] = useState({});

  const { data: acoesRaw = [] } = useQuery({
    queryKey: ['card-acoes', cardId],
    queryFn: () => listCardAcoes(cardId),
    enabled: !!cardId,
  });

  const acoes = useMemo(() => acoesRaw.map(normalizarAcao), [acoesRaw]);

  useEffect(() => {
    setEditingAcao((prev) => {
      const next = {};
      acoes.forEach((acao) => {
        next[acao.id] = prev[acao.id] || {
          data_prevista: acao.data_prevista || '',
          status: acao.status || 'Pendente',
          observacao: acao.observacao || '',
        };
      });
      return next;
    });
  }, [acoes]);

  const invalidateAcoes = () => {
    queryClient.invalidateQueries({ queryKey: ['card-acoes', cardId] });
  };

  const criarAcao = async () => {
    if (!novaAcao.titulo.trim() || criando) return;
    setCriando(true);
    try {
      await createCardAcao(montarPayloadAcao({
        card_id: cardId,
        titulo: novaAcao.titulo,
        data_prevista: novaAcao.data_prevista,
        status: novaAcao.status,
        observacao: novaAcao.observacao,
        concluida: novaAcao.status === 'Concluída',
        ordem: acoes.length + 1,
      }));
      setNovaAcao({ titulo: '', data_prevista: '', status: 'Pendente', observacao: '' });
      invalidateAcoes();
    } finally {
      setCriando(false);
    }
  };

  const atualizarAcao = async (acao) => {
    if (savingId === acao.id) return;
    setSavingId(acao.id);
    try {
      const draft = editingAcao[acao.id] || {};
      await updateCardAcao(acao.id, montarPayloadAcao({
        data_prevista: draft.data_prevista || null,
        status: draft.status || 'Pendente',
        observacao: draft.observacao || '',
        concluida: (draft.status || 'Pendente') === 'Concluída',
      }));
      invalidateAcoes();
    } finally {
      setSavingId('');
    }
  };

  const excluirAcao = async (acaoId) => {
    if (savingId === acaoId) return;
    setSavingId(acaoId);
    try {
      await deleteCardAcao(acaoId);
      invalidateAcoes();
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="rounded-xl border-2 border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
          <ListTodo className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-blue-900 tracking-wide">Ações <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">v2.1</span></h3>
      </div>

      <div className="rounded-xl border border-blue-200 bg-white p-3 space-y-2">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Nova ação</p>
        <Input
          value={novaAcao.titulo}
          onChange={(e) => setNovaAcao((prev) => ({ ...prev, titulo: e.target.value }))}
          placeholder="Título da ação"
          className="h-9 text-sm bg-slate-50 border-slate-200"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={novaAcao.data_prevista}
            onChange={(e) => setNovaAcao((prev) => ({ ...prev, data_prevista: e.target.value }))}
            className="h-9 text-sm bg-slate-50 border-slate-200"
          />
          <Select
            value={novaAcao.status}
            onValueChange={(value) => setNovaAcao((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="h-9 text-sm bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES_STATUS.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={novaAcao.observacao}
          onChange={(e) => setNovaAcao((prev) => ({ ...prev, observacao: e.target.value }))}
          rows={3}
          placeholder="Observação da ação"
          className="text-sm resize-none min-h-20 bg-slate-50 border-slate-200"
        />
        <div className="flex justify-end">
          <Button onClick={criarAcao} size="sm" disabled={criando || !novaAcao.titulo.trim()} className="h-9 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> {criando ? 'Adicionando...' : 'Adicionar ação'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ações cadastradas</p>
        {acoes.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma ação cadastrada.</p>}
        {acoes.map((acao) => (
          <div key={acao.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 leading-tight">{acao.titulo}</p>
              <button
                onClick={() => excluirAcao(acao.id)}
                className="text-slate-300 hover:text-red-400 transition-colors"
                disabled={savingId === acao.id}
                title="Excluir ação"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                {acao.data_prevista ? `Prevista: ${new Date(`${acao.data_prevista}T00:00:00`).toLocaleDateString('pt-BR')}` : 'Sem data'}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${ACOES_STATUS_ESTILO[acao.status] || ACOES_STATUS_ESTILO.Pendente}`}>
                {acao.status || 'Pendente'}
              </span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 leading-relaxed">
              {acao.observacao?.trim() ? acao.observacao : 'Sem observação.'}
            </p>

            <div className="grid grid-cols-1 gap-2">
              <Textarea
                value={editingAcao[acao.id]?.observacao || ''}
                onChange={(e) => setEditingAcao((prev) => ({
                  ...prev,
                  [acao.id]: { ...(prev[acao.id] || {}), observacao: e.target.value },
                }))}
                rows={2}
                className="text-xs resize-none min-h-16 bg-white"
                placeholder="Editar observação"
                disabled={savingId === acao.id}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={editingAcao[acao.id]?.data_prevista || ''}
                onChange={(e) => setEditingAcao((prev) => ({
                  ...prev,
                  [acao.id]: { ...(prev[acao.id] || {}), data_prevista: e.target.value },
                }))}
                className="h-7 text-xs bg-white"
                disabled={savingId === acao.id}
              />
              <Select
                value={editingAcao[acao.id]?.status || 'Pendente'}
                onValueChange={(value) => setEditingAcao((prev) => ({
                  ...prev,
                  [acao.id]: { ...(prev[acao.id] || {}), status: value },
                }))}
                disabled={savingId === acao.id}
              >
                <SelectTrigger className="h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACOES_STATUS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditingAcao((prev) => ({
                  ...prev,
                  [acao.id]: {
                    data_prevista: acao.data_prevista || '',
                    status: acao.status || 'Pendente',
                    observacao: acao.observacao || '',
                  },
                }))}
                disabled={savingId === acao.id}
              >
                Reverter
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => atualizarAcao(acao)}
                disabled={savingId === acao.id}
              >
                {savingId === acao.id ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              {acao.status !== 'Concluída' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  onClick={async () => {
                    if (savingId === acao.id) return;
                    const draft = editingAcao[acao.id] || {};
                    setSavingId(acao.id);
                    try {
                      await updateCardAcao(acao.id, montarPayloadAcao({
                        data_prevista: draft.data_prevista || null,
                        observacao: draft.observacao || '',
                        status: 'Concluída',
                        concluida: true,
                      }));
                      invalidateAcoes();
                    } finally {
                      setSavingId('');
                    }
                  }}
                  disabled={savingId === acao.id}
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Marcar concluída
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CardDetalheModal({ card, colunaNome, onClose, onCardUpdate }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);


  const [jisoDate, setJisoDate] = useState(card.prazo || '');
  const [savingJisoDate, setSavingJisoDate] = useState(false);
  const [classificacao, setClassificacao] = useState({
    prioridade: card.prioridade || 'Média',
    tipo: card.tipo || '',
    etiqueta_texto: card.etiqueta_texto || '',
    etiqueta_cor: card.etiqueta_cor || '#6366f1',
  });
  const [salvandoClassificacao, setSalvandoClassificacao] = useState(false);

  const { data: vinculos = [] } = useQuery({
    queryKey: ['vinculos', card.id],
    queryFn: () => base44.entities.CardVinculo.filter({ card_id: card.id }),
    enabled: !!card.id,
  });

  useEffect(() => {
    setJisoDate(card.prazo || '');
  }, [card.id, card.prazo]);

  useEffect(() => {
    setClassificacao({
      prioridade: card.prioridade || 'Média',
      tipo: card.tipo || '',
      etiqueta_texto: card.etiqueta_texto || '',
      etiqueta_cor: card.etiqueta_cor || '#6366f1',
    });
  }, [card.id, card.prioridade, card.tipo, card.etiqueta_texto, card.etiqueta_cor]);

  const vinculoAtestado = vinculos.find((v) => v.tipo_vinculo === 'Atestado');
  const permiteEditarDataJiso = card.origem_tipo === 'Atestado/JISO' && !!vinculoAtestado?.referencia_id;

  const { data: comentarios = [] } = useQuery({
    queryKey: ['card-comentarios', card.id],
    queryFn: () => base44.entities.CardComentario.filter({ card_id: card.id }, '-data_hora', 100),
    enabled: !!card.id,
  });

  const comentariosOrdenados = useMemo(
    () => [...comentarios].sort((a, b) => new Date(a.data_hora || a.created_date || 0) - new Date(b.data_hora || b.created_date || 0)),
    [comentarios]
  );

  const enviarComentario = async () => {
    if (!mensagem.trim()) return;
    setSalvando(true);
    await base44.entities.CardComentario.create({
      card_id: card.id,
      mensagem: mensagem.trim(),
      tipo_registro: 'Comentário',
      data_hora: new Date().toISOString(),
      origem_automatica: false,
    });
    await base44.entities.CardOperacional.update(card.id, {
      comentarios_count: (card.comentarios_count || 0) + 1,
    });
    setMensagem('');
    queryClient.invalidateQueries({ queryKey: ['card-comentarios', card.id] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    setSalvando(false);
  };


  const salvarDataJiso = async () => {
    if (!permiteEditarDataJiso || savingJisoDate) return;
    setSavingJisoDate(true);
    try {
      await sincronizarDataJisoCardAtestado({
        cardId: card.id,
        atestadoId: vinculoAtestado.referencia_id,
        dataJiso: jisoDate,
      });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['atestado', vinculoAtestado.referencia_id] });
    } finally {
      setSavingJisoDate(false);
    }
  };

  const salvarClassificacao = async () => {
    if (salvandoClassificacao) return;
    setSalvandoClassificacao(true);
    try {
      const payload = {
        prioridade: classificacao.prioridade,
        tipo: classificacao.tipo.trim(),
        etiqueta_texto: classificacao.etiqueta_texto.trim(),
        etiqueta_cor: classificacao.etiqueta_texto.trim() ? (classificacao.etiqueta_cor || '#6366f1') : '',
      };

      await base44.entities.CardOperacional.update(card.id, payload);
      onCardUpdate?.({ id: card.id, ...payload });
    } finally {
      setSalvandoClassificacao(false);
    }
  };

  const prazoFormatado = card.prazo ? new Date(`${card.prazo}T00:00:00`).toLocaleDateString('pt-BR') : null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoAtrasado = card.prazo && new Date(`${card.prazo}T00:00:00`) < hoje;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-[560px] bg-white shadow-2xl flex flex-col overflow-hidden border-l border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {card.etiqueta_texto && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1.5 text-white" style={{ backgroundColor: card.etiqueta_cor || '#6366f1' }}>
                  <Tag className="w-2.5 h-2.5" /> {card.etiqueta_texto}
                </div>
              )}
              <h2 className="text-base font-bold text-slate-800 leading-tight">{card.titulo}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-400">{colunaNome}</span>
                {card.prioridade && <span className={`text-xs font-semibold ${PRIORIDADE_COR[card.prioridade]}`}>· {card.prioridade}</span>}
                {card.origem_tipo && card.origem_tipo !== 'Manual' && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">{card.origem_tipo}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-slate-100/70">
          <SectionCard title="Identificação do card" icon={User}>
            <div className="grid grid-cols-2 gap-3">
            {card.militar_nome_snapshot && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Militar</p>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 truncate">{card.militar_nome_snapshot}</span>
                </div>
              </div>
            )}
            {card.responsavel_nome && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Responsável</p>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 truncate">{card.responsavel_nome}</span>
                </div>
              </div>
            )}
            {prazoFormatado && (
              <div className={`rounded-lg p-3 border ${prazoAtrasado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Prazo</p>
                <div className="flex items-center gap-1.5">
                  {prazoAtrasado && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  <Calendar className={`w-3.5 h-3.5 ${prazoAtrasado ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${prazoAtrasado ? 'text-red-700' : 'text-slate-700'}`}>
                    {prazoFormatado}{prazoAtrasado ? ' — VENCIDO' : ''}
                  </span>
                </div>
              </div>
            )}
            </div>
          </SectionCard>

          {card.descricao && (
            <SectionCard title="Descrição">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">{card.descricao}</p>
            </SectionCard>
          )}

          <SectionCard title="Classificação operacional" icon={Tag}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 block">Prioridade</label>
                <Select
                  value={classificacao.prioridade}
                  onValueChange={(value) => setClassificacao((prev) => ({ ...prev, prioridade: value }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((prioridade) => (
                      <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 block">Tipo</label>
                <Input
                  value={classificacao.tipo}
                  onChange={(e) => setClassificacao((prev) => ({ ...prev, tipo: e.target.value }))}
                  placeholder="Ex: JISO, Atestado..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-wide block">Etiqueta</label>
              <div className="flex gap-2">
                <Input
                  value={classificacao.etiqueta_texto}
                  onChange={(e) => setClassificacao((prev) => ({ ...prev, etiqueta_texto: e.target.value }))}
                  placeholder="Texto da etiqueta"
                  className="h-8 text-xs"
                />
                <Input
                  type="color"
                  value={classificacao.etiqueta_cor || '#6366f1'}
                  onChange={(e) => setClassificacao((prev) => ({ ...prev, etiqueta_cor: e.target.value }))}
                  className="h-8 w-12 p-1"
                  title="Cor da etiqueta"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setClassificacao((prev) => ({ ...prev, etiqueta_texto: '', etiqueta_cor: '#6366f1' }))}
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={salvarClassificacao} disabled={salvandoClassificacao} className="h-8 text-xs">
                {salvandoClassificacao ? 'Salvando...' : 'Salvar classificação'}
              </Button>
            </div>
          </SectionCard>

          {permiteEditarDataJiso && (
            <SectionCard title="Data JISO" icon={Calendar}>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    type="date"
                    value={jisoDate || ''}
                    onChange={(e) => setJisoDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={salvarDataJiso}
                  disabled={savingJisoDate}
                  className="h-8 text-xs"
                >
                  {savingJisoDate ? 'Salvando...' : 'Salvar data'}
                </Button>
              </div>
            </SectionCard>
          )}

          <ChecklistSection cardId={card.id} />
          <AcoesSection cardId={card.id} />
          <VinculosSection cardId={card.id} />

          <SectionCard title="Comentários e atividade" icon={MessageSquare}>
            <div className="space-y-0">
              {comentariosOrdenados.length === 0 && <p className="text-xs text-slate-400 italic text-center py-3">Nenhum registro ainda.</p>}
              {comentariosOrdenados.map((item, idx) => (
                <ComentarioItem key={item.id} item={item} isLast={idx === comentariosOrdenados.length - 1} />
              ))}
            </div>

            <div className="space-y-2 pt-1">
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={2}
                placeholder="Escrever comentário ou anotação... (Ctrl+Enter para enviar)"
                className="text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviarComentario();
                }}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={enviarComentario}
                  disabled={!mensagem.trim() || salvando}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white gap-1.5 text-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Registrar
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
