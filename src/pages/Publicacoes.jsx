import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Search, Plus, Clock, CheckCircle, AlertCircle, ShieldAlert, BookOpenText , Sparkles, LayoutGrid, Inbox } from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';
import FamiliaPublicacaoPanel from '@/components/publicacao/FamiliaPublicacaoPanel';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import {
  atualizarEstadoAtestadoPelasPublicacoes,
  calcStatusPublicacao,
  getAtestadoIdsVinculados,
  reverterAtestadosPorExclusaoPublicacao,
} from '@/components/atestado/atestadoPublicacaoHelpers';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import { reconciliarCadeiaFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';
import { RP_TIPO_LABELS } from '@/components/rp/rpTiposConfig';

const TIPOS_FERIAS = ['Saída Férias', 'Interrupção de Férias', 'Nova Saída / Retomada', 'Retorno Férias'];
const ABAS_ORIGEM = [
  { key: 'all', label: 'Todos' },
  { key: 'ex-officio', label: 'Ex Officio' },
  { key: 'livro', label: 'Livro' },
  { key: 'atestado', label: 'Atestados' },
];

function detectarOrigemTipo(registro) {
  if (registro.origem_tipo) return registro.origem_tipo;
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) return 'ex-officio';
  if (registro.medico || registro.cid_10) return 'atestado';
  return 'livro';
}

function mapTipoCodigoParaTipoRegistro(tipoCodigo, fallbackLabel = '') {
  return RP_TIPO_LABELS[tipoCodigo] || RP_TIPO_LABELS[fallbackLabel] || fallbackLabel;
}

function getTipoDisplay(tipo) {
  if (tipo === 'Saída Férias') return 'Início';
  if (tipo === 'Interrupção de Férias') return 'Interrupção';
  if (tipo === 'Nova Saída / Retomada') return 'Continuação';
  if (tipo === 'Retorno Férias') return 'Término';
  return tipo;
}

function mapStatusContratoParaControle(statusCodigo) {
  if (statusCodigo === 'gerada') return 'Publicado';
  if (statusCodigo === 'aguardando_publicacao') return 'Aguardando Publicação';
  if (statusCodigo === 'aguardando_nota') return 'Aguardando Nota';
  if (statusCodigo === 'inconsistente') return 'Inconsistente';
  return 'Aguardando Nota';
}

function getGrupoDisplay(registro) {
  const tipoBase = registro.tipo_registro || registro.tipo || '';
  if (TIPOS_FERIAS.includes(tipoBase)) return 'Férias';
  if (registro.medico || registro.cid_10) return 'Atestado';
  return '';
}

function abreviarPostoGraduacao(valor) {
  const mapa = { Coronel: 'CEL', 'Tenente Coronel': 'TC', Major: 'MAJ', Capitão: 'CAP', '1º Tenente': '1º TEN', '2º Tenente': '2º TEN', Aspirante: 'ASP', Subtenente: 'ST', '1º Sargento': '1º SGT', '2º Sargento': '2º SGT', '3º Sargento': '3º SGT', Cabo: 'CB', Soldado: 'SD' };
  return mapa[valor] || valor || '';
}

function montarNomeInstitucional({ postoGraduacao, quadro, nomeExibicao }) {
  return [postoGraduacao, quadro, nomeExibicao].filter(Boolean).join(' ').trim();
}

function pickPrimeiroValor(...valores) {
  for (const valor of valores) {
    if (valor === null || valor === undefined) continue;
    const texto = String(valor).trim();
    if (texto) return texto;
  }
  return '';
}

