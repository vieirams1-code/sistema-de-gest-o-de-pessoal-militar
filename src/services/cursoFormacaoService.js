// O client real é resolvido de forma preguiçosa via Vite (alias @/api/base44Client).
// Mantemos a resolução tolerante para permitir injeção de dependência nos testes
// (node:test não resolve o alias @/), sem alterar o comportamento em produção.
let base44 = null;

async function resolverClientPadrao() {
  if (base44) return base44;
  const mod = await import('@/api/base44Client');
  base44 = mod.base44;
  return base44;
}

export function __setCursoFormacaoClientForTests(client) {
  base44 = client;
}

export function __resetCursoFormacaoClientForTests() {
  base44 = null;
}

// Acesso ao client: usa o injetado (testes) ou resolve o real (produção).
async function getClient() {
  return base44 || resolverClientPadrao();
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
const ENTITY_PROMOCAO = 'Promocao';
const ENTITY_PROMOCAO_MILITAR = 'PromocaoMilitar';

export const STATUS_FINAIS_PARTICIPANTE = ['reprovado', 'desligado', 'promovido'];
export const STATUS_PENDENTES_PARTICIPANTE = ['em_curso', 'aguardando_nova_etapa'];
export const STATUS_QUE_EXIGEM_JUSTIFICATIVA = ['reprovado', 'desligado', 'aguardando_nova_etapa'];
export const STATUS_PARTICIPANTE_EDITAVEIS = ['aprovado', 'reprovado', 'desligado', 'aguardando_nova_etapa'];
// Participantes elegíveis para entrar numa promoção a partir do curso.
export const STATUS_ELEGIVEIS_PROMOCAO = ['aprovado', 'aguardando_nova_etapa'];
const CURSOS_ATIVOS = ['aberto', 'em_andamento'];

// Destino oficial da promoção por tipo de curso de formação.
export const DESTINO_PROMOCAO_POR_TIPO = {
  CFC: 'Cabo',
  CFS: '3º Sargento',
};

// Status de PromocaoMilitar/Promocao considerados "publicados" no módulo oficial.
const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);

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
  return (await getClient()).entities[ENTITY_AUDIT].create(payload);
}

export async function listarAuditoriaCurso(cursoId) {
  const client = await getClient();
  if (cursoId) return client.entities[ENTITY_AUDIT].filter({ curso_id: cursoId }, '-data_hora');
  return client.entities[ENTITY_AUDIT].list('-data_hora');
}

// ============================================================
// Cursos
// ============================================================
export async function listarCursosFormacao(filtros = {}) {
  const client = await getClient();
  if (filtros && Object.keys(filtros).length > 0) {
    return client.entities[ENTITY_CURSO].filter(filtros, '-created_date');
  }
  return client.entities[ENTITY_CURSO].list('-created_date');
}

export async function obterCursoFormacao(cursoId) {
  return (await getClient()).entities[ENTITY_CURSO].get(cursoId);
}

