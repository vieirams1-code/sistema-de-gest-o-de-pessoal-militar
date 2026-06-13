import { base44 as defaultBase44 } from '@/api/base44Client';

let base44 = defaultBase44;

export function __setCursoFormacaoClientForTests(client) {
  base44 = client;
}

export function __resetCursoFormacaoClientForTests() {
  base44 = defaultBase44;
}

/**
 * cursoFormacaoService — Módulo de Cursos de Formação (Fase 1)
 * ----------------------------------------------------------------------------
 * Curso de Formação representa uma situação TRANSITÓRIA.
 * Este service NUNCA altera:
 *   - Militar.posto_graduacao
 *   - Militar.quadro
 *   - Histórico de Promoções
 *
 * Promoções definitivas continuam exclusivamente no módulo de Promoções.
 * ----------------------------------------------------------------------------
 */

const ENTITY_CURSO = 'CursoFormacao';
const ENTITY_PARTICIPANTE = 'ParticipanteCursoFormacao';
const ENTITY_AUDIT = 'AuditCursoFormacao';

export const STATUS_FINAIS_PARTICIPANTE = ['reprovado', 'desligado', 'promovido'];
export const STATUS_PENDENTES_PARTICIPANTE = ['em_curso', 'aguardando_nova_etapa'];
export const STATUS_QUE_EXIGEM_JUSTIFICATIVA = ['reprovado', 'desligado', 'aguardando_nova_etapa'];
export const STATUS_PARTICIPANTE_EDITAVEIS = ['aprovado', 'reprovado', 'desligado', 'aguardando_nova_etapa'];
const CURSOS_ATIVOS = ['aberto', 'em_andamento'];

// ============================================================
// Auditoria
// ============================================================
export async function registrarAuditoriaCursoFormacao(registro, usuario) {
  const payload = {
    ...registro,
    usuario_id: usuario?.id || null,
    usuario_nome: usuario?.full_name || usuario?.email || null,
    data_hora: new Date().toISOString(),
  };
  return base44.entities[ENTITY_AUDIT].create(payload);
}

export async function listarAuditoriaCurso(cursoId) {
  const query = cursoId ? { curso_id: cursoId } : {};
  return base44.entities[ENTITY_AUDIT].list({ query, sort: '-data_hora' });
}

// ============================================================
// Cursos
// ============================================================
export async function listarCursosFormacao(filtros = {}) {
  return base44.entities[ENTITY_CURSO].list({ query: filtros, sort: '-created_date' });
}

export async function obterCursoFormacao(cursoId) {
  return base44.entities[ENTITY_CURSO].get(cursoId);
}

export async function criarCursoFormacao(dados, usuario) {
  if (!dados?.nome?.trim()) throw new Error('O nome do curso é obrigatório.');
  if (!['CFC', 'CFS'].includes(dados?.tipo)) throw new Error('Tipo do curso inválido. Use CFC ou CFS.');

  const curso = await base44.entities[ENTITY_CURSO].create({
    ...dados,
    status: dados.status || 'aberto',
  });

  await registrarAuditoriaCursoFormacao({
    curso_id: curso.id,
    acao: 'criar_curso',
    status_novo: curso.status,
    dados_novos: dados,
  }, usuario);

  return curso;
}

export async function atualizarCursoFormacao(cursoId, dados, usuario) {
  const anterior = await base44.entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await base44.entities[ENTITY_CURSO].update(cursoId, dados);

  await registrarAuditoriaCursoFormacao({
    curso_id: cursoId,
    acao: 'atualizar_curso',
    status_anterior: anterior?.status,
    status_novo: atualizado?.status,
    dados_anteriores: anterior,
    dados_novos: dados,
  }, usuario);

  return atualizado;
}

export async function cancelarCursoFormacao(cursoId, justificativa, usuario) {
  const participantes = await listarParticipantesCurso(cursoId);
  const temPromovido = participantes.some((p) => p.status === 'promovido');
  if (temPromovido) {
    throw new Error('Não é possível cancelar um curso que já possui participantes promovidos.');
  }

  const anterior = await base44.entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await base44.entities[ENTITY_CURSO].update(cursoId, { status: 'cancelado' });

  await registrarAuditoriaCursoFormacao({
    curso_id: cursoId,
    acao: 'cancelar_curso',
    status_anterior: anterior?.status,
    status_novo: 'cancelado',
    justificativa,
  }, usuario);

  return atualizado;
}

export async function encerrarCursoFormacao(cursoId, usuario) {
  const participantes = await listarParticipantesCurso(cursoId);
  const pendentes = participantes.filter((p) => STATUS_PENDENTES_PARTICIPANTE.includes(p.status));
  if (pendentes.length > 0) {
    throw new Error(
      `Não é possível encerrar o curso: existem ${pendentes.length} participante(s) com status pendente (em_curso ou aguardando_nova_etapa).`,
    );
  }

  const anterior = await base44.entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await base44.entities[ENTITY_CURSO].update(cursoId, { status: 'encerrado' });

  await registrarAuditoriaCursoFormacao({
    curso_id: cursoId,
    acao: 'encerrar_curso',
    status_anterior: anterior?.status,
    status_novo: 'encerrado',
  }, usuario);

  return atualizado;
}

