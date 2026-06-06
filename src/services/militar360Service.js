import { listarInconsistenciasCadastraisMilitar } from '../utils/inconsistenciasCadastrais.js';
import { auditarMilitar } from './militarAuditoriaService.js';
import { determinarStatusOperacional } from './statusOperacionalService.js';

/**
 * Monta o bundle de informações da Ficha 360º do Militar.
 * Serviço agregador frontend/read-only e puro.
 */
export function montarMilitar360Bundle({
  militar = {},
  ferias = [],
  atestados = [],
  registrosLivro = [],
  jisos = [],
  publicacoes = [],
  promocoes = [],
  medalhas = [],
  pendencias = [],
  historicoPromocoes = [],
  hoje = new Date()
} = {}) {
  // 1. Identidade
  const identidade = {
    id: militar?.id || null,
    nomeCompleto: militar?.nome_completo || 'Não informado',
    nomeGuerra: militar?.nome_guerra || 'Não informado',
    matricula: militar?.matricula || 'Sem matrícula',
    cpf: militar?.cpf || 'Não informado',
    rg: militar?.rg || 'Não informado',
    postoGraduacao: militar?.posto_graduacao || 'Não informado',
    quadro: militar?.quadro || 'Não informado',
    foto: militar?.foto || null,
  };

  // 2. Status Operacional
  // Integração com statusOperacionalService
  const statusOperacional = determinarStatusOperacional({
    jisos: jisos || [],
    atestados: atestados || [],
    ferias: ferias || [],
    licencas: registrosLivro || [],
    hoje
  });

  // 3. Saúde
  const atestadosAtivos = (atestados || []).filter(a => a.status === 'Ativo' || a.status === 'Em Curso');
  const saude = {
    possuiAtestadoVigente: atestadosAtivos.length > 0,
    ultimoAtestado: (atestados || [])[0] || null,
    quantidadeAtestadosHistorico: (atestados || []).length,
  };

  // 4. Férias
  const feriasEmCurso = (ferias || []).find(f => String(f.status).toLowerCase() === 'em curso');
  const feriasBundle = {
    emFerias: !!feriasEmCurso,
    proximasFerias: (ferias || []).find(f => new Date(f.data_inicio) > hoje) || null,
    historicoResumido: (ferias || []).slice(0, 3),
  };

  // 5. Carreira
  const carreira = {
    postoAtual: militar?.posto_graduacao || 'Não informado',
    dataUltimaPromocao: (historicoPromocoes || [])[0]?.data_promocao || null,
    proximaPromocaoEstimada: 'Não calculado', // Evolução futura
    historicoResumido: (historicoPromocoes || []).slice(0, 3),
  };

  // 6. Pendências
  const inconsistencias = listarInconsistenciasCadastraisMilitar(militar);
  const pendenciasBundle = {
    cadastrais: inconsistencias,
    funcionais: (pendencias || []).filter(p => p.tipo === 'funcional' || p.tipo_pendencia === 'funcional'),
    quantidadeTotal: inconsistencias.length + (pendencias || []).length,
  };

  // 7. Documentos
  const documentos = {
    publicacoesRecentes: (publicacoes || []).slice(0, 5),
    quantidadePublicacoes: (publicacoes || []).length,
  };

  // 8. Auditoria
  // Integração com militarAuditoriaService
  const auditoriaMilitar = auditarMilitar(militar);
  const auditoria = {
    ...auditoriaMilitar,
    dataCriacao: militar?.created_date || null,
    ultimaAtualizacao: militar?.last_modified_date || null,
    statusCadastro: militar?.status_cadastro || 'Não informado',
  };

  // 9. Resumo Executivo (Agregado para exibição rápida)
  const resumoExecutivo = {
    statusOperacional: statusOperacional.status,
    scoreCompletude: auditoriaMilitar.score,
    pendenciasCriticas: auditoriaMilitar.resumo.totalCriticos,
    pendenciasAtencao: auditoriaMilitar.resumo.totalAtencao,
    comportamento: militar?.comportamento || 'Não calculado',
    lotacao: militar?.lotacao || 'Não informado',
    funcao: militar?.funcao || 'Não informado',
    situacaoFerias: feriasBundle.emFerias ? 'Em gozo' : 'Trabalhando',
    situacaoSaude: saude.possuiAtestadoVigente ? 'Com afastamento' : 'Sem restrições',
    quantidadePendencias: pendenciasBundle.quantidadeTotal,
    ultimosRegistros: (registrosLivro || []).slice(0, 3),
  };

  return {
    identidade,
    statusOperacional,
    auditoria,
    resumoExecutivo,
    carreira,
    saude,
    ferias: feriasBundle,
    documentos,
    pendencias: pendenciasBundle
  };
}