export async function criarCursoFormacao(dados, usuario) {
  if (!dados?.nome?.trim()) throw new Error('O nome do curso é obrigatório.');
  if (!['CFC', 'CFS'].includes(dados?.tipo)) throw new Error('Tipo do curso inválido. Use CFC ou CFS.');

  const curso = await (await getClient()).entities[ENTITY_CURSO].create({
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
  const anterior = await (await getClient()).entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await (await getClient()).entities[ENTITY_CURSO].update(cursoId, dados);

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

  const anterior = await (await getClient()).entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await (await getClient()).entities[ENTITY_CURSO].update(cursoId, { status: 'cancelado' });

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
  // Curso só encerra quando TODOS estão em status final: promovido, reprovado ou desligado.
  // 'aprovado' e 'aguardando_nova_etapa' não são finais: o aprovado precisa ter a promoção
  // publicada (virando 'promovido') antes do encerramento.
  const naoFinais = participantes.filter((p) => !STATUS_FINAIS_PARTICIPANTE.includes(p.status));
  if (naoFinais.length > 0) {
    throw new Error(
      `Não é possível encerrar o curso: existem ${naoFinais.length} participante(s) sem status final. `
      + 'Todos devem estar promovido, reprovado ou desligado (aprovados precisam ter a promoção publicada).',
    );
  }

  const anterior = await (await getClient()).entities[ENTITY_CURSO].get(cursoId);
  const atualizado = await (await getClient()).entities[ENTITY_CURSO].update(cursoId, { status: 'encerrado' });

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
  return (await getClient()).entities[ENTITY_PARTICIPANTE].filter(
    { curso_id: cursoId },
    'snapshot_antiguidade',
  );
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
    const vinculos = await (await getClient()).entities[ENTITY_PARTICIPANTE].filter({ militar_id: militarId });
    for (const vinculo of vinculos) {
      if (STATUS_PENDENTES_PARTICIPANTE.includes(vinculo.status) && vinculo.curso_id !== cursoId) {
        const outroCurso = await (await getClient()).entities[ENTITY_CURSO].get(vinculo.curso_id).catch(() => null);
        if (!outroCurso || CURSOS_ATIVOS.includes(outroCurso.status)) {
          throw new Error(
            `O militar ${militar.nome_completo || militarId} já está em outro curso de formação ativo.`,
          );
        }
      }
    }

    proximaOrdem += 1;
    const participante = await (await getClient()).entities[ENTITY_PARTICIPANTE].create({
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

  const anterior = await (await getClient()).entities[ENTITY_PARTICIPANTE].get(participanteId);
  const atualizado = await (await getClient()).entities[ENTITY_PARTICIPANTE].update(participanteId, {
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
  const participante = await (await getClient()).entities[ENTITY_PARTICIPANTE].get(participanteId);
  if (participante?.status !== 'em_curso') {
    throw new Error('Só é possível remover participantes que ainda estão em curso (sem movimentação de status).');
  }

  await (await getClient()).entities[ENTITY_PARTICIPANTE].delete(participanteId);

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

// ============================================================
// Fase 3 — Geração de promoção via módulo OFICIAL de Promoções
// ------------------------------------------------------------
// IMPORTANTE: gerar a promoção NÃO altera Militar.posto_graduacao nem o
// Histórico de Promoções. Cria apenas:
//   - Promocao (status 'rascunho')
//   - PromocaoMilitar (status 'elegivel', publicado=false)
// A mudança de cadastro/histórico/`promovido` só ocorre quando a promoção for
// PUBLICADA pelo módulo oficial (publicarPromocaoOficial).
// ============================================================

export function destinoPromocaoDoCurso(tipoCurso) {
  const destino = DESTINO_PROMOCAO_POR_TIPO[tipoCurso];
  if (!destino) {
    throw new Error(`Tipo de curso "${tipoCurso}" não possui destino de promoção configurado.`);
  }
  return destino;
}

/**
 * Gera uma Promoção (rascunho) no módulo oficial a partir dos participantes
 * elegíveis (aprovado/aguardando_nova_etapa). Vincula promocao_id em cada
 * ParticipanteCursoFormacao. NÃO marca participante como 'promovido' e NÃO
 * altera o cadastro Militar — isso só acontece na publicação oficial.
 *
 * @param {string} cursoId
 * @param {object} dados - { quadro, data_promocao, data_publicacao, boletim_referencia, ato_referencia, doems_edicao_numero, observacoes }
 * @param {object} usuario
 */
export async function gerarPromocaoDosAprovados(cursoId, dados = {}, usuario) {
  const curso = await (await getClient()).entities[ENTITY_CURSO].get(cursoId);
  if (!curso) throw new Error('Curso não encontrado.');

  const destino = destinoPromocaoDoCurso(curso.tipo);

  const participantes = await listarParticipantesCurso(cursoId);
  const elegiveis = participantes.filter((p) => STATUS_ELEGIVEIS_PROMOCAO.includes(p.status));
  if (elegiveis.length === 0) {
    throw new Error('Não há participantes aprovados ou aguardando nova etapa para gerar a promoção.');
  }

  const jaVinculados = elegiveis.filter((p) => p.promocao_id);
  if (jaVinculados.length > 0) {
    throw new Error('Já existe promoção vinculada a um ou mais participantes. Sincronize ou trate os vínculos existentes antes de gerar novamente.');
  }

  const dataPromocao = (dados.data_promocao || '').split('T')[0];
  if (!dataPromocao) throw new Error('Informe a data da promoção.');

  // Cria a Promoção no módulo oficial como RASCUNHO (pendente de publicação).
  const promocao = await (await getClient()).entities[ENTITY_PROMOCAO].create({
    tipo: 'inicial',
    natureza: 'coletiva',
    posto_graduacao: destino,
    quadro: dados.quadro || '',
    data_promocao: dataPromocao,
    data_publicacao: (dados.data_publicacao || '').split('T')[0] || '',
    boletim_referencia: dados.boletim_referencia || '',
    ato_referencia: dados.ato_referencia || dados.doems_edicao_numero || '',
    status: 'rascunho',
    origem: 'curso_formacao',
    observacoes: dados.observacoes || `Promoção gerada a partir do curso de formação ${curso.nome}.`,
    criado_por: usuario?.email || usuario?.full_name || '',
    criado_em: new Date().toISOString(),
  });

  // Cria os PromocaoMilitar (elegíveis, NÃO publicados) e vincula no participante.
  let ordem = 0;
  for (const participante of elegiveis) {
    ordem += 1;
    await (await getClient()).entities[ENTITY_PROMOCAO_MILITAR].create({
      promocao_id: promocao.id,
      militar_id: participante.militar_id,
      ordem: Number(participante.snapshot_antiguidade) || ordem,
      status: 'elegivel',
      selecionado: true,
      publicado: false,
      origem: 'curso_formacao',
      data_vinculo: new Date().toISOString(),
      usuario_vinculo: usuario?.email || usuario?.full_name || '',
    });

    await (await getClient()).entities[ENTITY_PARTICIPANTE].update(participante.id, {
      promocao_id: promocao.id,
    });
  }

  await registrarAuditoriaCursoFormacao({
    curso_id: cursoId,
    acao: 'gerar_promocao',
    dados_novos: {
      promocao_id: promocao.id,
      destino,
      total_participantes: elegiveis.length,
      status_promocao: promocao.status,
    },
  }, usuario);

  return { promocao, total: elegiveis.length };
}

/**
 * Sincroniza o status dos participantes após PUBLICAÇÃO oficial da promoção.
 * Um participante só vira 'promovido' quando o PromocaoMilitar correspondente
 * estiver publicado (publicado=true ou status publicado) no módulo oficial.
 */
export async function sincronizarParticipantesPromovidos(cursoId, usuario) {
  const participantes = await listarParticipantesCurso(cursoId);
  const comPromocao = participantes.filter((p) => p.promocao_id && p.status !== 'promovido');
  if (comPromocao.length === 0) return { promovidos: 0 };

  let promovidos = 0;
  for (const participante of comPromocao) {
    const vinculos = await (await getClient()).entities[ENTITY_PROMOCAO_MILITAR].filter(
      { promocao_id: participante.promocao_id, militar_id: participante.militar_id },
    );
    const publicado = vinculos.some(
      (v) => v.publicado === true || STATUS_PROMOCAO_PUBLICADA.has(String(v.status || '').toLowerCase()),
    );
    if (!publicado) continue;

    const statusPrePublicacao = STATUS_ELEGIVEIS_PROMOCAO.includes(participante.status) ? participante.status : undefined;
    await (await getClient()).entities[ENTITY_PARTICIPANTE].update(participante.id, {
      status: 'promovido',
      ...(statusPrePublicacao ? { status_pre_publicacao: statusPrePublicacao } : {}),
      data_status_atual: new Date().toISOString(),
    });

    await registrarAuditoriaCursoFormacao({
      curso_id: cursoId,
      participante_id: participante.id,
      militar_id: participante.militar_id,
      acao: 'sincronizar_promovido',
      status_anterior: participante.status,
      status_novo: 'promovido',
      dados_novos: { promocao_id: participante.promocao_id, status_pre_publicacao: statusPrePublicacao || null },
    }, usuario);

    promovidos += 1;
  }

  return { promovidos };
}