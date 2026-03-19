import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Search, Plus, Clock, CheckCircle, AlertCircle, ShieldAlert, BookOpenText, Filter } from 'lucide-react';
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

const TIPOS_FERIAS = [
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
];

const ABAS_ORIGEM = [
  { key: 'all', label: 'Todos' },
  { key: 'ex-officio', label: 'Ex Officio' },
  { key: 'livro', label: 'Livro' },
  { key: 'atestado', label: 'Atestados' },
];


function detectarOrigemTipo(registro) {
  if (registro.origem_tipo) return registro.origem_tipo;
  if (registro.tipo_label || registro.status_codigo || registro.origem) return 'livro';
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) {
    return 'ex-officio';
  }
  if (registro.medico || registro.cid_10) {
    return 'atestado';
  }
  return 'livro';
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

function mapTipoCodigoParaTipoRegistro(tipoCodigo, fallbackLabel = '') {
  const mapa = {
    saida_ferias: 'Saída Férias',
    interrupcao_de_ferias: 'Interrupção de Férias',
    nova_saida_retomada: 'Nova Saída / Retomada',
    retorno_ferias: 'Retorno Férias',
  };

  return mapa[tipoCodigo] || fallbackLabel;
}

function getGrupoDisplay(registro) {
  const tipoBase = registro.tipo_registro || registro.tipo || '';

  if (TIPOS_FERIAS.includes(tipoBase)) {
    return 'Férias';
  }

  if (registro.medico || registro.cid_10) {
    return 'Atestado';
  }

  return '';
}

function abreviarPostoGraduacao(valor) {
  const mapa = {
    'Coronel': 'Cel',
    'Tenente Coronel': 'TC',
    'Major': 'Maj',
    'Capitão': 'Cap',
    '1º Tenente': '1º Ten',
    '2º Tenente': '2º Ten',
    'Aspirante': 'Asp',
    'Subtenente': 'ST',
    '1º Sargento': '1º Sgt',
    '2º Sargento': '2º Sgt',
    '3º Sargento': '3º Sgt',
    'Cabo': 'Cb',
    'Soldado': 'Sd',
  };
  return mapa[valor] || valor || '';
}

function montarNomeInstitucional({ postoGraduacao, quadro, nomeExibicao }) {
  return [postoGraduacao, quadro, nomeExibicao].filter(Boolean).join(' ').trim();
}

