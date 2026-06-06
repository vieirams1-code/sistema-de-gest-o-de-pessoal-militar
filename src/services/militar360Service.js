import { listarInconsistenciasCadastraisMilitar } from '../utils/inconsistenciasCadastrais.js';
import { buildAfastamentosVigentes } from './afastamentosVigentesService.js';

/**
 * Monta o bundle de informações da Ficha 360º do Militar.
 * Serviço agregador frontend/read-only e puro.
 */
export function montarMilitar360Bundle({
  militar = {},
  ferias = [],
  atestados = [],
  registrosLivro = [],
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

  // 2. Afastamentos Vigentes (Status Operacional)
  // Reutiliza a lógica existente de afastamentos
  const afastamentos = buildAfastamentosVigentes({
    atestados: atestados || [],
    ferias: ferias || [],
    registrosLivro: registrosLivro || [],
    militaresLtip: militar?.condicao === 'LTIP' ? [militar] : [],
    hoje
  });

  const estaAfastado = afastamentos.length > 0;
  const principalAfastamento = afastamentos[0] || null;

  const statusOperacional = {
    situacao: estaAfastado ? 'Afastado' : 'Disponível',
    detalhe: principalAfastamento ? principalAfastamento.tipoAfastamento : 'Pronto para o serviço',
    cor: estaAfastado ? 'orange' : 'emerald',
    afastamentosVigentes: afastamentos,
  };

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

  // 7. Documentos (Armamentos e outros registros se disponíveis)
  const documentos = {
    publicacoesRecentes: (publicacoes || []).slice(0, 5),
    quantidadePublicacoes: (publicacoes || []).length,
  };

  // 8. Auditoria
  const auditoria = {
    dataCriacao: militar?.created_date || null,
    ultimaAtualizacao: militar?.last_modified_date || null,
    statusCadastro: militar?.status_cadastro || 'Não informado',
  };

  // 9. Resumo Executivo (Agregado para exibição rápida)
  const resumoExecutivo = {
    statusOperacional: statusOperacional.situacao,
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
    resumoExecutivo,
    pendencias: pendenciasBundle,
    carreira,
    saude,
    ferias: feriasBundle,
    documentos,
    auditoria
  };
}
