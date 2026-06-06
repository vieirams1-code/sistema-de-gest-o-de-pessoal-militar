import { listarInconsistenciasCadastraisMilitar } from '../utils/inconsistenciasCadastrais.js';
import { auditarMilitar } from './militarAuditoriaService.js';
import { determinarStatusOperacional } from './statusOperacionalService.js';
import { montarConsolidadoCarreira } from './militarCarreiraService.js';
import { consolidarSaudeMilitar } from './militarSaudeService.js';
import { consolidarFerias } from './militarFeriasService.js';
import { getDocumentosUnificados } from './militarDocumentosService.js';
import { calcularCompletudeMilitar } from './completudeMilitarService.js';

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
  promocoes = [], // Adicionado para suportar chamadas legadas ou específicas se houver
  medalhas = [],
  pendencias = [],
  historicoPromocoes = [],
  periodosAquisitivos = [],
  hoje = new Date()
} = {}) {
  // Garantir que usamos historicoPromocoes se promocoes vier vazio
  const listaPromocoes = (promocoes && promocoes.length > 0) ? promocoes : historicoPromocoes;

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

  // 2. Status Operacional (via statusOperacionalService)
  const statusOperacional = determinarStatusOperacional({
    jisos: jisos || [],
    atestados: atestados || [],
    ferias: ferias || [],
    licencas: registrosLivro || [],
    hoje
  });

  // 3. Saúde (via militarSaudeService)
  const saudeConsolidada = consolidarSaudeMilitar(atestados, jisos, hoje);
  const saude = {
    ...saudeConsolidada,
    possuiAtestadoVigente: saudeConsolidada.afastamentoAtivo, // Backward compatibility
    ultimoAtestado: saudeConsolidada.ultimoAtestado,
    quantidadeAtestadosHistorico: saudeConsolidada.quantidadeAtestados,
  };

  // 4. Férias (via militarFeriasService)
  const feriasConsolidadas = consolidarFerias({
    periodosAquisitivos,
    ferias,
    hoje
  });
  const feriasBundle = {
    ...feriasConsolidadas,
    emFerias: feriasConsolidadas.situacaoAtual.emGozo, // Backward compatibility
    proximasFerias: (ferias || []).find(f => new Date(f.data_inicio) > hoje) || null,
    historicoResumido: feriasConsolidadas.historico.slice(0, 3),
  };

  // 5. Carreira (via militarCarreiraService)
  const carreiraConsolidada = montarConsolidadoCarreira({
    militar,
    historicoPromocoes: listaPromocoes,
    medalhas,
    comportamento: militar?.comportamento
  });
  const carreira = {
    ...carreiraConsolidada,
    postoAtual: militar?.posto_graduacao || 'Não informado',
    dataUltimaPromocao: carreiraConsolidada.promocaoAtual?.data_promocao || null,
    proximaPromocaoEstimada: 'Não calculado',
    historicoResumido: carreiraConsolidada.historicoPromocoes.slice(0, 3),
  };

  // 6. Pendências (Legado + inconsistências calculadas)
  const inconsistencias = listarInconsistenciasCadastraisMilitar(militar);
  const pendenciasBundle = {
    cadastrais: inconsistencias,
    funcionais: (pendencias || []).filter(p => p.tipo === 'funcional' || p.tipo_pendencia === 'funcional'),
    quantidadeTotal: inconsistencias.length + (pendencias || []).length,
  };

  // 7. Documentos (via militarDocumentosService)
  const documentosUnificados = getDocumentosUnificados({
    publicacoes,
    registrosLivro,
    atestados,
    ferias,
    promocoes: listaPromocoes,
    medalhas
  });

  const documentos = {
    itens: documentosUnificados,
    quantidadeTotal: documentosUnificados.length,
    publicacoesRecentes: documentosUnificados.filter(d => d.tipo === 'Publicação').slice(0, 5),
    quantidadePublicacoes: documentosUnificados.filter(d => d.tipo === 'Publicação').length, // Backward compatibility
  };

  // 8. Auditoria (via militarAuditoriaService)
  const auditoriaMilitar = auditarMilitar(militar);
  const auditoria = {
    ...auditoriaMilitar,
    dataCriacao: militar?.created_date || null,
    ultimaAtualizacao: militar?.last_modified_date || null,
    statusCadastro: militar?.status_cadastro || 'Não informado',
  };

  // 9. Completude (via completudeMilitarService)
  const completude = calcularCompletudeMilitar(militar);

  // 10. Resumo Executivo (Agregado para exibição rápida e compatibilidade UI)
  const resumoExecutivo = {
    statusOperacional: statusOperacional.status,
    scoreCompletude: auditoriaMilitar.score,
    percentualCompletude: completude.percentual,
    pendenciasCriticas: auditoriaMilitar.resumo.totalCriticos,
    pendenciasAtencao: auditoriaMilitar.resumo.totalAtencao,
    comportamento: militar?.comportamento || 'Não calculado',
    lotacao: militar?.lotacao || 'Não informado',
    funcao: militar?.funcao || 'Não informado',
    situacaoFerias: feriasBundle.emFerias ? 'Em gozo' : 'Trabalhando',
    situacaoSaude: saude.possuiAtestadoVigente ? 'Com afastamento' : 'Sem restrições',
    quantidadePendencias: pendenciasBundle.quantidadeTotal,
    ultimosRegistros: (registrosLivro || []).slice(0, 3),
    tempoServicoTexto: carreiraConsolidada.resumoCarreira.texto,
  };

  return {
    identidade,
    statusOperacional,
    auditoria,
    completude,
    resumoExecutivo,
    carreira,
    saude,
    ferias: feriasBundle,
    documentos,
    pendencias: pendenciasBundle
  };
}
