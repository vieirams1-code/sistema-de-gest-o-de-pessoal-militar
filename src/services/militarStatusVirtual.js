/**
 * Serviço central de POSTO VIRTUAL (Fase 2A — Cursos de Formação).
 *
 * Princípio obrigatório: a matrícula em curso NÃO altera Militar.posto_graduacao,
 * Militar.quadro nem o Histórico de Promoções. O posto virtual é APENAS uma
 * camada de exibição derivada do vínculo ativo do militar a um curso de formação.
 *
 * Regra de posto virtual (somente curso ativo e status aplicável):
 *  - CFC + status em_curso/aguardando_nova_etapa  -> "Aluno a Cabo"
 *  - CFS + status em_curso/aguardando_nova_etapa   -> "Aluno a Sargento"
 *
 * Status que NÃO geram posto virtual (volta ao posto real):
 *  - aprovado, reprovado, desligado, promovido.
 */

export const ALUNO_CABO = 'Aluno a Cabo';
export const ALUNO_SARGENTO = 'Aluno a Sargento';

// Status do participante que mantêm o posto virtual ativo.
export const STATUS_POSTO_VIRTUAL = ['em_curso', 'aguardando_nova_etapa'];

const ALUNO_LABEL_POR_TIPO = {
  CFC: ALUNO_CABO,
  CFS: ALUNO_SARGENTO,
};

/**
 * Encontra o participante ativo (se houver) dentre os vínculos informados.
 * "Ativo" = status em em_curso/aguardando_nova_etapa.
 * @param {Array} participantesAtivos lista de ParticipanteCursoFormacao do militar
 * @returns {object|null}
 */
function encontrarParticipanteComPostoVirtual(participantesAtivos) {
  if (!Array.isArray(participantesAtivos)) return null;
  return (
    participantesAtivos.find((p) => p && STATUS_POSTO_VIRTUAL.includes(p.status) && ALUNO_LABEL_POR_TIPO[p.tipo_curso]) || null
  );
}

/**
 * Resolve o estado de exibição do militar considerando vínculo de curso.
 * Não muta nem o militar nem os participantes.
 */
export function resolverStatusMilitarComCurso(militar, participantesAtivos) {
  const postoReal = militar?.posto_graduacao || '';
  const quadroReal = militar?.quadro || '';

  const participante = encontrarParticipanteComPostoVirtual(participantesAtivos);

  if (!participante) {
    return {
      posto_real: postoReal,
      posto_exibicao: postoReal,
      quadro_real: quadroReal,
      quadro_exibicao: quadroReal,
      possui_posto_virtual: false,
      tipo_curso: null,
      curso_id: null,
      participante_id: null,
      status_curso: null,
      motivo_exibicao: 'posto_real',
    };
  }

  const postoVirtual = ALUNO_LABEL_POR_TIPO[participante.tipo_curso];

  return {
    posto_real: postoReal,
    posto_exibicao: postoVirtual,
    quadro_real: quadroReal,
    quadro_exibicao: quadroReal, // o quadro não muda no posto virtual
    possui_posto_virtual: true,
    tipo_curso: participante.tipo_curso,
    curso_id: participante.curso_id || null,
    participante_id: participante.id || null,
    status_curso: participante.status,
    motivo_exibicao: `${participante.tipo_curso} ativo`,
  };
}

export function getPostoExibicaoMilitar(militar, participantesAtivos) {
  return resolverStatusMilitarComCurso(militar, participantesAtivos).posto_exibicao;
}

export function getQuadroExibicaoMilitar(militar, participantesAtivos) {
  return resolverStatusMilitarComCurso(militar, participantesAtivos).quadro_exibicao;
}

/**
 * Retorna metadados de decoração para a UI (ex.: badge de curso ativo).
 */
export function getDecoracaoCursoMilitar(militar, participantesAtivos) {
  const status = resolverStatusMilitarComCurso(militar, participantesAtivos);
  if (!status.possui_posto_virtual) return null;
  return {
    label: status.posto_exibicao,
    tipo_curso: status.tipo_curso,
    origem: status.motivo_exibicao,
  };
}

/* ----------------------------------------------------------------------------
 * ORDENAÇÃO VIRTUAL (comparadora)
 *
 * Usa a hierarquia institucional COMPLETA (constants/postosGraduacoes) e apenas
 * INSERE as posições virtuais nos pontos corretos:
 *   ... Soldado < Aluno a Cabo < Cabo < Aluno a Sargento < 3º Sargento < ...
 *
 * Estratégia: o peso de cada posto oficial é o seu índice na hierarquia
 * multiplicado por 10. As posições virtuais recebem um peso intermediário
 * (índice do posto imediatamente inferior * 10 + 5), preservando todos os
 * demais postos oficiais inalterados.
 * -------------------------------------------------------------------------- */

import { POSTOS_GRADUACOES_HIERARQUIA } from '../constants/postosGraduacoes.js';

const PESO_POSTO_OFICIAL = new Map(
  POSTOS_GRADUACOES_HIERARQUIA.map((posto, indice) => [posto, indice * 10]),
);

// Posições virtuais inseridas logo acima do posto base correspondente.
const PESO_POSTO_VIRTUAL = {
  [ALUNO_CABO]: (PESO_POSTO_OFICIAL.get('Soldado') ?? 0) + 5, // entre Soldado e Cabo
  [ALUNO_SARGENTO]: (PESO_POSTO_OFICIAL.get('Cabo') ?? 0) + 5, // entre Cabo e 3º Sargento
};

function pesoPostoVirtual(posto) {
  if (posto in PESO_POSTO_VIRTUAL) return PESO_POSTO_VIRTUAL[posto];
  if (PESO_POSTO_OFICIAL.has(posto)) return PESO_POSTO_OFICIAL.get(posto);
  return Number.MAX_SAFE_INTEGER; // postos desconhecidos vão para o fim
}

/**
 * Comparador para ordenação por posto de exibição (hierarquia virtual).
 * Itens com mesmo posto (ex.: alunos do mesmo curso) são desempatados por
 * snapshot_antiguidade e, em seguida, ordem_antiguidade_origem (menor = mais antigo).
 *
 * Cada item deve expor: { posto_exibicao, snapshot_antiguidade, ordem_antiguidade_origem }
 */
export function compararPorPostoVirtual(a, b) {
  const pesoA = pesoPostoVirtual(a?.posto_exibicao);
  const pesoB = pesoPostoVirtual(b?.posto_exibicao);
  if (pesoA !== pesoB) return pesoA - pesoB;

  const antA = a?.snapshot_antiguidade ?? a?.ordem_antiguidade_origem ?? Number.MAX_SAFE_INTEGER;
  const antB = b?.snapshot_antiguidade ?? b?.ordem_antiguidade_origem ?? Number.MAX_SAFE_INTEGER;
  if (antA !== antB) return antA - antB;

  const ordA = a?.ordem_antiguidade_origem ?? Number.MAX_SAFE_INTEGER;
  const ordB = b?.ordem_antiguidade_origem ?? Number.MAX_SAFE_INTEGER;
  return ordA - ordB;
}