function normalizarRegistro(registro) {
  const origemTipo = detectarOrigemTipo(registro);
  const militarContrato = registro?.militar || {};
  const militarNomeCompleto = origemTipo === 'livro'
    ? pickPrimeiroValor(
      militarContrato?.nome_completo,
      registro?.militar_nome_completo,
      registro?.militar_nome_institucional,
      registro?.militar_nome,
      militarContrato?.nome,
      registro?.nome,
    )
    : pickPrimeiroValor(
      registro?.militar_nome_completo,
      registro?.militar_nome_institucional,
      registro?.militar_nome,
      registro?.nome,
    );

  const militarNomeGuerra = origemTipo === 'livro'
    ? pickPrimeiroValor(
      militarContrato?.nome_guerra,
      registro?.militar_nome_guerra,
      registro?.nome_guerra,
      registro?.militar?.nome_guerra,
    )
    : pickPrimeiroValor(
      registro?.militar_nome_guerra,
      registro?.nome_guerra,
    );

  const postoGraduacao = abreviarPostoGraduacao(
    origemTipo === 'livro'
      ? (militarContrato?.posto_graduacao || militarContrato?.posto || militarContrato?.graduacao || '')
      : (registro?.militar_posto_graduacao || registro?.posto_graduacao || registro?.posto || registro?.graduacao || '')
  );

  const quadro = pickPrimeiroValor(
    origemTipo === 'livro' ? militarContrato?.quadro : registro?.militar_quadro,
    registro?.militar_quadro,
    registro?.quadro,
  );
  const tipoRegistroLivro = mapTipoCodigoParaTipoRegistro(registro.tipo_codigo, registro.tipo_label);
  const tipoBase = origemTipo === 'livro' ? (tipoRegistroLivro || registro.tipo_label || registro.tipo || '') : (registro.tipo_registro || registro.tipo || '');
  const tipoDisplay = getTipoDisplay(tipoBase);
  const grupoDisplay = getGrupoDisplay({ ...registro, tipo_registro: tipoBase });

  return {
    ...registro,
    origem_tipo: origemTipo,
    status_calculado: registro.status_calculado || (origemTipo === 'livro' ? mapStatusContratoParaControle(registro.status_codigo) : calcStatusPublicacao(registro)),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: grupoDisplay ? `${grupoDisplay} • ${tipoDisplay}` : tipoDisplay,
    tipo: origemTipo === 'livro' ? (registro.tipo_label || registro.tipo) : registro.tipo,
    tipo_registro: origemTipo === 'livro' ? tipoBase : registro.tipo_registro,
    militar_nome: militarNomeCompleto,
    militar_nome_completo: militarNomeCompleto,
    militar_nome_guerra: militarNomeGuerra,
    militar_posto_graduacao: postoGraduacao,
    militar_quadro: quadro,
    militar_nome_institucional: montarNomeInstitucional({ postoGraduacao, quadro, nomeExibicao: militarNomeCompleto }),
    militar_matricula: origemTipo === 'livro' ? (registro?.militar?.matricula || registro?.militar_matricula) : registro.militar_matricula,
    militar_id: origemTipo === 'livro' ? (registro?.militar?.id || registro?.militar_id) : registro.militar_id,
    created_date: origemTipo === 'livro' ? (registro?.detalhes?.criado_em_iso || registro.created_date) : registro.created_date,
    data_registro: origemTipo === 'livro' ? (registro.data_inicio_iso || registro.data_registro) : registro.data_registro,
    ferias_id: origemTipo === 'livro' ? (registro?.vinculos?.ferias?.id || registro.ferias_id) : registro.ferias_id,
    nota_para_bg: origemTipo === 'livro' ? (registro?.publicacao?.nota_para_bg || registro.nota_para_bg || '') : (registro.nota_para_bg || ''),
    numero_bg: origemTipo === 'livro' ? (registro?.publicacao?.numero_bg || registro.numero_bg || '') : (registro.numero_bg || ''),
    data_bg: origemTipo === 'livro' ? (registro?.publicacao?.data_bg || registro.data_bg || '') : (registro.data_bg || ''),
    detalhes_contrato: origemTipo === 'livro' ? (registro?.detalhes || null) : registro.detalhes_contrato,
    vinculos_contrato: origemTipo === 'livro' ? (registro?.vinculos || null) : registro.vinculos_contrato,
    publicacao_contrato: origemTipo === 'livro' ? (registro?.publicacao || null) : registro.publicacao_contrato,
    inconsistencia_contrato: origemTipo === 'livro' ? (registro?.inconsistencia || null) : registro.inconsistencia_contrato,
    cadeia_eventos_contrato: origemTipo === 'livro' ? (registro?.cadeia_eventos || []) : (registro.cadeia_eventos_contrato || []),
  };
}

