import { base44 } from '@/api/base44Client';
import { promoverMilitaresEmLote } from '@/services/promocaoMilitarService';

const STATUS_TURMA = Object.freeze({
  RASCUNHO: 'Rascunho',
  PRONTA: 'Pronta para processamento',
  EM_PROCESSAMENTO: 'Em processamento',
  PROCESSADA: 'Processada',
  PROCESSADA_COM_PENDENCIAS: 'Processada com pendências',
  FALHA_EXECUCAO: 'Falha na execução',
});

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarDataISO(valor) {
  const texto = normalizarTexto(valor);
  return texto ? texto.slice(0, 10) : '';
}

function dataValida(dataISO) {
  if (!dataISO) return false;
  const timestamp = Date.parse(`${dataISO}T00:00:00Z`);
  return Number.isFinite(timestamp);
}

async function buscarTurmaPorId(turmaId) {
  const turmaIdNormalizado = normalizarTexto(turmaId);
  if (!turmaIdNormalizado) throw new Error('Turma de promoção inválida.');

  const entidadeTurma = base44.entities?.TurmaPromocaoMilitar;
  if (!entidadeTurma || typeof entidadeTurma.filter !== 'function') {
    throw new Error('Entidade TurmaPromocaoMilitar indisponível.');
  }

  const turmas = await entidadeTurma.filter({ id: turmaIdNormalizado });
  return Array.isArray(turmas) ? (turmas[0] || null) : null;
}

async function atualizarTurmaSePossivel(turmaId, payload) {
  if (!base44.entities?.TurmaPromocaoMilitar?.update) return;
  await base44.entities.TurmaPromocaoMilitar.update(turmaId, payload);
}

export async function criarTurmaPromocaoMilitar({
  nome,
  identificacao,
  postoGraduacaoAlvo,
  dataPromocao,
  observacoes,
  userEmail,
}) {
  const entidadeTurma = base44.entities?.TurmaPromocaoMilitar;
  if (!entidadeTurma || typeof entidadeTurma.create !== 'function') {
    throw new Error('Entidade TurmaPromocaoMilitar indisponível.');
  }

  const nomeNormalizado = normalizarTexto(nome);
  const identificacaoNormalizada = normalizarTexto(identificacao);
  const postoAlvo = normalizarTexto(postoGraduacaoAlvo);
  const dataPromocaoISO = normalizarDataISO(dataPromocao);

  if (!nomeNormalizado && !identificacaoNormalizada) {
    throw new Error('Informe ao menos o nome ou identificação da turma.');
  }
  if (!postoAlvo) throw new Error('Informe o posto/graduação alvo da turma.');
  if (!dataPromocaoISO) throw new Error('Informe a data de promoção da turma.');
  if (!dataValida(dataPromocaoISO)) throw new Error('Data de promoção da turma inválida.');

  if (identificacaoNormalizada && typeof entidadeTurma.filter === 'function') {
    const turmasMesmoIdentificador = await entidadeTurma.filter({ identificacao: identificacaoNormalizada });
    const existeDuplicada = (Array.isArray(turmasMesmoIdentificador) ? turmasMesmoIdentificador : [])
      .some((item) => normalizarDataISO(item?.data_promocao) === dataPromocaoISO);
    if (existeDuplicada) {
      throw new Error('Já existe turma com a mesma identificação e data de promoção.');
    }
  }

  return entidadeTurma.create({
    nome: nomeNormalizado,
    identificacao: identificacaoNormalizada,
    posto_graduacao_alvo: postoAlvo,
    data_promocao: dataPromocaoISO,
    status: STATUS_TURMA.RASCUNHO,
    mensagem_status: '',
    total_membros: 0,
    total_processados: 0,
    total_promovidos: 0,
    total_sem_alteracao: 0,
    total_falhas: 0,
    observacoes: normalizarTexto(observacoes),
    created_by: normalizarTexto(userEmail),
  });
}