// ============================================================
// Participantes
// ============================================================
export async function listarParticipantesCurso(cursoId) {
  if (!cursoId) return [];
  return base44.entities[ENTITY_PARTICIPANTE].list({
    query: { curso_id: cursoId },
    sort: 'snapshot_antiguidade',
  });
}

/**
 * Adiciona um ou mais militares ao curso, capturando snapshot do cadastro atual.
 * NÃO altera o cadastro do Militar.
 */
export async function adicionarParticipantesCurso(cursoId, militares, usuario) {
  if (!cursoId) throw new Error('Curso inválido.');
  const lista = Array.isArray(militares) ? militares : [militares];
  if (lista.length === 0) return [];

  // Participantes já existentes neste curso (impede duplicidade no mesmo curso)
  const existentesNoCurso = await listarParticipantesCurso(cursoId);
  const idsNoCurso = new Set(existentesNoCurso.map((p) => p.militar_id));

  const maxAntiguidade = existentesNoCurso.reduce(
    (max, p) => Math.max(max, Number(p.snapshot_antiguidade) || 0),
    0,
  );

  const criados = [];
  let proximaOrdem = maxAntiguidade;

  for (const militar of lista) {
    const militarId = militar?.id;
    if (!militarId) throw new Error('Militar inválido (sem id).');

    if (idsNoCurso.has(militarId)) {
      throw new Error(`O militar ${militar.nome_completo || militarId} já está neste curso.`);
    }

    // Impede militar em dois cursos de formação ativos simultaneamente
    const vinculos = await base44.entities[ENTITY_PARTICIPANTE].list({
      query: { militar_id: militarId },
    });
    for (const vinculo of vinculos) {
      if (STATUS_PENDENTES_PARTICIPANTE.includes(vinculo.status) && vinculo.curso_id !== cursoId) {
        const outroCurso = await base44.entities[ENTITY_CURSO].get(vinculo.curso_id).catch(() => null);
        if (!outroCurso || CURSOS_ATIVOS.includes(outroCurso.status)) {
          throw new Error(
            `O militar ${militar.nome_completo || militarId} já está em outro curso de formação ativo.`,
          );
        }
      }
    }

    proximaOrdem += 1;
    const participante = await base44.entities[ENTITY_PARTICIPANTE].create({
      curso_id: cursoId,
      militar_id: militarId,
      nome_militar_snapshot: militar.nome_completo || militar.nome_guerra || '',
      matricula_snapshot: militar.matricula || '',
      posto_origem: militar.posto_graduacao || '',
      quadro_origem: militar.quadro || '',
      ordem_antiguidade_origem: Number(militar.ordem_antiguidade) || null,
      snapshot_antiguidade: proximaOrdem,
      status: 'em_curso',
      data_status_atual: new Date().toISOString(),
    });

    await registrarAuditoriaCursoFormacao({
      curso_id: cursoId,
      participante_id: participante.id,
      militar_id: militarId,
      acao: 'adicionar_participante',
      status_novo: 'em_curso',
      dados_novos: {
        nome: participante.nome_militar_snapshot,
        matricula: participante.matricula_snapshot,
        posto_origem: participante.posto_origem,
      },
    }, usuario);

    idsNoCurso.add(militarId);
    criados.push(participante);
  }

  return criados;
}

export async function alterarStatusParticipanteCurso(participanteId, novoStatus, justificativa, usuario) {
  if (!STATUS_PARTICIPANTE_EDITAVEIS.includes(novoStatus)) {
    throw new Error(`Status "${novoStatus}" não pode ser definido manualmente nesta fase.`);
  }
  if (STATUS_QUE_EXIGEM_JUSTIFICATIVA.includes(novoStatus) && !justificativa?.trim()) {
    throw new Error('Justificativa é obrigatória para reprovado, desligado ou aguardando nova etapa.');
  }

  const anterior = await base44.entities[ENTITY_PARTICIPANTE].get(participanteId);
  const atualizado = await base44.entities[ENTITY_PARTICIPANTE].update(participanteId, {
    status: novoStatus,
    data_status_atual: new Date().toISOString(),
    ...(justificativa?.trim() ? { observacoes: justificativa.trim() } : {}),
  });

  await registrarAuditoriaCursoFormacao({
    curso_id: anterior?.curso_id,
    participante_id: participanteId,
    militar_id: anterior?.militar_id,
    acao: 'alterar_status',
    status_anterior: anterior?.status,
    status_novo: novoStatus,
    justificativa,
  }, usuario);

  return atualizado;
}

/**
 * Remove participante apenas se ainda não houve movimentação (continua em_curso).
 */
export async function removerParticipanteCurso(participanteId, usuario) {
  const participante = await base44.entities[ENTITY_PARTICIPANTE].get(participanteId);
  if (participante?.status !== 'em_curso') {
    throw new Error('Só é possível remover participantes que ainda estão em curso (sem movimentação de status).');
  }

  await base44.entities[ENTITY_PARTICIPANTE].delete(participanteId);

  await registrarAuditoriaCursoFormacao({
    curso_id: participante?.curso_id,
    participante_id: participanteId,
    militar_id: participante?.militar_id,
    acao: 'remover_participante',
    status_anterior: participante?.status,
    dados_anteriores: {
      nome: participante?.nome_militar_snapshot,
      matricula: participante?.matricula_snapshot,
    },
  }, usuario);

  return true;
}