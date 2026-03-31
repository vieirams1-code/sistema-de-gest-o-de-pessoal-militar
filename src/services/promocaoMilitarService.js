import { base44 } from '@/api/base44Client';
import { registrarHistoricoPromocaoMilitarSeNecessario } from '@/services/historicoPromocaoMilitarService';
import { ordenarMilitaresPorAntiguidade } from '@/utils/antiguidadeMilitar';

const POSITIVE_INTEGER_REGEX = /^[1-9]\d*$/;

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarDataISO(valor) {
  const texto = normalizarTexto(valor);
  return texto ? texto.slice(0, 10) : '';
}

function normalizarAntiguidade(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return null;
  if (!POSITIVE_INTEGER_REGEX.test(texto)) {
    throw new Error('A antiguidade de referência deve ser um inteiro positivo.');
  }
  return Number(texto);
}

function normalizarAntiguidadeNullable(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function dataValida(dataISO) {
  if (!dataISO) return false;
  const timestamp = Date.parse(`${dataISO}T00:00:00Z`);
  return Number.isFinite(timestamp);
}

export async function promoverMilitarSimples({
  militarAtual,
  postoGraduacao,
  dataPromocaoAtual,
  antiguidadeReferenciaOrdem,
  userEmail,
}) {
  const militarId = normalizarTexto(militarAtual?.id);
  if (!militarId) throw new Error('Militar inválido para promoção.');

  const novoPosto = normalizarTexto(postoGraduacao);
  const novaDataPromocao = normalizarDataISO(dataPromocaoAtual);
  const novaAntiguidade = normalizarAntiguidade(antiguidadeReferenciaOrdem);

  if (!novoPosto) throw new Error('Informe o novo posto/graduação.');
  if (!novaDataPromocao) throw new Error('Informe a data da promoção.');
  if (!dataValida(novaDataPromocao)) throw new Error('Data de promoção inválida.');
  const dataInclusao = normalizarDataISO(militarAtual?.data_inclusao);
  if (dataInclusao && novaDataPromocao < dataInclusao) {
    throw new Error('A data da promoção não pode ser anterior à data de inclusão do militar.');
  }

  const postoAtual = normalizarTexto(militarAtual?.posto_graduacao);
  const dataPromocaoAtualMilitar = normalizarDataISO(militarAtual?.data_promocao_atual);
  const antiguidadeAtual = normalizarAntiguidadeNullable(militarAtual?.antiguidade_referencia_ordem);

  const semMudanca =
    postoAtual === novoPosto
    && dataPromocaoAtualMilitar === novaDataPromocao
    && antiguidadeAtual === novaAntiguidade;

  if (semMudanca) {
    return { atualizou: false, motivo: 'sem_alteracao' };
  }

  const payloadAtualizacao = {
    posto_graduacao: novoPosto,
    data_promocao_atual: novaDataPromocao,
    antiguidade_referencia_ordem: novaAntiguidade,
  };

  await base44.entities.Militar.update(militarId, payloadAtualizacao);

  const militarDepois = {
    ...militarAtual,
    ...payloadAtualizacao,
    id: militarId,
  };

  const historico = await registrarHistoricoPromocaoMilitarSeNecessario({
    militarAntes: militarAtual || {},
    militarDepois,
    userEmail: normalizarTexto(userEmail),
    contexto: 'promocao_manual',
  });

  return {
    atualizou: true,
    historico,
  };
}

function proximaAntiguidadeDisponivel(inicio, ocupadas) {
  let candidata = Number(inicio) || 1;
  while (ocupadas.has(candidata)) {
    candidata += 1;
  }
  return candidata;
}

export async function promoverMilitaresEmLote({
  militaresSelecionados,
  postoGraduacao,
  dataPromocaoAtual,
  userEmail,
}) {
  const militares = Array.isArray(militaresSelecionados) ? militaresSelecionados : [];
  if (!militares.length) {
    throw new Error('Selecione ao menos um militar para promoção em lote.');
  }

  const novoPosto = normalizarTexto(postoGraduacao);
  const novaDataPromocao = normalizarDataISO(dataPromocaoAtual);

  if (!novoPosto) throw new Error('Informe o novo posto/graduação do lote.');
  if (!novaDataPromocao) throw new Error('Informe a data da promoção do lote.');
  if (!dataValida(novaDataPromocao)) throw new Error('Data de promoção inválida para o lote.');

  const militaresUnicos = [];
  const ids = new Set();
  for (const militar of militares) {
    const militarId = normalizarTexto(militar?.id);
    if (!militarId || ids.has(militarId)) continue;
    ids.add(militarId);
    militaresUnicos.push(militar);
  }

  if (!militaresUnicos.length) {
    throw new Error('Não foi possível identificar militares válidos para o lote.');
  }

  const militaresMesmoPostoData = await base44.entities.Militar.filter({
    posto_graduacao: novoPosto,
    data_promocao_atual: novaDataPromocao,
  }, '-created_date');

  const ordensOcupadas = new Set(
    (Array.isArray(militaresMesmoPostoData) ? militaresMesmoPostoData : [])
      .map((item) => normalizarAntiguidadeNullable(item?.antiguidade_referencia_ordem))
      .filter((numero) => Number.isInteger(numero) && numero > 0),
  );

  const militaresOrdenados = ordenarMilitaresPorAntiguidade(militaresUnicos);

  const resultados = [];
  let ordemAtual = proximaAntiguidadeDisponivel(1, ordensOcupadas);
  for (const militar of militaresOrdenados) {
    const ordemAtribuida = ordemAtual;
    ordensOcupadas.add(ordemAtribuida);
    ordemAtual = proximaAntiguidadeDisponivel(ordemAtribuida + 1, ordensOcupadas);

    const resultado = await promoverMilitarSimples({
      militarAtual: militar,
      postoGraduacao: novoPosto,
      dataPromocaoAtual: novaDataPromocao,
      antiguidadeReferenciaOrdem: ordemAtribuida,
      userEmail,
    });

    resultados.push({
      militar_id: normalizarTexto(militar?.id),
      atualizou: Boolean(resultado?.atualizou),
      motivo: resultado?.motivo || null,
      antiguidade_referencia_ordem: ordemAtribuida,
    });
  }

  const promovidos = resultados.filter((item) => item.atualizou).length;
  return {
    totalSelecionados: militaresUnicos.length,
    promovidos,
    semAlteracao: resultados.length - promovidos,
    resultados,
  };
}