export async function associarMilitaresATurmaPromocao({
  turmaId,
  militaresSelecionados,
  userEmail,
}) {
  const turma = await buscarTurmaPorId(turmaId);
  if (!turma) throw new Error('Turma de promoção não encontrada.');

  const entidadeMembro = base44.entities?.TurmaPromocaoMilitarMembro;
  if (!entidadeMembro || typeof entidadeMembro.filter !== 'function' || typeof entidadeMembro.create !== 'function') {
    throw new Error('Entidade TurmaPromocaoMilitarMembro indisponível.');
  }

  const militares = Array.isArray(militaresSelecionados) ? militaresSelecionados : [];
  if (!militares.length) throw new Error('Selecione ao menos um militar para vincular à turma.');

  const idsUnicos = [];
  const idsSet = new Set();
  for (const militar of militares) {
    const militarId = normalizarTexto(militar?.id || militar);
    if (!militarId || idsSet.has(militarId)) continue;
    idsSet.add(militarId);
    idsUnicos.push(militarId);
  }

  if (!idsUnicos.length) {
    throw new Error('Não foi possível identificar militares válidos para vínculo na turma.');
  }

  const vinculosExistentes = await entidadeMembro.filter({ turma_promocao_id: turma.id });
  const idsJaVinculados = new Set(
    (Array.isArray(vinculosExistentes) ? vinculosExistentes : [])
      .map((item) => normalizarTexto(item?.militar_id))
      .filter(Boolean),
  );

  let criados = 0;
  let ignorados = 0;
  for (const militarId of idsUnicos) {
    if (idsJaVinculados.has(militarId)) {
      ignorados += 1;
      continue;
    }

    await entidadeMembro.create({
      turma_promocao_id: turma.id,
      militar_id: militarId,
      status_processamento: 'Pendente',
      ultima_mensagem_processamento: '',
      created_by: normalizarTexto(userEmail),
    });
    criados += 1;
  }

  if (criados > 0) {
    await atualizarTurmaSePossivel(turma.id, {
      status: STATUS_TURMA.PRONTA,
      total_membros: idsJaVinculados.size + criados,
      mensagem_status: '',
    });
  }

  return {
    turma_id: turma.id,
    processados: idsUnicos.length,
    criados,
    ignorados,
  };
}

export async function executarPromocaoDaTurma({ turmaId, userEmail }) {
  const turma = await buscarTurmaPorId(turmaId);
  if (!turma) throw new Error('Turma de promoção não encontrada.');
  if (normalizarTexto(turma.status) === STATUS_TURMA.EM_PROCESSAMENTO) {
    throw new Error('A turma já está em processamento. Aguarde a finalização para nova execução.');
  }

  const entidadeMembro = base44.entities?.TurmaPromocaoMilitarMembro;
  if (!entidadeMembro || typeof entidadeMembro.filter !== 'function') {
    throw new Error('Entidade TurmaPromocaoMilitarMembro indisponível.');
  }

  const vinculos = await entidadeMembro.filter({ turma_promocao_id: turma.id });
  const militarIds = Array.from(new Set(
    (Array.isArray(vinculos) ? vinculos : [])
      .map((item) => normalizarTexto(item?.militar_id))
      .filter(Boolean),
  ));

  if (!militarIds.length) {
    throw new Error('A turma não possui militares vinculados para promoção.');
  }

  const militaresBrutos = await Promise.all(militarIds.map((id) => base44.entities.Militar.filter({ id })));
  const militaresSelecionados = militaresBrutos
    .map((lista) => (Array.isArray(lista) ? lista[0] : null))
    .filter(Boolean);

  if (!militaresSelecionados.length) {
    throw new Error('Não foi possível carregar os militares vinculados à turma.');
  }

  await atualizarTurmaSePossivel(turma.id, {
    status: STATUS_TURMA.EM_PROCESSAMENTO,
    mensagem_status: '',
  });

  let resultadoLote;
  try {
    resultadoLote = await promoverMilitaresEmLote({
      militaresSelecionados,
      postoGraduacao: turma.posto_graduacao_alvo,
      dataPromocaoAtual: turma.data_promocao,
      userEmail,
    });
  } catch (error) {
    await atualizarTurmaSePossivel(turma.id, {
      status: STATUS_TURMA.FALHA_EXECUCAO,
      mensagem_status: normalizarTexto(error?.message) || 'Falha inesperada na execução da turma.',
      ultima_execucao_em: new Date().toISOString(),
      ultima_execucao_por: normalizarTexto(userEmail),
      total_membros: militarIds.length,
      total_processados: 0,
      total_promovidos: 0,
      total_sem_alteracao: 0,
      total_falhas: militarIds.length,
    });
    throw error;
  }

  await atualizarTurmaSePossivel(turma.id, {
    status: resultadoLote.falhas > 0 ? STATUS_TURMA.PROCESSADA_COM_PENDENCIAS : STATUS_TURMA.PROCESSADA,
    mensagem_status: '',
    ultima_execucao_em: new Date().toISOString(),
    ultima_execucao_por: normalizarTexto(userEmail),
    total_membros: militarIds.length,
    total_processados: resultadoLote.totalSelecionados || 0,
    total_promovidos: resultadoLote.promovidos || 0,
    total_sem_alteracao: resultadoLote.semAlteracao || 0,
    total_falhas: resultadoLote.falhas || 0,
  });

  return {
    turma_id: turma.id,
    turma_nome: normalizarTexto(turma.nome) || normalizarTexto(turma.identificacao),
    total_vinculados: militarIds.length,
    ...resultadoLote,
  };
}
