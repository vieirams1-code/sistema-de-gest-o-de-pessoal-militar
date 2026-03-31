import { base44 } from '@/api/base44Client';
import { promoverMilitaresEmLote } from '@/services/promocaoMilitarService';

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

  return entidadeTurma.create({
    nome: nomeNormalizado,
    identificacao: identificacaoNormalizada,
    posto_graduacao_alvo: postoAlvo,
    data_promocao: dataPromocaoISO,
    status: 'Rascunho',
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
      created_by: normalizarTexto(userEmail),
    });
    criados += 1;
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

  const resultadoLote = await promoverMilitaresEmLote({
    militaresSelecionados,
    postoGraduacao: turma.posto_graduacao_alvo,
    dataPromocaoAtual: turma.data_promocao,
    userEmail,
  });

  if (base44.entities?.TurmaPromocaoMilitar?.update) {
    await base44.entities.TurmaPromocaoMilitar.update(turma.id, {
      status: resultadoLote.falhas > 0 ? 'Processada com pendências' : 'Processada',
    });
  }

  return {
    turma_id: turma.id,
    turma_nome: normalizarTexto(turma.nome) || normalizarTexto(turma.identificacao),
    total_vinculados: militarIds.length,
    ...resultadoLote,
  };
}
