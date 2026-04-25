import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { listarMilitarIdsEscopo } from '@/services/publicacoesPainelService';
import { listarPublicacoesLegadoPendentesClassificacao } from '@/services/migracaoAlteracoesLegadoService';
import { listarPendenciasPossivelDuplicidade, STATUS_POSSIVEL_DUPLICIDADE } from '@/services/militarIdentidadeService';
import {
  calcularPrioridadePorPrazo,
  diferencaDias,
  filtrarPendencias,
  montarDescricaoCurta,
  normalizarTexto,
  normalizarTipoCategoria,
  ordenarPendencias,
} from '@/utils/central-pendencias/centralPendencias.helpers';

const LIMITE_PADRAO = 1000;

const STATUS_PUBLICACAO_PENDENTE = ['aguardando publicação', 'aguardando publicacao', 'aguardando nota'];
const STATUS_ATESTADO_PENDENTE = ['aguardando homologação', 'aguardando homologacao', 'aguardando jiso'];

function parseJsonSafe(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const criarPendenciaBase = (dados) => ({
  id: dados.id,
  categoria: dados.categoria,
  categoriaSlug: normalizarTipoCategoria(dados.categoria),
  prioridade: dados.prioridade || 'media',
  situacao: dados.situacao || 'Pendente',
  titulo: dados.titulo || 'Pendência administrativa',
  descricao: dados.descricao || '',
  militar: dados.militar || '—',
  setor: dados.setor || '—',
  dataReferencia: dados.dataReferencia || '',
  origem: dados.origem || 'Módulo não identificado',
  sugestaoAcao: dados.sugestaoAcao || 'Verificar item no módulo de origem.',
  origemLink: dados.origemLink || '',
});

async function listarPorEscopo({ entidade, isAdmin, getMilitarScopeFilters, ordem = '-created_date' }) {
  if (!entidade) return [];
  if (isAdmin) {
    if (entidade.list) return entidade.list(ordem, LIMITE_PADRAO);
    return [];
  }

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length || !entidade.filter) return [];

  const arrays = await Promise.all(militarIds.map((militarId) => entidade.filter({ militar_id: militarId }, ordem)));
  const mapa = new Map();
  arrays.flat().forEach((item) => {
    if (item?.id) mapa.set(item.id, item);
  });
  return Array.from(mapa.values());
}

