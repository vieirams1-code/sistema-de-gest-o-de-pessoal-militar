import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Search, Plus, Clock, CheckCircle, AlertCircle, ShieldAlert, BookOpenText, Filter, Sparkles, LayoutGrid, Inbox, Layers3 } from 'lucide-react';
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
import {
  buildPayloadPublicacaoCompilada,
  buildTextoCompiladoFerias,
  PUBLICACAO_COMPILADA_FERIAS_TIPO,
  limparVinculoLoteDosFilhos,
  isLoteCompiladoPublicado,
  isRegistroElegivelParaCompilacaoFerias,
  isRegistroFilhoDePublicacaoCompilada,
  isRegistroEmLoteCompilado,
  podeDesfazerLoteCompilado,
  validarCompatibilidadeLoteFerias,
} from '@/components/publicacao/publicacaoCompiladaService';

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
  { key: 'publicacao-compilada', label: 'Lotes' },
  { key: 'atestado', label: 'Atestados' },
];

function detectarOrigemTipo(registro) {
  if (registro?.tipo_lote || registro?.quantidade_itens) return 'publicacao-compilada';
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
  const isLoteCompilado = origemTipo === 'publicacao-compilada';
  const militarContrato = registro?.militar || {};
  const militarNome = origemTipo === 'livro'
    ? (militarContrato?.nome_guerra || militarContrato?.nome || registro?.militar_nome || '')
    : (isLoteCompilado
      ? (registro?.titulo || `Publicação compilada${registro?.tipo_lote ? ` • ${String(registro.tipo_lote).toUpperCase()}` : ''}`)
      : (registro?.militar_nome || registro?.nome_guerra || registro?.nome || ''));

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
      : isLoteCompilado
        ? (registro.status || (registro.numero_bg && registro.data_bg ? 'Publicado' : registro.nota_para_bg ? 'Aguardando Publicação' : 'Aguardando Nota'))
      : calcStatusPublicacao(registro)),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: tipoCompostoDisplay,
    quantidade_itens: registro?.quantidade_itens ?? 0,
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
    publicacao_compilada_id: origemTipo === 'livro'
      ? (registro?.publicacao_compilada_id || registro?.publicacao?.publicacao_compilada_id || null)
      : (registro.publicacao_compilada_id || null),
    publicacao_compilada_ordem: origemTipo === 'livro'
      ? (registro?.publicacao_compilada_ordem ?? registro?.publicacao?.publicacao_compilada_ordem ?? null)
      : (registro.publicacao_compilada_ordem ?? null),
    compilado_em_lote: origemTipo === 'livro'
      ? isRegistroEmLoteCompilado({
          publicacao_compilada_id: registro?.publicacao_compilada_id || registro?.publicacao?.publicacao_compilada_id,
          compilado_em_lote: registro?.compilado_em_lote || registro?.publicacao?.compilado_em_lote,
        })
      : isRegistroEmLoteCompilado(registro),
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

