import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  sincronizarDataJisoCardAtestado,
  obterVinculoAtestado,
  avaliarFluxoJiso,
} from '@/components/quadro/quadroHelpers';
import { createCardAcao, deleteCardAcao, listCardAcoes, updateCardAcao } from '@/components/quadro/cardAcoesService';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  formatarDataBR,
  isConcluidaAcao,
  montarPayloadAcao,
  normalizarAcao,
  toDateKey,
} from '@/components/quadro/cardAcoesUtils';
import {
  X,
  Calendar,
  User,
  Tag,
  MessageSquare,
  Link2,
  Send,
  Plus,
  Check,
  Trash2,
  AlertTriangle,
  SquareCheckBig,
  ListTodo,
  Pencil,
  ChevronDown,
  ChevronUp,
  Loader2,
  History,
} from 'lucide-react';
import JisoHistoricoModal from '@/components/atestado/JisoHistoricoModal';
import {
  getStatusDocumentalAtaJiso,
  invalidateFluxoAtaJisoQueries,
} from '@/components/atestado/atestadoPublicacaoHelpers';

const PRIORIDADE_COR = {
  Urgente: 'text-red-600',
  Alta: 'text-orange-500',
  Média: 'text-blue-500',
  Baixa: 'text-slate-400',
};

const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];

const ACOES_STATUS = ['Pendente', 'Em andamento', 'Concluída', 'Cancelada'];