function montarPayloadAtualizacao(registroAtual, dataParcial, tipo) {
  const houveAlteracaoCamposPublicacao = ['nota_para_bg', 'numero_bg', 'data_bg'].some((campo) => Object.prototype.hasOwnProperty.call(dataParcial || {}, campo));
  if (!houveAlteracaoCamposPublicacao) return dataParcial || {};
  const statusCalculado = calcStatusPublicacao({ ...(registroAtual || {}), ...(dataParcial || {}) });
  if (tipo === 'atestado') return { ...(dataParcial || {}), status_publicacao: statusCalculado };
  return { ...(dataParcial || {}), status: statusCalculado };
}

function isFeriasOperacional(registro) {
  return detectarOrigemTipo(registro) === 'livro' && !!(registro.ferias_id || registro?.vinculos?.ferias?.id) && (
    TIPOS_FERIAS.includes(registro.tipo_registro) || ['saida_ferias', 'interrupcao_de_ferias', 'nova_saida_retomada', 'retorno_ferias'].includes(registro.tipo_codigo)
  );
}

function containsTerm(valor, termo) {
  if (!termo) return true;
  if (valor === null || valor === undefined) return false;
  return String(valor).toLowerCase().includes(termo);
}

export default function Publicacoes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [abaOrigemAtiva, setAbaOrigemAtiva] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, registro: null });
  const [modoAdmin, setModoAdmin] = useState(false);
  const { user, isAdmin, canAccessModule, canAccessAction, getMilitarScopeFilters, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasPublicacoesAccess = canAccessModule('publicacoes');

  const { data: contratoLivro, isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: () => getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const { data: publicacoesExOfficio = [], isLoading: loadingExOfficio } = useQuery({
    queryKey: ['publicacoes-ex-officio', isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.PublicacaoExOfficio.list('-created_date');
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
      const militarIds = [...new Set(militarQueries.flat().map((m) => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      const arrays = await Promise.all(militarIds.map((id) => base44.entities.PublicacaoExOfficio.filter({ militar_id: id }, '-created_date')));
      const m = new Map();
      arrays.flat().forEach((item) => m.set(item.id, item));
      return Array.from(m.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const { data: atestados = [], isLoading: loadingAtestados } = useQuery({
    queryKey: ['atestados-publicacao', isAdmin],
    queryFn: async () => {
      if (isAdmin) return (await base44.entities.Atestado.list('-created_date')).filter((a) => a.nota_para_bg || a.numero_bg);
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
      const militarIds = [...new Set(militarQueries.flat().map((m) => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      const arrays = await Promise.all(militarIds.map((id) => base44.entities.Atestado.filter({ militar_id: id }, '-created_date')));
      const m = new Map();
      arrays.flat().forEach((item) => { if (item.nota_para_bg || item.numero_bg) m.set(item.id, item); });
      return Array.from(m.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados;
  const registrosLivro = useMemo(() => contratoLivro?.registros_livro || [], [contratoLivro]);
  const todosRegistros = useMemo(() => [...registrosLivro, ...publicacoesExOfficio, ...atestados].map(normalizarRegistro).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)), [registrosLivro, publicacoesExOfficio, atestados]);

  const refrescarDadosPublicacoes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] }),
      queryClient.invalidateQueries({ queryKey: ['atestados'] }),
      queryClient.invalidateQueries({ queryKey: ['ferias'] }),
      queryClient.invalidateQueries({ queryKey: ['cards'] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, tipo }) => {
      const registroAtual = todosRegistros.find((item) => item.id === id);
      const payloadFinal = montarPayloadAtualizacao(registroAtual, data, tipo);
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, payloadFinal);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, payloadFinal);
      await base44.entities.RegistroLivro.update(id, payloadFinal);
      if (isFeriasOperacional(registroAtual)) await reconciliarCadeiaFerias({ feriasId: registroAtual.ferias_id });
      return null;
    },
    onSuccess: refrescarDadosPublicacoes,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tipo, registro }) => {
      if (tipo === 'atestado') return;
      if (tipo === 'ex-officio') {
        const isApostila = registro.tipo === 'Apostila';
        const isTSE = registro.tipo === 'Tornar sem Efeito';
        if (isApostila || isTSE) {
          const refId = registro.publicacao_referencia_id;
          const origemTipoHint = registro.publicacao_referencia_origem_tipo || null;
          if (refId) {
            const entityOriginal = origemTipoHint === 'atestado' ? base44.entities.Atestado : origemTipoHint === 'livro' ? base44.entities.RegistroLivro : base44.entities.PublicacaoExOfficio;
            const [original] = await entityOriginal.filter({ id: refId });
            if (original) {
              const payload = { ...(origemTipoHint === 'atestado' ? {} : { status: calcStatusPublicacao(original) }) };
              if (isApostila) { payload.apostilada_por_id = null; payload.foi_apostilada = false; }
              if (isTSE) { payload.tornada_sem_efeito_por_id = null; payload.foi_tornada_sem_efeito = false; }
              if (origemTipoHint === 'atestado') payload.status_publicacao = calcStatusPublicacao(original);
              await entityOriginal.update(refId, payload);
            }
          }

          if (isTSE && refId && (!origemTipoHint || origemTipoHint === 'ex-officio')) {
            const [publicacaoReferencia] = await base44.entities.PublicacaoExOfficio.filter({ id: refId });
            for (const atestadoId of getAtestadoIdsVinculados(publicacaoReferencia)) {
              await atualizarEstadoAtestadoPelasPublicacoes(atestadoId, base44.entities.Atestado, base44.entities.PublicacaoExOfficio);
            }
          }
        }

        await reverterAtestadosPorExclusaoPublicacao(registro, base44.entities.Atestado, base44.entities.PublicacaoExOfficio);
        return base44.entities.PublicacaoExOfficio.delete(id);
      }

      if (tipo === 'livro') {
        if (isFeriasOperacional(registro)) throw new Error('Esta publicação está vinculada a uma cadeia de férias e não pode ser excluída isoladamente. Use as ações administrativas da cadeia.');
        return base44.entities.RegistroLivro.delete(id);
      }
    },
    onSuccess: async () => {
      await Promise.all([refrescarDadosPublicacoes(), queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] })]);
    },
    onError: (error) => alert(error?.message || 'Erro ao excluir registro.'),
  });

  const registrosDaAbaAtiva = useMemo(() => (abaOrigemAtiva === 'all' ? todosRegistros : todosRegistros.filter((registro) => registro.origem_tipo === abaOrigemAtiva)), [todosRegistros, abaOrigemAtiva]);
  const filteredRegistros = useMemo(() => registrosDaAbaAtiva.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status_calculado === statusFilter;
    const termo = searchTerm.toLowerCase().trim();
    const matchesSearch =
      containsTerm(r.militar_nome, termo) ||
      containsTerm(r.militar_matricula, termo) ||
      containsTerm(r.numero_bg, termo) ||
      containsTerm(r.nota_para_bg, termo) ||
      containsTerm(r.tipo, termo) ||
      containsTerm(r.tipo_registro, termo) ||
      containsTerm(r.tipo_display, termo) ||
      containsTerm(r.grupo_display, termo);
    return matchesStatus && matchesSearch;
  }), [registrosDaAbaAtiva, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    total: registrosDaAbaAtiva.length,
    aguardandoNota: registrosDaAbaAtiva.filter((r) => r.status_calculado === 'Aguardando Nota').length,
    aguardandoPublicacao: registrosDaAbaAtiva.filter((r) => r.status_calculado === 'Aguardando Publicação').length,
    publicados: registrosDaAbaAtiva.filter((r) => r.status_calculado === 'Publicado').length,
    inconsistentes: registrosDaAbaAtiva.filter((r) => r.status_calculado === 'Inconsistente').length,
  }), [registrosDaAbaAtiva]);

  const handleUpdate = (id, data, tipo) => {
    if (!canAccessAction('publicar_bg') && !canAccessAction('admin_mode')) return alert('Ação negada: você não tem permissão para atualizar dados de publicação.');
    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    if (!canAccessAction('admin_mode') || !modoAdmin) return alert('Ação restrita. Exige permissão de administração e modo admin ativo.');
    const registro = todosRegistros.find((r) => r.id === id);
    if (!registro) return;
    if (tipo === 'atestado') return alert('Atestados não podem ser excluídos pelo Controle de Publicações. Acesse o módulo de Atestados.');
    if (tipo === 'livro' && isFeriasOperacional(registro)) return alert('Esta publicação está vinculada a uma cadeia de férias e não pode ser excluída isoladamente. Use as ações administrativas da cadeia.');
    if (registro.status_calculado === 'Publicado' && registro.tipo !== 'Apostila' && registro.tipo !== 'Tornar sem Efeito') return alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
    if (registro.tipo === 'Tornar sem Efeito') return alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
    deleteMutation.mutate({ id, tipo, registro });
  };

  const grupos = [
    { key: 'Aguardando Nota', label: 'Aguardando Nota', color: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-50' },
    { key: 'Aguardando Publicação', label: 'Aguardando Publicação', color: 'text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50' },
    { key: 'Publicado', label: 'Publicado', color: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50' },
    { key: 'Inconsistente', label: 'Inconsistente', color: 'text-red-700', border: 'border-red-300', bg: 'bg-red-50' },
  ];

  if (loadingUser || !isAccessResolved) return null;
  if (!hasPublicacoesAccess) return <AccessDenied modulo="Controle de Publicações" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,95,0.12),_transparent_45%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#eef2ff_100%)] px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white px-3 py-1 text-xs font-medium text-[#1e3a5f] shadow-sm">
                  <BookOpenText className="h-3.5 w-3.5" /> Controle de Publicações
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">Painel Operacional de Publicações</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Consolide Livro, Ex Officio e Atestados no mesmo fluxo operacional.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <InfoPill icon={LayoutGrid} label={`${stats.total} registros na origem selecionada`} />
                  <InfoPill icon={Sparkles} label={`${filteredRegistros.length} itens compatíveis com os filtros`} />
                  {stats.inconsistentes > 0 && <InfoPill icon={ShieldAlert} label={`${stats.inconsistentes} inconsistência(s) para conferência`} tone="danger" />}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {canAccessAction('admin_mode') && (
                  <Button variant="outline" onClick={() => setModoAdmin((v) => !v)} className={modoAdmin ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-red-200 text-red-700 hover:bg-red-50'}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> {modoAdmin ? 'Modo admin ativo' : 'Modo admin'}
                  </Button>
                )}
                <Button asChild variant="outline">
                  <button onClick={() => navigate(createPageUrl('CadastrarPublicacao'))}><Plus className="mr-2 h-4 w-4" />Nova publicação</button>
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-5 md:grid-cols-2 xl:grid-cols-5 lg:px-8">
            <MetricCard icon={FileText} label="Total" value={stats.total} helper="Todos os registros visíveis" />
            <MetricCard icon={Clock} label="Aguardando nota" value={stats.aguardandoNota} helper="Dependem de nota para BG" tone="amber" />
            <MetricCard icon={AlertCircle} label="Aguardando publicação" value={stats.aguardandoPublicacao} helper="Prontos para boletim" tone="blue" />
            <MetricCard icon={CheckCircle} label="Publicados" value={stats.publicados} helper="Já lançados em BG" tone="emerald" />
            <MetricCard icon={ShieldAlert} label="Inconsistências" value={stats.inconsistentes} helper="Requer conferência" tone="red" />
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr,1fr]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</label>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-11 rounded-xl border-slate-200 pl-9" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos Status</SelectItem><SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem><SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem><SelectItem value="Publicado">Publicado</SelectItem><SelectItem value="Inconsistente">Inconsistente</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {ABAS_ORIGEM.map((aba) => {
                  const totalAba = aba.key === 'all' ? todosRegistros.length : todosRegistros.filter((registro) => registro.origem_tipo === aba.key).length;
                  const ativa = abaOrigemAtiva === aba.key;
                  return <button key={aba.key} type="button" onClick={() => setAbaOrigemAtiva(aba.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${ativa ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'}`}><span>{aba.label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${ativa ? 'bg-white/15 text-white' : 'border border-slate-200 bg-slate-50 text-slate-500'}`}>{totalAba}</span></button>;
                })}
              </div>
            </div>
          </div>
        </section>

        {isLoading ? <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Carregando registros...</div> : filteredRegistros.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Inbox className="h-8 w-8" /></div>
            <h3 className="mt-5 text-lg font-semibold text-slate-800">Nenhum registro encontrado</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{searchTerm || statusFilter !== 'all' ? 'Ajuste os filtros para localizar publicações compatíveis com a busca atual.' : 'Os registros de publicação aparecerão aqui conforme forem disponibilizados pelas origens integradas do painel.'}</p>
          </section>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo) => {
              const items = filteredRegistros.filter((r) => r.status_calculado === grupo.key);
              if (!items.length) return null;
              return (
                <section key={grupo.key} className="space-y-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${grupo.border} ${grupo.bg}`}><span className={`text-sm font-bold ${grupo.color}`}>{grupo.label}</span><span className={`text-xs ${grupo.color} opacity-70`}>{items.length} registro(s)</span></div>
                  <div className="space-y-3">
                    {items.map((registro) => (
                      <PublicacaoCard
                        key={registro.id}
                        registro={registro}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onVerFamilia={() => setFamiliaPanel({ open: true, registro })}
                        canAccessAction={canAccessAction}
                        modoAdmin={modoAdmin}
                        currentUserEmail={user?.email || ''}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {familiaPanel.open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setFamiliaPanel({ open: false, registro: null })} />
          <FamiliaPublicacaoPanel registro={familiaPanel.registro} todosRegistros={todosRegistros} onClose={() => setFamiliaPanel({ open: false, registro: null })} />
        </>
      )}
    </div>
  );
}

function InfoPill({ icon: Icon, label, tone = 'default' }) {
  const toneClasses = { default: 'border-slate-200 bg-white text-slate-600', danger: 'border-red-200 bg-red-50 text-red-700' };
  return <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${toneClasses[tone] || toneClasses.default}`}><Icon className="h-3.5 w-3.5" /><span>{label}</span></div>;
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'slate' }) {
  const toneClasses = {
    slate: { icon: 'bg-[#1e3a5f]/10 text-[#1e3a5f]', value: 'text-[#1e3a5f]', ring: 'border-slate-200 bg-white' },
    amber: { icon: 'bg-amber-100 text-amber-700', value: 'text-amber-700', ring: 'border-amber-200 bg-white' },
    blue: { icon: 'bg-blue-100 text-blue-700', value: 'text-blue-700', ring: 'border-blue-200 bg-white' },
    emerald: { icon: 'bg-emerald-100 text-emerald-700', value: 'text-emerald-700', ring: 'border-emerald-200 bg-white' },
    red: { icon: 'bg-red-100 text-red-700', value: 'text-red-700', ring: 'border-red-200 bg-white' },
  };
  const classes = toneClasses[tone] || toneClasses.slate;
  return (
    <div className={`rounded-2xl border p-4 ${classes.ring}`}>
      <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><div className={`rounded-lg p-2 ${classes.icon}`}><Icon className="h-4 w-4" /></div></div>
      <p className={`mt-3 text-2xl font-bold ${classes.value}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