function isFilhoDeLoteNaListaPrincipal(registro) {
  return (
    detectarOrigemTipo(registro) === 'livro' &&
    (
      !!registro?.publicacao_compilada_id ||
      registro?.compilado_em_lote === true
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
  const [selectedRegistros, setSelectedRegistros] = useState([]);
  const [loteDestinoId, setLoteDestinoId] = useState('');
  const { isAdmin, canAccessModule, canAccessAction, getMilitarScopeFilters, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
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

  const { data: publicacoesCompiladas = [], isLoading: loadingCompiladas } = useQuery({
    queryKey: ['publicacoes-compiladas', isAdmin],
    queryFn: async () => base44.entities.PublicacaoCompilada.list('-created_date'),
    enabled: isAccessResolved && hasPublicacoesAccess,
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados || loadingCompiladas;

  const registrosLivro = useMemo(() => contratoLivro?.registros_livro || [], [contratoLivro]);

  const todosRegistros = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados, ...publicacoesCompiladas]
      .map(normalizarRegistro)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados, publicacoesCompiladas]);

  const registrosVisiveis = useMemo(() => (
    todosRegistros.filter((registro) => !isFilhoDeLoteNaListaPrincipal(registro))
  ), [todosRegistros]);

  const refrescarDadosPublicacoes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-compiladas'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] }),
      queryClient.invalidateQueries({ queryKey: ['atestados'] }),
      queryClient.invalidateQueries({ queryKey: ['ferias'] }),
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] }),
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] }),
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] }),
      queryClient.invalidateQueries({ queryKey: ['cards'] }),
    ]);

    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['registros-livro'], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['publicacoes-compiladas'], type: 'active' }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, tipo }) => {
      const registroAtual = todosRegistros.find((item) => item.id === id);
      const payloadFinal = montarPayloadAtualizacao(registroAtual, data, tipo);

      if (tipo === 'publicacao-compilada') {
        const notaFoiAlterada = Object.prototype.hasOwnProperty.call(data || {}, 'nota_para_bg')
          && data?.nota_para_bg !== registroAtual?.nota_para_bg;

        const loteAtualizado = await base44.entities.PublicacaoCompilada.update(id, payloadFinal);

        if (registroAtual?.origem_tipo === 'publicacao-compilada' && notaFoiAlterada) {
          const filhosDoLote = todosRegistros.filter((item) => item?.publicacao_compilada_id === id);
          const filhosNaoPublicados = filhosDoLote.filter((filho) => !(filho?.numero_bg && filho?.data_bg));

          await Promise.all(
            filhosNaoPublicados.map((filho) =>
              base44.entities.RegistroLivro.update(filho.id, { nota_para_bg: data.nota_para_bg })
            )
          );
        }

        return loteAtualizado;
      }
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, payloadFinal);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, payloadFinal);

      await base44.entities.RegistroLivro.update(id, payloadFinal);
      if (isFeriasOperacional(registroAtual)) {
        await reconciliarCadeiaFerias({ feriasId: registroAtual.ferias_id });
      }
      return null;
    },
    onSuccess: async () => {
      await refrescarDadosPublicacoes();
    }
  });

  const compilarMutation = useMutation({
    mutationFn: async (registrosSelecionados) => {
      const compatibilidade = validarCompatibilidadeLoteFerias(registrosSelecionados);
      if (!compatibilidade.compativel) {
        throw new Error(compatibilidade.motivo);
      }

      // Verificar se algum registro já está compilado (usando dados locais — mais rápido e sem risco de leitura atrasada)
      const registrosJaCompilados = registrosSelecionados.filter((registro) =>
        isRegistroEmLoteCompilado(registro) || !!registro?.publicacao_compilada_id
      );

      if (registrosJaCompilados.length > 0) {
        throw new Error('Não é possível compilar novamente: há registros selecionados já vinculados a um lote compilado.');
      }

      // Garante em memória a ordem correta para construção sequencial do texto
      const registrosComOrdem = registrosSelecionados.map((registro, index) => ({
        ...registro,
        publicacao_compilada_ordem: index + 1
      }));

      const textoCompilado = buildTextoCompiladoFerias(registrosComOrdem);
      const payloadLote = buildPayloadPublicacaoCompilada(registrosComOrdem, {
        texto_publicacao: textoCompilado,
        nota_para_bg: '',
        numero_bg: '',
        data_bg: '',
      });

      if (!payloadLote.ok) {
        throw new Error(payloadLote.erro || 'Não foi possível montar o lote compilado.');
      }

      let loteCriado = null;
      const filhosVinculados = [];

      try {
        loteCriado = await base44.entities.PublicacaoCompilada.create(payloadLote.payload);

        if (!loteCriado?.id) {
          throw new Error('Falha ao criar o lote compilado: ID não retornado pelo servidor.');
        }

        // Vincular todos os filhos em paralelo — sem get() posterior para evitar atraso de leitura
        await Promise.all(
          registrosSelecionados.map((registro, index) =>
            base44.entities.RegistroLivro.update(registro.id, {
              publicacao_compilada_id: loteCriado.id,
              compilado_em_lote: true,
              publicacao_compilada_ordem: index + 1,
              nota_para_bg: loteCriado?.nota_para_bg || '',
            }).then(() => {
              filhosVinculados.push(registro.id);
            })
          )
        );

        return loteCriado;
      } catch (error) {
        // Rollback: limpar vínculos dos filhos já atualizados
        await Promise.allSettled(
          filhosVinculados.map((registroId) =>
            base44.entities.RegistroLivro.update(registroId, {
              publicacao_compilada_id: null,
              compilado_em_lote: false,
              publicacao_compilada_ordem: null,
            })
          )
        );

        // Rollback: excluir o lote pai criado
        if (loteCriado?.id) {
          try {
            await base44.entities.PublicacaoCompilada.delete(loteCriado.id);
          } catch (_deleteError) {
            // ignora erro de delete no rollback — lote órfão pode ser limpo manualmente
          }
        }

        throw error;
      }
    },
    onSuccess: async () => {
      setSelectedRegistros([]);
      await refrescarDadosPublicacoes();
      alert('Lote compilado de férias criado com sucesso.');
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao compilar registros selecionados.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tipo, registro }) => {
      if (tipo === 'publicacao-compilada') {
        if (!podeDesfazerLoteCompilado(registro)) {
          throw new Error('Publicação compilada já publicada não pode ser removida.');
        }

        await limparVinculoLoteDosFilhos({
          entity: base44.entities.RegistroLivro,
          loteId: id,
        });

        return base44.entities.PublicacaoCompilada.delete(id);
      }

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
    onSuccess: async () => {
      await Promise.all([
        refrescarDadosPublicacoes(),
        queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] }),
      ]);
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao excluir registro.');
    }
  });

  const adicionarAoLoteMutation = useMutation({
    mutationFn: async ({ loteId, registrosSelecionados }) => {
      if (!loteId) {
        throw new Error('Selecione um lote pai.');
      }

      const lotePai = todosRegistros.find(
        (item) => item.id === loteId && item.origem_tipo === 'publicacao-compilada'
      );

      if (!lotePai) {
        throw new Error('Lote pai não encontrado.');
      }

      if (isLoteCompiladoPublicado(lotePai)) {
        throw new Error('Só é permitido adicionar a um lote pai que ainda não foi publicado.');
      }

      const registrosInvalidos = registrosSelecionados.filter((registro) => (
        !isRegistroElegivelParaCompilacaoFerias(registro) ||
        !!registro?.publicacao_compilada_id ||
        registro?.compilado_em_lote === true
      ));

      if (registrosInvalidos.length > 0) {
        throw new Error('Há registro(s) selecionado(s) inelegível(is) ou já vinculado(s) a outro lote.');
      }

      const filhosAtuais = todosRegistros
        .filter((item) => item.publicacao_compilada_id === loteId)
        .sort((a, b) => (a.publicacao_compilada_ordem ?? 0) - (b.publicacao_compilada_ordem ?? 0));

      await Promise.all(
        registrosSelecionados.map((registro, index) =>
          base44.entities.RegistroLivro.update(registro.id, {
            publicacao_compilada_id: loteId,
            compilado_em_lote: true,
            publicacao_compilada_ordem: filhosAtuais.length + index + 1,
            nota_para_bg: lotePai?.nota_para_bg || '',
          })
        )
      );

      const filhosAtualizados = [...filhosAtuais, ...registrosSelecionados].map((registro, index) => ({
        ...registro,
        publicacao_compilada_id: loteId,
        compilado_em_lote: true,
        publicacao_compilada_ordem: index + 1,
        nota_para_bg: lotePai?.nota_para_bg || '',
      }));

      await base44.entities.PublicacaoCompilada.update(loteId, {
        quantidade_itens: filhosAtualizados.length,
        tipo_registro: PUBLICACAO_COMPILADA_FERIAS_TIPO,
        texto_publicacao: buildTextoCompiladoFerias(filhosAtualizados),
      });

      return true;
    },
    onSuccess: async () => {
      setSelectedRegistros([]);
      setLoteDestinoId('');
      await refrescarDadosPublicacoes();
      alert('Registro(s) adicionado(s) ao lote com sucesso.');
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao adicionar registro(s) ao lote.');
    },
  });

  const desagruparFilhoMutation = useMutation({
    mutationFn: async (registroFilho) => {
      if (!registroFilho?.publicacao_compilada_id) {
        throw new Error('Registro não está vinculado a lote compilado.');
      }

      const loteId = registroFilho.publicacao_compilada_id;

      const lote = todosRegistros.find(
        (item) => item.id === loteId && item.origem_tipo === 'publicacao-compilada'
      );
      if (!lote) {
        throw new Error('Lote pai não encontrado.');
      }

      if (isLoteCompiladoPublicado(lote)) {
        throw new Error('Publicação compilada já publicada não pode ser alterada.');
      }

      if (registroFilho.numero_bg || registroFilho.data_bg) {
        throw new Error('Registro filho já publicado não pode ser desagrupado.');
      }

      const filhosDoLote = todosRegistros
        .filter((item) => item.publicacao_compilada_id === loteId)
        .sort((a, b) => (a.publicacao_compilada_ordem ?? 0) - (b.publicacao_compilada_ordem ?? 0));

      const filhosRestantes = filhosDoLote.filter((item) => item.id !== registroFilho.id);

      if (filhosRestantes.length < 2) {
        throw new Error('Não é possível desagrupar este registro, pois o lote ficaria com menos de 2 itens.');
      }

      // Atualiza na memória a ordem dos itens restantes antes de gerar o novo texto do Lote
      const filhosRestantesAtualizados = filhosRestantes.map((filho, index) => ({
        ...filho,
        publicacao_compilada_ordem: index + 1
      }));

      await base44.entities.RegistroLivro.update(registroFilho.id, {
        publicacao_compilada_id: null,
        compilado_em_lote: false,
        publicacao_compilada_ordem: null,
        nota_para_bg: '',
        numero_bg: '',
        data_bg: '',
      });

      await Promise.all(
        filhosRestantesAtualizados.map((filho) =>
          base44.entities.RegistroLivro.update(filho.id, {
            publicacao_compilada_ordem: filho.publicacao_compilada_ordem,
          })
        )
      );

      await base44.entities.PublicacaoCompilada.update(loteId, {
        quantidade_itens: filhosRestantesAtualizados.length,
        tipo_registro: PUBLICACAO_COMPILADA_FERIAS_TIPO,
        texto_publicacao: buildTextoCompiladoFerias(filhosRestantesAtualizados),
      });

      return true;
    },
    onSuccess: async () => {
      await refrescarDadosPublicacoes();
      alert('Registro removido do lote com sucesso.');
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao desagrupar registro.');
    },
  });

  const handleDesagruparFilho = async (registro) => {
    const resultado = await desagruparFilhoMutation.mutateAsync(registro);
    return resultado;
  };

  const registrosDaAbaAtiva = useMemo(() => {
    if (abaOrigemAtiva === 'all') return registrosVisiveis;
    return registrosVisiveis.filter((registro) => registro.origem_tipo === abaOrigemAtiva);
  }, [registrosVisiveis, abaOrigemAtiva]);

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

  const registrosElegiveisParaCompilacao = useMemo(() => (
    todosRegistros.filter((registro) => isRegistroElegivelParaCompilacaoFerias(registro))
  ), [todosRegistros]);

  const elegiveisIds = useMemo(() => new Set(registrosElegiveisParaCompilacao.map((registro) => registro.id)), [registrosElegiveisParaCompilacao]);

  const selectedRegistrosDetalhados = useMemo(() => (
    todosRegistros.filter((registro) => selectedRegistros.includes(registro.id))
  ), [todosRegistros, selectedRegistros]);

  const podeCompilarSelecionados = selectedRegistrosDetalhados.length >= 2 && selectedRegistrosDetalhados.every((registro) => elegiveisIds.has(registro.id));
  const podeAdicionarSelecionadosAoLote = selectedRegistrosDetalhados.length >= 1
    && selectedRegistrosDetalhados.every((registro) => elegiveisIds.has(registro.id))
    && Boolean(loteDestinoId);

  const lotesPaisNaoPublicados = useMemo(() => (
    todosRegistros.filter((registro) => (
      registro.origem_tipo === 'publicacao-compilada' &&
      !isLoteCompiladoPublicado(registro)
    ))
  ), [todosRegistros]);

  useEffect(() => {
    setSelectedRegistros((atual) => atual.filter((id) => elegiveisIds.has(id)));
  }, [elegiveisIds]);

  const toggleRegistroSelecionado = (registroId, checked) => {
    setSelectedRegistros((atual) => {
      if (checked) {
        return atual.includes(registroId) ? atual : [...atual, registroId];
      }
      return atual.filter((id) => id !== registroId);
    });
  };

  const selecionarTodosVisiveisElegiveis = (checked) => {
    const idsVisiveis = filteredRegistros.filter((registro) => elegiveisIds.has(registro.id)).map((registro) => registro.id);
    setSelectedRegistros((atual) => {
      if (checked) {
        return Array.from(new Set([...atual, ...idsVisiveis]));
      }
      return atual.filter((id) => !idsVisiveis.includes(id));
    });
  };

  const totalElegiveisVisiveis = filteredRegistros.filter((registro) => elegiveisIds.has(registro.id)).length;
  const totalElegiveisSelecionadosVisiveis = filteredRegistros.filter((registro) => elegiveisIds.has(registro.id) && selectedRegistros.includes(registro.id)).length;

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
    if (!canAccessAction('publicar_bg') && !canAccessAction('admin_mode')) {
      alert('Ação negada: você não tem permissão para atualizar dados de publicação.');
      return;
    }

    const registro = todosRegistros.find((item) => item.id === id);
    if (isRegistroFilhoDePublicacaoCompilada(registro)) {
      const tentouEditarCamposProtegidos = ['nota_para_bg', 'numero_bg', 'data_bg', 'texto_publicacao']
        .some((campo) => Object.prototype.hasOwnProperty.call(data || {}, campo));

      if (tentouEditarCamposProtegidos) {
        alert('Registro vinculado a publicação compilada. Edite o lote pai.');
        return;
      }
    }

    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    if (!canAccessAction('admin_mode') || !modoAdmin) {
      alert('Ação restrita. Exige permissão de administração e modo admin ativo.');
      return;
    }

    const registro = todosRegistros.find(r => r.id === id);
    if (!registro) return;

    if (tipo === 'atestado') {
      alert('Atestados não podem ser excluídos pelo Controle de Publicações. Acesse o módulo de Atestados.');
      return;
    }

    if (isRegistroFilhoDePublicacaoCompilada(registro)) {
      alert('Registro vinculado a publicação compilada e não pode ser excluído isoladamente.');
      return;
    }

    if (tipo === 'publicacao-compilada' && isLoteCompiladoPublicado(registro)) {
      alert('Publicação compilada já publicada não pode ser removida.');
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

  const handleCompilarSelecionados = () => {
    const compatibilidade = validarCompatibilidadeLoteFerias(selectedRegistrosDetalhados);

    if (!compatibilidade.compativel) {
      alert(compatibilidade.motivo);
      return;
    }

    compilarMutation.mutate(selectedRegistrosDetalhados);
  };

  const handleAdicionarSelecionadosAoLote = () => {
    if (!loteDestinoId) {
      alert('Selecione um lote pai.');
      return;
    }

    adicionarAoLoteMutation.mutate({
      loteId: loteDestinoId,
      registrosSelecionados: selectedRegistrosDetalhados,
    });
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
        <section className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,95,0.12),_transparent_45%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#eef2ff_100%)] px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white px-3 py-1 text-xs font-medium text-[#1e3a5f] shadow-sm">
                  <BookOpenText className="h-3.5 w-3.5" />
                  Controle de Publicações
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">Painel Operacional de Publicações</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Consolide Livro, Ex Officio e Atestados no mesmo fluxo operacional, mantendo a leitura visual, a priorização e o acompanhamento rápido no padrão do módulo RP.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <InfoPill icon={LayoutGrid} label={`${stats.total} registros na origem selecionada`} />
                  <InfoPill icon={Sparkles} label={`${filteredRegistros.length} itens compatíveis com os filtros`} />
          {stats.inconsistentes > 0 && (
                    <InfoPill icon={ShieldAlert} label={`${stats.inconsistentes} inconsistência(s) para conferência`} tone="danger" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
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
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Filtros operacionais
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Refine a visualização sem alterar o fluxo atual de cadastro, publicação ou conferência.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{filteredRegistros.length}</span> registro(s) encontrado(s)
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr,1fr]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200">
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
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {ABAS_ORIGEM.map((aba) => {
                  const totalAba = aba.key === 'all'
                    ? registrosVisiveis.length
                    : registrosVisiveis.filter((registro) => registro.origem_tipo === aba.key).length;
                  const ativa = abaOrigemAtiva === aba.key;

                  return (
                    <button
                      key={aba.key}
                      type="button"
                      onClick={() => setAbaOrigemAtiva(aba.key)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${ativa
                        ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'}`}
                    >
                      <span>{aba.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${ativa ? 'bg-white/15 text-white' : 'border border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {totalAba}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Compilação mínima de férias</p>
                <p className="text-sm text-indigo-700">Selecione apenas registros elegíveis do Livro em status aguardando publicação. Esta fase não altera o fluxo individual existente.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-indigo-900">
                  <Checkbox
                    checked={totalElegiveisVisiveis > 0 && totalElegiveisSelecionadosVisiveis === totalElegiveisVisiveis}
                    onCheckedChange={(checked) => selecionarTodosVisiveisElegiveis(Boolean(checked))}
                    disabled={totalElegiveisVisiveis === 0}
                  />
                  <span>Selecionar elegíveis visíveis</span>
                </label>
                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                  {selectedRegistrosDetalhados.length} selecionado(s)
                </span>
                <Select value={loteDestinoId} onValueChange={setLoteDestinoId}>
                  <SelectTrigger className="w-[280px] bg-white">
                    <SelectValue placeholder="Adicionar a lote pai existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesPaisNaoPublicados.length > 0 ? (
                      lotesPaisNaoPublicados.map((lote) => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {`${lote.militar_nome || 'Lote compilado'} • ${lote.quantidade_itens || 0} item(ns)`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__sem_lotes__" disabled>
                        Nenhum lote pai disponível
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdicionarSelecionadosAoLote}
                  disabled={!podeAdicionarSelecionadosAoLote || adicionarAoLoteMutation.isPending}
                  variant="outline"
                  className="border-indigo-300 text-indigo-800 hover:bg-indigo-100"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {adicionarAoLoteMutation.isPending ? 'Adicionando...' : 'Adicionar ao lote'}
                </Button>
                <Button
                  onClick={handleCompilarSelecionados}
                  disabled={!podeCompilarSelecionados || compilarMutation.isPending}
                  className="bg-indigo-700 hover:bg-indigo-800"
                >
                  <Layers3 className="mr-2 h-4 w-4" />
                  {compilarMutation.isPending ? 'Compilando...' : 'Compilar selecionados'}
                </Button>
              </div>
            </div>
          </div>

          {stats.inconsistentes > 0 && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {stats.inconsistentes} registro(s) inconsistente(s) na aba selecionada exigem conferência operacional.
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando registros...
          </div>
        ) : filteredRegistros.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-800">Nenhum registro encontrado</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Ajuste os filtros para localizar publicações compatíveis com a busca atual.'
                : 'Os registros de publicação aparecerão aqui conforme forem disponibilizados pelas origens integradas do painel.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <InfoPill icon={Search} label="Revise os termos da busca" />
              <InfoPill icon={Filter} label="Valide status e origem selecionados" />
            </div>
          </section>
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
                    {items.map((registro) => {
                      const elegivelCompilacao = elegiveisIds.has(registro.id);
                      const selecionado = selectedRegistros.includes(registro.id);

                      return (
                        <div key={registro.id} className={`rounded-[24px] ${selecionado ? 'ring-2 ring-indigo-200' : ''}`}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-1">
                            <label className={`inline-flex items-center gap-2 text-sm font-medium ${elegivelCompilacao ? 'text-slate-700' : 'text-slate-400'}`}>
                              <Checkbox
                                checked={selecionado}
                                disabled={!elegivelCompilacao}
                                onCheckedChange={(checked) => toggleRegistroSelecionado(registro.id, Boolean(checked))}
                              />
                              <span>{elegivelCompilacao ? 'Selecionar para compilação' : (registro.compilado_em_lote ? 'Já vinculado a lote' : 'Não elegível para compilação')}</span>
                            </label>

                            {registro.compilado_em_lote && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                Lote #{registro.publicacao_compilada_ordem || '—'}
                              </span>
                            )}
                          </div>

                          <PublicacaoCard
                            registro={registro}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onDesagruparFilho={handleDesagruparFilho}
                            onVerFamilia={() => setFamiliaPanel({ open: true, registro })}
                            todosRegistros={todosRegistros}
                            isAdmin={isAdmin}
                            modoAdmin={modoAdmin}
                            canAccessAction={canAccessAction}
                          />
                        </div>
                      );
                    })}
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
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setFamiliaPanel({ open: false, registro: null })}
          />
          <FamiliaPublicacaoPanel
            registro={familiaPanel.registro}
            todosRegistros={todosRegistros}
            onClose={() => setFamiliaPanel({ open: false, registro: null })}
          />
        </>
      )}
    </div>
  );
}

function InfoPill({ icon: Icon, label, tone = 'default' }) {
  const toneClasses = {
    default: 'border-slate-200 bg-white text-slate-600',
    danger: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${toneClasses[tone] || toneClasses.default}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'slate' }) {
  const toneClasses = {
    slate: {
      icon: 'bg-[#1e3a5f]/10 text-[#1e3a5f]',
      value: 'text-[#1e3a5f]',
      ring: 'border-slate-200 bg-white',
    },
    amber: {
      icon: 'bg-amber-100 text-amber-700',
      value: 'text-amber-700',
      ring: 'border-amber-200 bg-white',
    },
    blue: {
      icon: 'bg-blue-100 text-blue-700',
      value: 'text-blue-700',
      ring: 'border-blue-200 bg-white',
    },
    emerald: {
      icon: 'bg-emerald-100 text-emerald-700',
      value: 'text-emerald-700',
      ring: 'border-emerald-200 bg-white',
    },
    red: {
      icon: 'bg-red-100 text-red-700',
      value: 'text-red-700',
      ring: 'border-red-200 bg-white',
    },
  };

  const palette = toneClasses[tone] || toneClasses.slate;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${palette.ring}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className={`rounded-xl p-2 ${palette.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={`text-2xl font-bold ${palette.value}`}>{value}</span>
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