const ACOES_STATUS_ESTILO = {
  Pendente: 'bg-slate-100 text-slate-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  Concluída: 'bg-emerald-100 text-emerald-700',
  Cancelada: 'bg-red-100 text-red-700',
};

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
  return `${d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function AcaoDatePicker({ value, onChange, disabled, placeholder = 'Selecionar data' }) {
  const dataKey = toDateKey(value);
  const dataSelecionada = dataKey ? parseISO(`${dataKey}T00:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-start bg-white border-slate-200 text-[11px] font-normal"
          disabled={disabled}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
          {dataSelecionada ? (
            format(dataSelecionada, 'dd/MM/yyyy', { locale: ptBR })
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={dataSelecionada}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          initialFocus
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

function MensagemComentario({ item, currentUserEmail }) {
  const autorEmail = (item.autor_email || '').toLowerCase();
  const createdBy = (item.created_by || '').toLowerCase();
  const meEmail = (currentUserEmail || '').toLowerCase();
  const isMine = meEmail && (
    (autorEmail && autorEmail === meEmail) ||
    (createdBy && createdBy === meEmail)
  );

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
          isMine
            ? 'bg-[#1e3a5f] text-white rounded-br-md'
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
        }`}
      >
        {!isMine && (
          <p className={`text-[10px] font-bold mb-0.5 ${
            isMine ? 'text-blue-200' : 'text-indigo-600'
          }`}>
            {item.autor_nome || 'Usuário'}
          </p>
        )}
        <p className="text-xs leading-relaxed whitespace-pre-wrap">{item.mensagem}</p>
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            isMine ? 'text-blue-200 justify-end' : 'text-slate-400'
          }`}
        >
          {isMine && <span className="font-semibold">Você</span>}
          {isMine && <span>·</span>}
          <span>{formatDateTime(item.data_hora || item.created_date)}</span>
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({ cardId }) {
  const queryClient = useQueryClient();
  const [novoItem, setNovoItem] = useState('');
  const { canAccessAction } = useCurrentUser();
  const canManage = canAccessAction('gerir_acoes_operacionais');

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
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir checklist.');
      return;
    }
    await base44.entities.CardChecklistItem.update(item.id, {
      concluido: !item.concluido,
      data_conclusao: !item.concluido ? new Date().toISOString().split('T')[0] : null,
    });
    invalidateChecklist();
  };

  const excluir = async (id) => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir checklist.');
      return;
    }
    await base44.entities.CardChecklistItem.delete(id);
    invalidateChecklist();
  };

  const adicionar = async () => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir checklist.');
      return;
    }
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
      {itens.length > 0 && (
        <span className="text-[10px] text-slate-400">
          {concluidos}/{itens.length} · {pct}%
        </span>
      )}

      {itens.length > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-1">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button onClick={() => toggle(item)} className="shrink-0">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  item.concluido
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {item.concluido && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            </button>

            <span
              className={`text-xs flex-1 ${
                item.concluido ? 'line-through text-slate-400' : 'text-slate-700'
              }`}
            >
              {item.titulo}
            </span>

            <button
              onClick={() => excluir(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400"
            >
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
      if (!mapa.has(chave)) mapa.set(chave, vinculo);
    });

    return Array.from(mapa.values());
  }, [vinculos]);

  if (vinculosUnicos.length === 0) return null;

  return (
    <SectionCard title="Vínculos" icon={Link2}>
      <div className="space-y-1">
        {vinculosUnicos.map((vinculo) => (
          <div
            key={vinculo.id}
            className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5"
          >
            <span className="text-indigo-500 font-semibold">{vinculo.tipo_vinculo}</span>
            <span className="text-slate-600 truncate">{vinculo.titulo_vinculo}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function atualizarAcaoNoCache(lista, acaoId, payloadAtualizado) {
  if (!Array.isArray(lista)) return lista;
  return lista.map((item) => (item.id === acaoId ? { ...item, ...payloadAtualizado } : item));
}

function AcoesSection({ cardId }) {
  const queryClient = useQueryClient();
  const [novaAcao, setNovaAcao] = useState({ titulo: '', data_prevista: '' });
  const [savingId, setSavingId] = useState('');
  const [criando, setCriando] = useState(false);
  const [editingAcao, setEditingAcao] = useState({});
  const [expandedEdicao, setExpandedEdicao] = useState({});
  const { canAccessAction } = useCurrentUser();
  const canManage = canAccessAction('gerir_acoes_operacionais');

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
          titulo: acao.titulo || '',
          data_prevista: acao.data_prevista || '',
          status: acao.status || 'Pendente',
        };
      });
      return next;
    });
  }, [acoes]);

  const invalidateAcoes = () => {
    queryClient.invalidateQueries({ queryKey: ['card-acoes', cardId] });
    queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
    queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
  };

  const criarAcao = async () => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir ações operacionais.');
      return;
    }
    if (!novaAcao.titulo.trim() || criando) return;

    setCriando(true);
    try {
      await createCardAcao(
        montarPayloadAcao({
          card_id: cardId,
          titulo: novaAcao.titulo,
          data_prevista: novaAcao.data_prevista || null,
          status: 'Pendente',
          concluida: false,
          ordem: acoes.length + 1,
        })
      );

      setNovaAcao({ titulo: '', data_prevista: '' });
      invalidateAcoes();
    } finally {
      setCriando(false);
    }
  };

  const atualizarAcao = async (acao, patch = null) => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir ações operacionais.');
      return;
    }
    if (savingId === acao.id) return;

    setSavingId(acao.id);
    try {
      const baseDraft = editingAcao[acao.id] || {};
      const draft = { ...baseDraft, ...(patch || {}) };
      const status = draft.status || 'Pendente';

      const payloadAtualizado = montarPayloadAcao({
        titulo: draft.titulo || acao.titulo,
        data_prevista: draft.data_prevista || null,
        status,
        concluida: status === 'Concluída',
      });

      await updateCardAcao(acao.id, payloadAtualizado);

      queryClient.setQueryData(['card-acoes', cardId], (antigo) =>
        atualizarAcaoNoCache(antigo, acao.id, payloadAtualizado)
      );
      queryClient.setQueryData(['acoes-consolidadas-quadro'], (antigo) =>
        atualizarAcaoNoCache(antigo, acao.id, payloadAtualizado)
      );
      queryClient.setQueriesData({ queryKey: ['card-acoes'] }, (antigo) =>
        atualizarAcaoNoCache(antigo, acao.id, payloadAtualizado)
      );

      setEditingAcao((prev) => ({
        ...prev,
        [acao.id]: { ...(prev[acao.id] || {}), ...draft, status },
      }));

      invalidateAcoes();
    } finally {
      setSavingId('');
    }
  };

  const toggleConclusao = async (acao) => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir ações operacionais.');
      return;
    }
    const draft = editingAcao[acao.id] || {};
    const proximoStatus = isConcluidaAcao({ ...acao, ...draft }) ? 'Pendente' : 'Concluída';
    await atualizarAcao(acao, { status: proximoStatus });
  };

  const excluirAcao = async (acaoId) => {
    if (!canManage) {
      window.alert('Ação negada: Sem permissão para gerir ações operacionais.');
      return;
    }
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
    <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
          <ListTodo className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">Ações</h3>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
          <Input
            value={novaAcao.titulo}
            onChange={(e) => setNovaAcao((prev) => ({ ...prev, titulo: e.target.value }))}
            placeholder="Nova ação"
            className="h-8 text-xs bg-white border-slate-200"
          />

          <AcaoDatePicker
            value={novaAcao.data_prevista}
            onChange={(value) => setNovaAcao((prev) => ({ ...prev, data_prevista: value }))}
            disabled={criando}
            placeholder="Data"
          />

          <Button
            onClick={criarAcao}
            size="sm"
            disabled={criando || !novaAcao.titulo.trim()}
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            {criando ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {acoes.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma ação cadastrada.</p>
        )}

        {acoes.map((acao) => {
          const draft = editingAcao[acao.id] || {};
          const concluida = isConcluidaAcao({ ...acao, ...draft });

          return (
            <div
              key={acao.id}
              className={`rounded-lg border p-2.5 space-y-2 ${
                concluida ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-xs font-semibold leading-snug ${
                    concluida ? 'line-through text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {draft.titulo || acao.titulo}
                </p>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    concluida
                      ? ACOES_STATUS_ESTILO.Concluída
                      : (ACOES_STATUS_ESTILO[draft.status] || ACOES_STATUS_ESTILO.Pendente)
                  }`}
                >
                  {concluida ? 'Concluída' : (draft.status || 'Pendente')}
                </span>
              </div>

              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium">
                <Calendar className="w-3 h-3" />
                {formatarDataBR(draft.data_prevista)}
              </div>

              <div className="flex items-center flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] px-2"
                  onClick={() => setExpandedEdicao((prev) => ({ ...prev, [acao.id]: !prev[acao.id] }))}
                  disabled={savingId === acao.id}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  {expandedEdicao[acao.id] ? 'Fechar edição' : 'Editar'}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] px-2 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  onClick={() => excluirAcao(acao.id)}
                  disabled={savingId === acao.id}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  className={`h-7 text-[11px] px-2 ${
                    concluida
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                  onClick={() => toggleConclusao(acao)}
                  disabled={savingId === acao.id}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {concluida ? 'Desmarcar concluída' : 'Marcar concluída'}
                </Button>
              </div>

              {expandedEdicao[acao.id] && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                  <Input
                    value={draft.titulo || ''}
                    onChange={(e) =>
                      setEditingAcao((prev) => ({
                        ...prev,
                        [acao.id]: { ...(prev[acao.id] || {}), titulo: e.target.value },
                      }))
                    }
                    className="h-7 text-[11px] bg-white"
                    placeholder="Título"
                    disabled={savingId === acao.id}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <AcaoDatePicker
                      value={draft.data_prevista || ''}
                      onChange={(value) =>
                        setEditingAcao((prev) => ({
                          ...prev,
                          [acao.id]: { ...(prev[acao.id] || {}), data_prevista: value },
                        }))
                      }
                      disabled={savingId === acao.id}
                    />

                    <Select
                      value={draft.status || 'Pendente'}
                      onValueChange={(value) =>
                        setEditingAcao((prev) => ({
                          ...prev,
                          [acao.id]: { ...(prev[acao.id] || {}), status: value },
                        }))
                      }
                      disabled={savingId === acao.id}
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACOES_STATUS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={async () => {
                        await atualizarAcao(acao);
                        setExpandedEdicao((prev) => ({ ...prev, [acao.id]: false }));
                      }}
                      disabled={savingId === acao.id}
                    >
                      {savingId === acao.id ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function CardDetalheModal({ card, colunaNome, onClose, onCardUpdate }) {
  const queryClient = useQueryClient();
  const { userEmail, user, canAccessAction } = useCurrentUser();
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [showSystemActivity, setShowSystemActivity] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [showJisoHistoricoModal, setShowJisoHistoricoModal] = useState(false);

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

  const vinculoAtestado = useMemo(() => obterVinculoAtestado(vinculos), [vinculos]);
  const permiteEditarDataJiso = !!vinculoAtestado?.referencia_id;

  const { data: atestadoVinculado } = useQuery({
    queryKey: ['atestado', vinculoAtestado?.referencia_id],
    queryFn: () => base44.entities.Atestado.get(vinculoAtestado.referencia_id),
    enabled: !!vinculoAtestado?.referencia_id,
  });

  const { data: publicacoesAtestado = [] } = useQuery({
    queryKey: ['publicacoes-atestado', vinculoAtestado?.referencia_id],
    queryFn: () => base44.entities.PublicacaoExOfficio.filter({ militar_id: atestadoVinculado?.militar_id }),
    enabled: !!vinculoAtestado?.referencia_id && !!atestadoVinculado?.militar_id,
    select: (data) => data.filter((publicacao) =>
      (publicacao.atestados_jiso_ids || []).includes(vinculoAtestado?.referencia_id)
    ),
  });

  const fluxoJiso = avaliarFluxoJiso({ card, atestadoVinculado, vinculoAtestado });
  const podeRegistrarDecisaoJiso = fluxoJiso.isCardJisoElegivel;
  const decisaoJisoRegistrada = fluxoJiso.decisaoJisoRegistrada;
  const statusDocumentalAtaJiso = getStatusDocumentalAtaJiso(atestadoVinculado || {}, publicacoesAtestado);
  const ataJisoAtiva = statusDocumentalAtaJiso.bloqueiaNovaPublicacao;

  const { data: comentarios = [] } = useQuery({
    queryKey: ['card-comentarios', card.id],
    queryFn: () => base44.entities.CardComentario.filter({ card_id: card.id }, '-data_hora', 100),
    enabled: !!card.id,
  });

  const { comentariosHumanos, comentariosSistema } = useMemo(() => {
    const ordenados = [...comentarios].sort(
      (a, b) => new Date(a.data_hora || a.created_date || 0) - new Date(b.data_hora || b.created_date || 0)
    );

    const humanos = [];
    const sistema = [];

    ordenados.forEach((item) => {
      const ehSistema = item.origem_automatica || item.tipo_registro === 'Sistema';
      if (ehSistema) sistema.push(item);
      else humanos.push(item);
    });

    return { comentariosHumanos: humanos, comentariosSistema: sistema };
  }, [comentarios]);

  const enviarComentario = async () => {
    if (!mensagem.trim()) return;
    // INTENCIONAL: comentários são liberados para qualquer usuário com acesso ao módulo
    // quadro_operacional — não exigem action key específica. Isso é equivalente a uma
    // conversa aberta entre os membros do quadro. Se necessário restringir no futuro,
    // usar canAccessAction('gerir_acoes_operacionais').

    setSalvando(true);
    try {
      await base44.entities.CardComentario.create({
        card_id: card.id,
        mensagem: mensagem.trim(),
        tipo_registro: 'Comentário',
        data_hora: new Date().toISOString(),
        origem_automatica: false,
        autor_nome: user?.full_name || userEmail || 'Usuário',
        autor_email: userEmail || '',
      });

      const novoComentariosCount = (card.comentarios_count || 0) + 1;

      await base44.entities.CardOperacional.update(card.id, {
        comentarios_count: novoComentariosCount,
      });

      onCardUpdate?.({
        id: card.id,
        comentarios_count: novoComentariosCount,
      });

      setMensagem('');
      queryClient.invalidateQueries({ queryKey: ['card-comentarios', card.id] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    } finally {
      setSalvando(false);
    }
  };

  const salvarDataJiso = async () => {
    if (!permiteEditarDataJiso || savingJisoDate) return;
    // Revalidação explícita: editar data JISO exige permissão de gerir JISO
    if (!canAccessAction('gerir_jiso') && !canAccessAction('registrar_decisao_jiso')) {
      alert('Ação negada: você não tem permissão para editar a data da JISO.');
      return;
    }

    setSavingJisoDate(true);
    try {
      await sincronizarDataJisoCardAtestado({
        cardId: card.id,
        atestadoId: vinculoAtestado.referencia_id,
        dataJiso: jisoDate,
      });

      onCardUpdate?.({
        id: card.id,
        prazo: jisoDate || null,
      });

      invalidateFluxoAtaJisoQueries(queryClient, {
        atestadoId: vinculoAtestado.referencia_id,
        militarId: atestadoVinculado?.militar_id,
      });
    } finally {
      setSavingJisoDate(false);
    }
  };

  const salvarClassificacao = async () => {
    if (salvandoClassificacao) return;
    if (!canAccessAction('gerir_acoes_operacionais')) {
      alert('Ação negada: você não tem permissão para editar classificação de cards.');
      return;
    }

    setSalvandoClassificacao(true);
    try {
      const etiquetaTexto = classificacao.etiqueta_texto.trim();
      const payload = {
        prioridade: classificacao.prioridade,
        tipo: classificacao.tipo.trim(),
        etiqueta_texto: etiquetaTexto,
        etiqueta_cor: etiquetaTexto ? (classificacao.etiqueta_cor || '#6366f1') : '',
      };

      await base44.entities.CardOperacional.update(card.id, payload);
      onCardUpdate?.({ id: card.id, ...payload });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    } finally {
      setSalvandoClassificacao(false);
    }
  };

  const excluirCard = async () => {
    if (deletingCard) return;
    if (!canAccessAction('arquivar_card')) {
      alert('Ação negada: você não tem permissão para arquivar cards.');
      return;
    }

    const confirmar = window.confirm(
      `Arquivar o card "${card.titulo}"?\n\n` +
        `Ele deixará de aparecer no quadro, mas o histórico permanecerá salvo.`
    );

    if (!confirmar) return;

    setDeletingCard(true);
    try {
      await base44.entities.CardOperacional.update(card.id, {
        arquivado: true,
        status: 'Arquivado',
      });

      onCardUpdate?.({
        id: card.id,
        arquivado: true,
        status: 'Arquivado',
      });

      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card-acoes'] });
      queryClient.invalidateQueries({ queryKey: ['acoes-consolidadas-quadro'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-board'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', card.id] });
      queryClient.invalidateQueries({ queryKey: ['card-comentarios', card.id] });
      queryClient.invalidateQueries({ queryKey: ['vinculos', card.id] });

      onClose?.();
    } finally {
      setDeletingCard(false);
    }
  };

  const prazoFormatado = card.prazo ? formatarDataBR(card.prazo) : null;
  const origemExcluida = card.origem_status === 'Excluída' || card.status === 'Origem Excluída';
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
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1.5 text-white"
                  style={{ backgroundColor: card.etiqueta_cor || '#6366f1' }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {card.etiqueta_texto}
                </div>
              )}

              <h2 className="text-base font-bold text-slate-800 leading-tight">{card.titulo}</h2>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-400">{colunaNome}</span>

                {card.prioridade && (
                  <span className={`text-xs font-semibold ${PRIORIDADE_COR[card.prioridade]}`}>
                    · {card.prioridade}
                  </span>
                )}

                {card.origem_tipo && card.origem_tipo !== 'Manual' && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
                    {card.origem_tipo}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                onClick={excluirCard}
                disabled={deletingCard}
              >
                {deletingCard ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                )}
                Excluir card
              </Button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-slate-100/70">
          {origemExcluida && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-semibold text-rose-700">Origem Excluída</p>
              <p className="text-xs text-rose-600 mt-1">
                Este card foi mantido para rastreabilidade após a exclusão do atestado de origem.
              </p>
            </div>
          )}

          <SectionCard title="Identificação do card" icon={User}>
            <div className="grid grid-cols-2 gap-3">
              {card.militar_nome_snapshot && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Militar</p>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {card.militar_nome_snapshot}
                    </span>
                  </div>
                </div>
              )}

              {card.responsavel_nome && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Responsável</p>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {card.responsavel_nome}
                    </span>
                  </div>
                </div>
              )}

              {prazoFormatado && (
                <div
                  className={`rounded-lg p-3 border ${
                    prazoAtrasado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Prazo</p>
                  <div className="flex items-center gap-1.5">
                    {prazoAtrasado && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    <Calendar
                      className={`w-3.5 h-3.5 ${prazoAtrasado ? 'text-red-500' : 'text-slate-400'}`}
                    />
                    <span className={`text-xs font-medium ${prazoAtrasado ? 'text-red-700' : 'text-slate-700'}`}>
                      {prazoFormatado}
                      {prazoAtrasado ? ' — VENCIDO' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {card.descricao && (
            <SectionCard title="Descrição">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
                {card.descricao}
              </p>
            </SectionCard>
          )}

          <SectionCard title="Classificação operacional" icon={Tag}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 block">
                  Prioridade
                </label>
                <Select
                  value={classificacao.prioridade}
                  onValueChange={(value) => setClassificacao((prev) => ({ ...prev, prioridade: value }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((prioridade) => (
                      <SelectItem key={prioridade} value={prioridade}>
                        {prioridade}
                      </SelectItem>
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
                  onChange={(e) =>
                    setClassificacao((prev) => ({ ...prev, etiqueta_texto: e.target.value }))
                  }
                  placeholder="Texto da etiqueta"
                  className="h-8 text-xs"
                />
                <Input
                  type="color"
                  value={classificacao.etiqueta_cor || '#6366f1'}
                  onChange={(e) =>
                    setClassificacao((prev) => ({ ...prev, etiqueta_cor: e.target.value }))
                  }
                  className="h-8 w-12 p-1"
                  title="Cor da etiqueta"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setClassificacao((prev) => ({
                      ...prev,
                      etiqueta_texto: '',
                      etiqueta_cor: '#6366f1',
                    }))
                  }
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={salvarClassificacao}
                disabled={salvandoClassificacao}
                className="h-8 text-xs"
              >
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

          {podeRegistrarDecisaoJiso && (
            <SectionCard title="Decisão da JISO" icon={History}>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {decisaoJisoRegistrada
                    ? 'Decisão da JISO registrada.'
                    : 'Há decisão da JISO pendente para este atestado.'}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-lg border-purple-200 bg-purple-50/40 text-xs text-purple-700 hover:bg-purple-100"
                  onClick={() => setShowJisoHistoricoModal(true)}
                >
                  <History className="w-3.5 h-3.5 mr-1.5" />
                  {decisaoJisoRegistrada ? 'Visualizar/editar decisão da JISO' : 'Registrar decisão da JISO'}
                </Button>
              </div>
            </SectionCard>
          )}

          {podeRegistrarDecisaoJiso && (
            <SectionCard title="Ata JISO" icon={Tag}>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">{statusDocumentalAtaJiso.texto}</p>
                {statusDocumentalAtaJiso.publicacao?.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => window.open(`${createPageUrl('CadastrarPublicacao')}?id=${statusDocumentalAtaJiso.publicacao.id}`, '_blank')}
                  >
                    Ver publicação
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-8 text-xs bg-indigo-700 hover:bg-indigo-800"
                  disabled={ataJisoAtiva}
                  title={ataJisoAtiva ? 'Já existe uma nota/publicação ativa para esta Ata JISO.' : ''}
                  onClick={() => window.open(`${createPageUrl('CadastrarPublicacao')}?tipo=${encodeURIComponent('Ata JISO')}&militar_id=${atestadoVinculado?.militar_id || ''}`, '_blank')}
                >
                  {ataJisoAtiva ? 'Já existe uma nota/publicação ativa para esta Ata JISO.' : 'Publicar ata JISO'}
                </Button>
              </div>
            </SectionCard>
          )}

          <ChecklistSection cardId={card.id} />
          <AcoesSection cardId={card.id} />
          <VinculosSection cardId={card.id} />

          <SectionCard title="Comentários v3.0" icon={MessageSquare}>
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <p className="text-xs font-semibold text-slate-700">Conversa entre usuários</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-semibold">
                Comentários v3.0
              </span>
            </div>

            <div className="space-y-2 pt-2">
              {comentariosHumanos.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-3">
                  Nenhuma mensagem humana ainda.
                </p>
              )}

              {comentariosHumanos.map((item) => (
                <MensagemComentario key={item.id} item={item} currentUserEmail={userEmail} />
              ))}
            </div>

            {comentariosSistema.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 mt-2">
                <button
                  type="button"
                  className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-600"
                  onClick={() => setShowSystemActivity((prev) => !prev)}
                >
                  Atividades do sistema ({comentariosSistema.length})
                  {showSystemActivity ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSystemActivity && (
                  <div className="px-3 pb-2 space-y-1.5">
                    {comentariosSistema.map((item) => (
                      <p key={item.id} className="text-[11px] text-slate-500">
                        {item.mensagem} · {formatDateTime(item.data_hora || item.created_date)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 pt-1 border-t border-slate-100 mt-2">
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                placeholder="Escreva uma mensagem..."
                className="text-sm resize-none rounded-xl border-slate-200"
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
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        {podeRegistrarDecisaoJiso && showJisoHistoricoModal && (
          <JisoHistoricoModal
            atestado={atestadoVinculado}
            open={showJisoHistoricoModal}
            onClose={() => setShowJisoHistoricoModal(false)}
          />
        )}
      </div>
    </div>
  );
}