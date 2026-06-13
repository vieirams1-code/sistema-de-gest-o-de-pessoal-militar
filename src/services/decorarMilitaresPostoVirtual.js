import { base44 as defaultBase44 } from '@/api/base44Client';
import { resolverStatusMilitarComCurso } from './militarStatusVirtual.js';

/**
 * Decorador de POSTO VIRTUAL para o Efetivo / Consulta Militar (Fase 2B).
 *
 * Carrega os participantes de cursos de formação com status ativo
 * (em_curso / aguardando_nova_etapa), resolve o posto virtual de cada militar
 * via militarStatusVirtual e devolve uma NOVA lista de militares enriquecida.
 *
 * NUNCA altera Militar.posto_graduacao, Militar.quadro nem o Histórico de Promoções
 * — apenas adiciona campos derivados de exibição.
 */

let base44 = defaultBase44;

export function __setDecoradorClientForTests(client) {
  base44 = client;
}

export function __resetDecoradorClientForTests() {
  base44 = defaultBase44;
}

const STATUS_ATIVOS = ['em_curso', 'aguardando_nova_etapa'];

/**
 * Busca participantes ativos e indexa o curso de cada um por tipo (CFC/CFS).
 * Retorna um Map militar_id -> participante decorado com tipo_curso.
 */
export async function carregarParticipantesAtivosPorMilitar() {
  const participantes = await base44.entities.ParticipanteCursoFormacao.filter({
    status: { $in: STATUS_ATIVOS },
  });

  if (!Array.isArray(participantes) || participantes.length === 0) {
    return new Map();
  }

  // Carrega os cursos referenciados (somente os necessários) para obter o tipo.
  const cursoIds = [...new Set(participantes.map((p) => p?.curso_id).filter(Boolean))];
  const cursos = cursoIds.length
    ? await base44.entities.CursoFormacao.filter({ id: { $in: cursoIds } })
    : [];
  const cursoById = new Map((cursos || []).map((c) => [String(c.id), c]));

  const CURSOS_ATIVOS = ['aberto', 'em_andamento'];
  const mapa = new Map();
  for (const p of participantes) {
    const curso = cursoById.get(String(p?.curso_id));
    // Só aplica posto virtual se o curso ainda estiver ativo (aberto/em_andamento).
    if (!curso || !CURSOS_ATIVOS.includes(curso.status)) continue;
    mapa.set(String(p.militar_id), { ...p, tipo_curso: curso.tipo });
  }
  return mapa;
}

/**
 * Retorna os militar_id (string) em curso de formação ativo, opcionalmente
 * filtrados por tipo de curso ('CFC' | 'CFS'). Usado para mesclar alunos que
 * não estejam na página carregada ao buscar por posto virtual.
 * @param {Map} participantesPorMilitar Map militar_id -> participante (com tipo_curso)
 * @param {{ tipo?: 'CFC'|'CFS' }} [opcoes]
 */
export function listarMilitarIdsEmCursoAtivo(participantesPorMilitar, { tipo } = {}) {
  const mapa = participantesPorMilitar instanceof Map ? participantesPorMilitar : new Map();
  const ids = [];
  for (const [militarId, participante] of mapa.entries()) {
    if (tipo && String(participante?.tipo_curso || '') !== tipo) continue;
    if (militarId) ids.push(String(militarId));
  }
  return ids;
}

/**
 * Decora uma lista de militares com os campos derivados de posto virtual.
 * @param {Array} militares
 * @param {Map} participantesPorMilitar Map militar_id -> participante (com tipo_curso)
 */
export function decorarMilitares(militares, participantesPorMilitar) {
  if (!Array.isArray(militares)) return [];
  const mapa = participantesPorMilitar instanceof Map ? participantesPorMilitar : new Map();

  return militares.map((militar) => {
    const participante = mapa.get(String(militar?.id || ''));
    const status = resolverStatusMilitarComCurso(militar, participante ? [participante] : []);

    return {
      ...militar,
      posto_graduacao_real: status.posto_real,
      posto_graduacao_exibicao: status.posto_exibicao,
      quadro_real: status.quadro_real,
      possui_posto_virtual: status.possui_posto_virtual,
      tipo_curso_formacao: status.tipo_curso,
      curso_formacao_id: status.curso_id,
      status_curso_formacao: status.status_curso,
      // Antiguidade do curso para desempate na ordenação virtual.
      snapshot_antiguidade: participante?.snapshot_antiguidade ?? null,
      ordem_antiguidade_origem: participante?.ordem_antiguidade_origem ?? null,
    };
  });
}

/**
 * Conveniência: carrega participantes ativos e decora a lista em uma chamada.
 */
export async function decorarMilitaresComPostoVirtual(militares) {
  const mapa = await carregarParticipantesAtivosPorMilitar();
  return decorarMilitares(militares, mapa);
}