function normalizarRegistro(registro) {
  const origemTipo = detectarOrigemTipo(registro);
  const militarContrato = registro?.militar || {};
  const militarNome = origemTipo === 'livro'
    ? (militarContrato?.nome_guerra || militarContrato?.nome || registro?.militar_nome || '')
    : (registro?.militar_nome || registro?.nome_guerra || registro?.nome || '');

  const postoGraduacaoBruto = origemTipo === 'livro'
    ? (militarContrato?.posto_graduacao || militarContrato?.posto || militarContrato?.graduacao || '')
    : (registro?.militar_posto_graduacao || registro?.posto_graduacao || registro?.posto || registro?.graduacao || '');

  const quadro = origemTipo === 'livro'
    ? (militarContrato?.quadro || '')
    : (registro?.militar_quadro || registro?.quadro || '');

  const postoGraduacao = abreviarPostoGraduacao(postoGraduacaoBruto);
  const tipoRegistroLivro = mapTipoCodigoParaTipoRegistro(registro.tipo_codigo, registro.tipo_label);
  const tipoBase = origemTipo === 'livro'
    ? (tipoRegistroLivro || registro.tipo_label || registro.tipo || '')
    : (registro.tipo_registro || registro.tipo || '');
  const tipoDisplay = getTipoDisplay(tipoBase);
  const grupoDisplay = getGrupoDisplay({ ...registro, tipo_registro: tipoBase });
  const tipoCompostoDisplay = grupoDisplay
    ? `${grupoDisplay} • ${tipoDisplay}`
    : tipoDisplay;

  return {
    ...registro,
    origem_tipo: origemTipo,
    status_calculado: registro.status_calculado || (origemTipo === 'livro'
      ? mapStatusContratoParaControle(registro.status_codigo)
      : calcStatusPublicacao(registro)),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: tipoCompostoDisplay,
    tipo: origemTipo === 'livro' ? (registro.tipo_label || registro.tipo) : registro.tipo,
    tipo_registro: origemTipo === 'livro' ? tipoBase : registro.tipo_registro,
    militar_nome: militarNome,
    militar_posto_graduacao: postoGraduacao,
    militar_quadro: quadro,
    militar_nome_institucional: montarNomeInstitucional({
      postoGraduacao,
      quadro,
      nomeExibicao: militarNome,
    }),
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
  const registroBase = registroAtual || {};
  const payloadParcial = dataParcial || {};
  const registroMesclado = { ...registroBase, ...payloadParcial };

  const houveAlteracaoCamposPublicacao =
    Object.prototype.hasOwnProperty.call(payloadParcial, 'nota_para_bg') ||
    Object.prototype.hasOwnProperty.call(payloadParcial, 'numero_bg') ||
    Object.prototype.hasOwnProperty.call(payloadParcial, 'data_bg');

  if (!houveAlteracaoCamposPublicacao) {
    return payloadParcial;
  }

  const statusCalculado = calcStatusPublicacao(registroMesclado);

  if (tipo === 'atestado') {
    return {
      ...payloadParcial,
      status_publicacao: statusCalculado,
    };
  }

  return {
    ...payloadParcial,
    status: statusCalculado,
  };
}

function getEventDate(registro) {
  return registro?.data_registro || registro?.data_inicio || registro?.data_inicio_iso || null;
}

function isFeriasOperacional(registro) {
  return (
    detectarOrigemTipo(registro) === 'livro' &&
    !!(registro.ferias_id || registro?.vinculos?.ferias?.id) &&
    (
      TIPOS_FERIAS.includes(registro.tipo_registro) ||
      ['saida_ferias', 'interrupcao_de_ferias', 'nova_saida_retomada', 'retorno_ferias'].includes(registro.tipo_codigo)
    )
  );
}

export default function Publicacoes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [abaOrigemAtiva, setAbaOrigemAtiva] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, registro: null });
  const [modoAdmin, setModoAdmin] = useState(false);
  const { isAdmin, canAccessModule, canAccessAction, getMilitarScopeFilters, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasPublicacoesAccess = canAccessModule('publicacoes');

  const { data: contratoLivro, isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: () => getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters }),
    // Só dispara após resolução de acesso e confirmação de permissão
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const { data: publicacoesExOfficio = [], isLoading: loadingExOfficio } = useQuery({
    queryKey: ['publicacoes-ex-officio', isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.PublicacaoExOfficio.list('-created_date');
      
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map(f => base44.entities.Militar.filter(f)));
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      
      const queryPromises = militarIds.map(id => base44.entities.PublicacaoExOfficio.filter({ militar_id: id }, '-created_date'));
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => m.set(item.id, item));
      return Array.from(m.values()).sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0));
    },
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const { data: atestados = [], isLoading: loadingAtestados } = useQuery({
    queryKey: ['atestados-publicacao', isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        const all = await base44.entities.Atestado.list('-created_date');
        return all.filter(a => a.nota_para_bg || a.numero_bg);
      }
      
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map(f => base44.entities.Militar.filter(f)));
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      
      const queryPromises = militarIds.map(id => base44.entities.Atestado.filter({ militar_id: id }, '-created_date'));
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => { if (item.nota_para_bg || item.numero_bg) m.set(item.id, item); });
      return Array.from(m.values()).sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0));
    },
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados;

  const registrosLivro = useMemo(() => contratoLivro?.registros_livro || [], [contratoLivro]);

  const registros = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map(normalizarRegistro)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, tipo }) => {
      const registroAtual = registros.find((item) => item.id === id);
      const payloadFinal = montarPayloadAtualizacao(registroAtual, data, tipo);

      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, payloadFinal);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, payloadFinal);

      await base44.entities.RegistroLivro.update(id, payloadFinal);
      if (isFeriasOperacional(registroAtual)) {
        await reconciliarCadeiaFerias({ feriasId: registroAtual.ferias_id });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tipo, registro }) => {
      if (tipo === 'atestado') return;

      const detectarTipo = (refId) => {
        const found = [...registrosLivro, ...publicacoesExOfficio, ...atestados].find(r => r.id === refId);
        if (!found) return 'ex-officio';
        return detectarOrigemTipo(found);
      };

      const reverterVinculo = async (isApostila, isTSE, refId, origemTipoHint) => {
        if (!refId) return;
        const origemTipo = origemTipoHint || detectarTipo(refId);
        const entityOriginal =
          origemTipo === 'atestado' ? base44.entities.Atestado :
          origemTipo === 'livro' ? base44.entities.RegistroLivro :
          base44.entities.PublicacaoExOfficio;

        const originais = await entityOriginal.filter({ id: refId });
        const original = originais[0];
        if (!original) return;

        const payload = { ...(origemTipo === 'atestado' ? {} : { status: calcStatusPublicacao(original) }) };

        if (isApostila) {
          payload.apostilada_por_id = null;
          payload.foi_apostilada = false;
        }
        if (isTSE) {
          payload.tornada_sem_efeito_por_id = null;
          payload.foi_tornada_sem_efeito = false;
        }

        if (origemTipo === 'atestado') {
          payload.status_publicacao = calcStatusPublicacao(original);
        }

        await entityOriginal.update(refId, payload);
      };

      if (tipo === 'ex-officio') {
        const isApostila = registro.tipo === 'Apostila';
        const isTSE = registro.tipo === 'Tornar sem Efeito';

        if (isApostila || isTSE) {
          const refId = registro.publicacao_referencia_id;
          const origemTipoHint = registro.publicacao_referencia_origem_tipo || null;
          await reverterVinculo(isApostila, isTSE, refId, origemTipoHint);

          if (isTSE && refId && (!origemTipoHint || origemTipoHint === 'ex-officio')) {
            const [publicacaoReferencia] = await base44.entities.PublicacaoExOfficio.filter({ id: refId });
            const atestadoIdsVinculados = getAtestadoIdsVinculados(publicacaoReferencia);
            for (const atestadoId of atestadoIdsVinculados) {
              await atualizarEstadoAtestadoPelasPublicacoes(
                atestadoId,
                base44.entities.Atestado,
                base44.entities.PublicacaoExOfficio
              );
            }
          }
        }

        await reverterAtestadosPorExclusaoPublicacao(
          registro,
          base44.entities.Atestado,
          base44.entities.PublicacaoExOfficio
        );


        return base44.entities.PublicacaoExOfficio.delete(id);
      }

      if (tipo === 'livro') {
        if (isFeriasOperacional(registro)) {
          throw new Error('Esta publicação está vinculada a uma cadeia de férias e não pode ser excluída isoladamente. Use as ações administrativas da cadeia.');
        }

        return base44.entities.RegistroLivro.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao excluir registro.');
    }
  });

  const registrosDaAbaAtiva = useMemo(() => {
    if (abaOrigemAtiva === 'all') return registros;
    return registros.filter((registro) => registro.origem_tipo === abaOrigemAtiva);
  }, [registros, abaOrigemAtiva]);

  const filteredRegistros = useMemo(() => {
    return registrosDaAbaAtiva.filter((r) => {
      const matchesStatus =
        statusFilter === 'all' || r.status_calculado === statusFilter;

      const termo = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !termo ||
        r.militar_nome?.toLowerCase().includes(termo) ||
        r.militar_matricula?.toLowerCase().includes(termo) ||
        r.numero_bg?.toLowerCase().includes(termo) ||
        r.nota_para_bg?.toLowerCase().includes(termo) ||
        r.tipo?.toLowerCase().includes(termo) ||
        r.tipo_registro?.toLowerCase().includes(termo) ||
        r.tipo_display?.toLowerCase().includes(termo) ||
        r.grupo_display?.toLowerCase().includes(termo) ||
        r.tipo_composto_display?.toLowerCase().includes(termo);

      return matchesStatus && matchesSearch;
    });
  }, [registrosDaAbaAtiva, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: registrosDaAbaAtiva.length,
      aguardandoNota: registrosDaAbaAtiva.filter(r => r.status_calculado === 'Aguardando Nota').length,
      aguardandoPublicacao: registrosDaAbaAtiva.filter(r => r.status_calculado === 'Aguardando Publicação').length,
      publicados: registrosDaAbaAtiva.filter(r => r.status_calculado === 'Publicado').length,
      inconsistentes: registrosDaAbaAtiva.filter(r => r.status_calculado === 'Inconsistente').length
    };
  }, [registrosDaAbaAtiva]);

  const handleUpdate = (id, data, tipo) => {
    // Verificação explícita: atualizar BG/nota exige permissão de publicar
    if (!canAccessAction('publicar_bg') && !canAccessAction('admin_mode')) {
      alert('Ação negada: você não tem permissão para atualizar dados de publicação.');
      return;
    }
    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    if (!canAccessAction('admin_mode') || !modoAdmin) {
      alert('Ação restrita. Exige permissão de administração e modo admin ativo.');
      return;
    }

    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    if (tipo === 'atestado') {
      alert('Atestados não podem ser excluídos pelo Controle de Publicações. Acesse o módulo de Atestados.');
      return;
    }

    if (tipo === 'livro' && isFeriasOperacional(registro)) {
      alert('Esta publicação está vinculada a uma cadeia de férias e não pode ser excluída isoladamente. Use as ações administrativas da cadeia.');
      return;
    }

    if (registro.status_calculado === 'Publicado') {
      if (registro.tipo !== 'Apostila' && registro.tipo !== 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
      if (registro.tipo === 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
    }

    deleteMutation.mutate({ id, tipo, registro });
  };

  const grupos = [
    {
      key: 'Aguardando Nota',
      label: 'Aguardando Nota',
      color: 'text-amber-700',
      border: 'border-amber-300',
      bg: 'bg-amber-50'
    },
    {
      key: 'Aguardando Publicação',
      label: 'Aguardando Publicação',
      color: 'text-blue-700',
      border: 'border-blue-300',
      bg: 'bg-blue-50'
    },
    {
      key: 'Publicado',
      label: 'Publicado',
      color: 'text-emerald-700',
      border: 'border-emerald-300',
      bg: 'bg-emerald-50'
    },
    {
      key: 'Inconsistente',
      label: 'Inconsistente',
      color: 'text-red-700',
      border: 'border-red-300',
      bg: 'bg-red-50'
    },
  ];

  if (loadingUser || !isAccessResolved) return null;
  if (!hasPublicacoesAccess) return <AccessDenied modulo="Controle de Publicações" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white px-3 py-1 text-xs font-medium text-[#1e3a5f] shadow-sm">
              <BookOpenText className="h-3.5 w-3.5" />
              Controle de Publicações
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">Painel Operacional de Publicações</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Acompanhe publicações do Livro, Ex Officio e Atestados com o mesmo padrão visual e foco operacional do módulo RP.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canAccessAction('admin_mode') && (
              <Button
                variant="outline"
                onClick={() => setModoAdmin((v) => !v)}
                className={modoAdmin
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-red-200 text-red-700 hover:bg-red-50'}
                title={modoAdmin ? 'Desativar modo admin' : 'Ativar modo admin para ações sensíveis'}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                {modoAdmin ? 'Modo admin ativo' : 'Modo admin'}
              </Button>
            )}

            <Button asChild variant="outline">
              <button onClick={() => navigate(createPageUrl('CadastrarPublicacao'))}>
                <Plus className="mr-2 h-4 w-4" />
                Nova publicação
              </button>
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={FileText} label="Total" value={stats.total} helper="Todos os registros visíveis" />
          <MetricCard icon={Clock} label="Aguardando nota" value={stats.aguardandoNota} helper="Dependem de nota para BG" />
          <MetricCard icon={AlertCircle} label="Aguardando publicação" value={stats.aguardandoPublicacao} helper="Prontos para boletim" />
          <MetricCard icon={CheckCircle} label="Publicados" value={stats.publicados} helper="Já lançados em BG" />
          <MetricCard icon={ShieldAlert} label="Inconsistências" value={stats.inconsistentes} helper="Requer conferência" />
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Filtros operacionais
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.25fr,0.75fr,1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                <SelectItem value="Publicado">Publicado</SelectItem>
                <SelectItem value="Inconsistente">Inconsistente</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              {ABAS_ORIGEM.map((aba) => {
                const totalAba = aba.key === 'all'
                  ? registros.length
                  : registros.filter((registro) => registro.origem_tipo === aba.key).length;
                const ativa = abaOrigemAtiva === aba.key;

                return (
                  <button
                    key={aba.key}
                    type="button"
                    onClick={() => setAbaOrigemAtiva(aba.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${ativa
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'}`}
                  >
                    <span>{aba.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ativa ? 'bg-white/15 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                      {totalAba}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{filteredRegistros.length} registro(s) encontrado(s)</span>
            {stats.inconsistentes > 0 && (
              <span className="font-medium text-red-600">
                {stats.inconsistentes} registro(s) inconsistente(s) na aba selecionada
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando registros...
          </div>
        ) : filteredRegistros.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-700">Nenhum registro encontrado</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Ajuste os filtros para localizar publicações compatíveis com a busca.'
                : 'Os registros de publicação aparecerão aqui conforme forem disponibilizados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo) => {
              const items = filteredRegistros.filter(r => r.status_calculado === grupo.key);
              if (items.length === 0) return null;

              return (
                <section key={grupo.key} className="space-y-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${grupo.border} ${grupo.bg}`}>
                    <span className={`text-sm font-bold ${grupo.color}`}>{grupo.label}</span>
                    <span className={`text-xs ${grupo.color} opacity-70`}>{items.length} registro(s)</span>
                  </div>

                  <div className="space-y-3">
                    {items.map((registro) => (
                      <PublicacaoCard
                        key={registro.id}
                        registro={registro}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onVerFamilia={() => setFamiliaPanel({ open: true, registro })}
                        todosRegistros={registros}
                        isAdmin={isAdmin}
                        modoAdmin={modoAdmin}
                        canAccessAction={canAccessAction}
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
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setFamiliaPanel({ open: false, registro: null })}
          />
          <FamiliaPublicacaoPanel
            registro={familiaPanel.registro}
            todosRegistros={registros}
            onClose={() => setFamiliaPanel({ open: false, registro: null })}
          />
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-xl bg-[#1e3a5f]/10 p-2 text-[#1e3a5f]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-2xl font-bold text-[#1e3a5f]">{value}</span>
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