async function listarPublicacoesCentral({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) {
    return base44?.entities?.PublicacaoExOfficio?.list?.('-created_date', LIMITE_PADRAO) || [];
  }

  const militarIds = await listarMilitarIdsEscopo({ isAdmin, getMilitarScopeFilters });
  if (!militarIds?.length) return [];

  const arrays = await Promise.all(
    militarIds.map((id) => base44?.entities?.PublicacaoExOfficio?.filter?.({ militar_id: id }, '-created_date') || [])
  );
  const mapa = new Map();
  arrays.flat().forEach((item) => {
    if (item?.id) mapa.set(item.id, item);
  });
  return Array.from(mapa.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

function mapPublicacoesPendentes(registros = []) {
  return registros
    .filter((item) => {
      const status = normalizarTexto(item.status_canonico || item.status_calculado || item.status_publicacao || item.status);
      const semDadosBgPublicado = status.includes('publicad') && (!item.numero_bg || !item.data_bg);
      return STATUS_PUBLICACAO_PENDENTE.some((s) => status.includes(s)) || semDadosBgPublicado;
    })
    .map((item) => {
      const dataRef = item.data_bg || item.data_publicacao || item.created_date;
      const dias = diferencaDias(dataRef);
      const prioridade = calcularPrioridadePorPrazo({ diasParaVencer: dias, status: item.status || item.status_publicacao || '' });
      const situacao = item.status_canonico || item.status_publicacao || item.status || 'Aguardando publicação';
      return criarPendenciaBase({
        id: `pub-${item.id}`,
        categoria: 'Publicações',
        prioridade,
        situacao,
        titulo: item.tipo || item.tipo_registro || 'Publicação aguardando BG',
        descricao: montarDescricaoCurta({
          situacao,
          detalhe: item.numero_bg ? `BG ${item.numero_bg}` : 'Sem número/data de BG',
          dataReferencia: dataRef,
        }),
        militar: item.militar_nome || item.nome_completo_legado || '—',
        setor: item.subgrupamento_nome || item.obm_nome || '—',
        dataReferencia: dataRef,
        origem: 'Controle de Publicações',
        sugestaoAcao: 'Conferir o vínculo da nota/BG no módulo de Publicações.',
        origemLink: '/Publicacoes',
      });
    });
}

function mapAtestadosPendentes(registros = []) {
  const hoje = new Date();
  return registros
    .filter((item) => {
      const statusJiso = normalizarTexto(item.status_jiso);
      const statusPub = normalizarTexto(item.status_publicacao || item.status);
      const fim = item.data_retorno || item.data_termino;
      const dias = diferencaDias(fim, hoje);
      const vencidoSemEncerrar = dias !== null && dias < 0 && !['encerrado', 'cancelado'].includes(normalizarTexto(item.status));
      const retornoProximo = dias !== null && dias <= 7 && dias >= 0;
      const aguardandoFluxo = STATUS_ATESTADO_PENDENTE.some((s) => statusJiso.includes(s) || statusPub.includes(s));
      return aguardandoFluxo || retornoProximo || vencidoSemEncerrar;
    })
    .map((item) => {
      const dataFim = item.data_retorno || item.data_termino || item.data_inicio;
      const dias = diferencaDias(dataFim, hoje);
      const prioridade = calcularPrioridadePorPrazo({ diasParaVencer: dias, vencido: (dias ?? 0) < 0, status: item.status_jiso || item.status || '' });
      const situacao = item.status_jiso || item.status || 'Aguardando homologação';
      return criarPendenciaBase({
        id: `at-${item.id}`,
        categoria: 'Atestados',
        prioridade,
        situacao,
        titulo: item.tipo_afastamento || 'Atestado pendente',
        descricao: montarDescricaoCurta({ situacao, detalhe: item.medico || item.cid_10 || '', dataReferencia: dataFim }),
        militar: item.militar_nome || item.militar_nome_completo || '—',
        setor: item.subgrupamento_nome || item.obm_nome || '—',
        dataReferencia: dataFim,
        origem: 'Atestados',
        sugestaoAcao: 'Revisar o fluxo de homologação/JISO no módulo de Atestados.',
        origemLink: '/Atestados',
      });
    });
}

function mapFeriasPendentes(ferias = [], registrosLivro = []) {
  return ferias
    .filter((item) => {
      const status = normalizarTexto(item.status);
      const emCurso = status === 'em curso';
      const interrompida = status === 'interrompida';
      const semPrevisao = !item.data_inicio && ['prevista', 'autorizada'].includes(status);
      const dataLimite = item.data_limite_gozo || item.data_fim_periodo_concessivo || item.data_fim_periodo_aquisitivo;
      const diasPrazo = diferencaDias(dataLimite);
      const proximoVencimento = diasPrazo !== null && diasPrazo <= 30;

      const temInterrupcaoSemContinuacao = (() => {
        if (!item?.id) return false;
        const eventos = registrosLivro
          .filter((r) => r?.ferias_id === item.id)
          .sort((a, b) => new Date(a.data_registro || 0) - new Date(b.data_registro || 0));
        if (!eventos.length) return false;
        const ultimo = eventos[eventos.length - 1];
        return normalizarTexto(ultimo.tipo_registro) === 'interrupção de férias' || normalizarTexto(ultimo.tipo_registro) === 'interrupcao de ferias';
      })();

      return emCurso || interrompida || semPrevisao || proximoVencimento || temInterrupcaoSemContinuacao;
    })
    .map((item) => {
      const dataRef = item.data_inicio || item.data_limite_gozo || item.data_fim_periodo_concessivo || item.created_date;
      const dias = diferencaDias(dataRef);
      const prioridade = calcularPrioridadePorPrazo({ diasParaVencer: dias, status: item.status || '' });
      const situacao = item.status || 'Sem status';
      return criarPendenciaBase({
        id: `fe-${item.id}`,
        categoria: 'Férias',
        prioridade,
        situacao,
        titulo: item.tipo || 'Férias críticas',
        descricao: montarDescricaoCurta({ situacao, detalhe: item.periodo_aquisitivo_ref || '', dataReferencia: dataRef }),
        militar: item.militar_nome || item.militar_nome_completo || '—',
        setor: item.subgrupamento_nome || item.obm_nome || '—',
        dataReferencia: dataRef,
        origem: 'Férias',
        sugestaoAcao: 'Conferir cadeia operacional e prazos no módulo de Férias.',
        origemLink: '/Ferias',
      });
    });
}

function mapComportamentoPendencias(registros = []) {
  return registros
    .filter((item) => {
      const status = normalizarTexto(item.status_pendencia || item.status);
      const divergente = normalizarTexto(item.comportamento_atual) && normalizarTexto(item.comportamento_sugerido)
        && normalizarTexto(item.comportamento_atual) !== normalizarTexto(item.comportamento_sugerido);
      return status.includes('pendente') || status.includes('aguardando') || divergente;
    })
    .map((item) => criarPendenciaBase({
      id: `co-${item.id}`,
      categoria: 'Comportamento',
      prioridade: item.comportamento_atual !== item.comportamento_sugerido ? 'alta' : 'media',
      situacao: item.status_pendencia || item.status || 'Pendente',
      titulo: 'Pendência disciplinar',
      descricao: montarDescricaoCurta({
        situacao: item.status_pendencia || item.status,
        detalhe: `${item.comportamento_atual || 'N/D'} → ${item.comportamento_sugerido || 'N/D'}`,
        dataReferencia: item.data_detectada || item.created_date,
      }),
      militar: item.militar_nome || '—',
      setor: item.subgrupamento_nome || '—',
      dataReferencia: item.data_detectada || item.created_date,
      origem: 'Controle de Comportamento',
      sugestaoAcao: 'Validar análise/aprovação no módulo de Avaliação de Comportamento.',
      origemLink: '/AvaliacaoComportamento',
    }));
}

function mapLegadoPendencias(publicacoesLegado = [], duplicidades = []) {
  const pendenciasClassificacao = (publicacoesLegado || []).map((item) => criarPendenciaBase({
    id: `le-pub-${item.id}`,
    categoria: 'Legado/Outros',
    prioridade: 'media',
    situacao: 'Classificação pendente',
    titulo: item.materia_legado || 'Registro legado não classificado',
    descricao: montarDescricaoCurta({ situacao: 'LEGADO_NAO_CLASSIFICADO', detalhe: item.nota_id_legado || item.tipo_bg_legado || '', dataReferencia: item.created_date }),
    militar: item.militar_nome || item.nome_completo_legado || '—',
    setor: item.subgrupamento_nome || '—',
    dataReferencia: item.created_date,
    origem: 'Migração de Alterações Legado',
    sugestaoAcao: 'Classificar publicação no fluxo de pendentes do legado.',
    origemLink: '/ClassificacaoPendentesLegado',
  }));

  const fluxoLabel = (origemFluxo = '') => {
    const fluxo = normalizarTexto(origemFluxo);
    if (fluxo.includes('edicao_manual')) return 'Edição manual';
    if (fluxo.includes('manual')) return 'Cadastro manual';
    if (fluxo.includes('importacao') || fluxo.includes('legado')) return 'Legado/Importação';
    return 'Origem não identificada';
  };

  const normalizarChaveDuplicidade = (value = '') => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const apenasDigitos = (value = '') => String(value || '').replace(/\D/g, '');

  const extrairDadosChave = (item = {}) => {
    const payload = parseJsonSafe(item.payload_novo_cadastro);
    const snapshot = parseJsonSafe(item.snapshot_comparativo);
    const militarExistente = snapshot?.militar_existente || {};
    const militarCandidato = snapshot?.militar_candidato || {};

    const matricula = [
      payload?.matricula,
      militarCandidato?.matricula,
      militarExistente?.matricula,
    ].map((v) => apenasDigitos(v)).find(Boolean) || '';

    const cpf = [
      payload?.cpf,
      militarCandidato?.cpf,
      militarExistente?.cpf,
    ].map((v) => apenasDigitos(v)).find((v) => v.length === 11) || '';

    const nomeCompleto = [
      payload?.nome_completo,
      payload?.nome_canonico,
      militarCandidato?.nome_completo,
      militarExistente?.nome_completo,
    ].map((v) => normalizarChaveDuplicidade(v)).find(Boolean) || '';

    if (matricula) return { tipo: 'matricula', valor: matricula };
    if (cpf) return { tipo: 'cpf', valor: cpf };
    if (nomeCompleto) return { tipo: 'nome completo', valor: nomeCompleto };
    return { tipo: 'registro sem chave identificável', valor: String(item.id || '') };
  };

  const formatarMatricula = (digits = '') => {
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  };

  const formatarCPF = (digits = '') => {
    if (!digits || digits.length !== 11) return digits;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const formatarChave = ({ tipo, valor }) => {
    if (tipo === 'matricula') return `${tipo} ${formatarMatricula(valor)}`;
    if (tipo === 'cpf') return `${tipo} ${formatarCPF(valor)}`;
    return `${tipo} ${valor}`;
  };

  const gruposDuplicidade = new Map();
  (duplicidades || []).forEach((item) => {
    const chaveLogica = extrairDadosChave(item);
    const chaveGrupo = `${chaveLogica.tipo}:${chaveLogica.valor}`;
    if (!gruposDuplicidade.has(chaveGrupo)) {
      gruposDuplicidade.set(chaveGrupo, {
        chaveLogica,
        itens: [],
        origens: new Map(),
      });
    }
    const grupo = gruposDuplicidade.get(chaveGrupo);
    grupo.itens.push(item);
    const origem = fluxoLabel(item.origem_fluxo);
    grupo.origens.set(origem, (grupo.origens.get(origem) || 0) + 1);
  });

  const pendenciasDuplicidade = Array.from(gruposDuplicidade.entries()).map(([chaveGrupo, grupo]) => {
    const ultimoRegistro = grupo.itens.reduce((maisRecente, atual) => {
      const dataAtual = new Date(atual.created_at || atual.created_date || 0).getTime();
      const dataMaisRecente = new Date(maisRecente.created_at || maisRecente.created_date || 0).getTime();
      return dataAtual > dataMaisRecente ? atual : maisRecente;
    }, grupo.itens[0]);

    const detalhamentoOrigem = Array.from(grupo.origens.entries())
      .map(([origem, quantidade]) => `${origem}: ${quantidade}`)
      .join(' • ');

    return criarPendenciaBase({
      id: `le-dup-agrupado-${chaveGrupo}`,
      categoria: 'Legado/Outros',
      prioridade: 'alta',
      situacao: 'Duplicidade pendente',
      titulo: `Conflitos de cadastro para ${formatarChave(grupo.chaveLogica)} (${grupo.itens.length} ocorrências)`,
      descricao: montarDescricaoCurta({
        situacao: ultimoRegistro?.status || 'Pendente',
        detalhe: `Origens: ${detalhamentoOrigem}`,
        dataReferencia: ultimoRegistro?.created_at || ultimoRegistro?.created_date,
      }),
      militar: '—',
      setor: '—',
      dataReferencia: ultimoRegistro?.created_at || ultimoRegistro?.created_date,
      origem: 'Revisão de Duplicidades',
      sugestaoAcao: 'Revisar e tratar no módulo de revisão de duplicidades.',
      origemLink: '/RevisaoDuplicidadesMilitar',
    });
  });

  return [...pendenciasClassificacao, ...pendenciasDuplicidade];
}

export default function useCentralPendencias() {
  const { isAdmin, canAccessAll, getMilitarScopeFilters, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({ categoria: 'todas', prioridade: 'todas', situacao: 'todas', texto: '', ordenacao: 'prioridade_desc' });

  const query = useQuery({
    queryKey: ['central-pendencias', isAdmin],
    enabled: isAccessResolved,
    queryFn: async () => {
      const podeVerLegadoDuplicidade = Boolean(isAdmin || canAccessAll);
      const resultados = await Promise.allSettled([
        listarPublicacoesCentral({ isAdmin, getMilitarScopeFilters }),
        listarPorEscopo({ entidade: base44?.entities?.Atestado, isAdmin, getMilitarScopeFilters }),
        listarPorEscopo({ entidade: base44?.entities?.Ferias, isAdmin, getMilitarScopeFilters, ordem: '-data_inicio' }),
        listarPorEscopo({ entidade: base44?.entities?.RegistroLivro, isAdmin, getMilitarScopeFilters }),
        listarPorEscopo({ entidade: base44?.entities?.PendenciaComportamento, isAdmin, getMilitarScopeFilters }),
        podeVerLegadoDuplicidade ? listarPublicacoesLegadoPendentesClassificacao() : Promise.resolve([]),
        podeVerLegadoDuplicidade ? listarPendenciasPossivelDuplicidade({ status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE }) : Promise.resolve([]),
      ]);

      const [pubR, atR, feR, rlR, coR, leR, duR] = resultados;

      const errosCategorias = [];
      if (pubR.status === 'rejected') errosCategorias.push('Publicações');
      if (atR.status === 'rejected') errosCategorias.push('Atestados');
      if (feR.status === 'rejected') errosCategorias.push('Férias');
      if (coR.status === 'rejected') errosCategorias.push('Comportamento');
      if (leR.status === 'rejected' || duR.status === 'rejected') errosCategorias.push('Legado/Outros');

      const pendencias = [
        ...mapPublicacoesPendentes(pubR.status === 'fulfilled' ? pubR.value : []),
        ...mapAtestadosPendentes(atR.status === 'fulfilled' ? atR.value : []),
        ...mapFeriasPendentes(feR.status === 'fulfilled' ? feR.value : [], rlR.status === 'fulfilled' ? rlR.value : []),
        ...mapComportamentoPendencias(coR.status === 'fulfilled' ? coR.value : []),
        ...mapLegadoPendencias(leR.status === 'fulfilled' ? leR.value : [], duR.status === 'fulfilled' ? duR.value : []),
      ];

      return { pendencias, errosCategorias };
    },
  });

  const pendenciasFiltradas = useMemo(() => {
    const lista = filtrarPendencias(query.data?.pendencias || [], filtros);
    return ordenarPendencias(lista, filtros.ordenacao);
  }, [query.data?.pendencias, filtros]);

  const resumo = useMemo(() => {
    const itens = query.data?.pendencias || [];
    return {
      total: itens.length,
      criticas: itens.filter((p) => p.prioridade === 'critica').length,
      alta: itens.filter((p) => p.prioridade === 'alta').length,
      publicacoes: itens.filter((p) => p.categoriaSlug === 'publicacoes').length,
      atestados: itens.filter((p) => p.categoriaSlug === 'atestados').length,
      ferias: itens.filter((p) => p.categoriaSlug === 'ferias').length,
      legadoOutros: itens.filter((p) => ['legado', 'outros'].includes(p.categoriaSlug)).length,
    };
  }, [query.data?.pendencias]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    pendencias: pendenciasFiltradas,
    resumo,
    filtros,
    setFiltros,
    refetch: query.refetch,
    errosCategorias: query.data?.errosCategorias || [],
  };
}
