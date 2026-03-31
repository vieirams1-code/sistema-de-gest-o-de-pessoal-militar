import { base44 } from '@/api/base44Client';
import { registrarHistoricoPromocaoMilitarSeNecessario } from '@/services/historicoPromocaoMilitarService';
import { ordenarMilitaresPorAntiguidade } from '@/utils/antiguidadeMilitar';

const POSITIVE_INTEGER_REGEX = /^[1-9]\d*$/;
const MAX_TENTATIVAS_COLISAO = 3;

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

async function listarMilitaresMesmoPostoData(postoGraduacao, dataPromocaoAtual) {
  const militares = await base44.entities.Militar.filter({
    posto_graduacao: postoGraduacao,
    data_promocao_atual: dataPromocaoAtual,
  }, '-created_date');

  return Array.isArray(militares) ? militares : [];
}

function mapearOrdensOcupadas(militares, militarIdIgnorado = '') {
  const ignorado = normalizarTexto(militarIdIgnorado);
  return new Set(
    (Array.isArray(militares) ? militares : [])
      .filter((item) => normalizarTexto(item?.id) !== ignorado)
      .map((item) => normalizarAntiguidadeNullable(item?.antiguidade_referencia_ordem))
      .filter((numero) => Number.isInteger(numero) && numero > 0),
  );
}

function mapearDuplicidadesDeAntiguidade(militares) {
  const mapaOrdens = new Map();
  for (const militar of militares) {
    const ordem = normalizarAntiguidadeNullable(militar?.antiguidade_referencia_ordem);
    if (!Number.isInteger(ordem) || ordem <= 0) continue;
    const ids = mapaOrdens.get(ordem) || [];
    ids.push(normalizarTexto(militar?.id));
    mapaOrdens.set(ordem, ids);
  }

  return Array.from(mapaOrdens.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([ordem, ids]) => ({
      ordem,
      militares: ids,
      quantidade: ids.length,
    }));
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
  let descartadosSemIdValido = 0;
  for (const militar of militares) {
    const militarId = normalizarTexto(militar?.id);
    if (!militarId) {
      descartadosSemIdValido += 1;
      continue;
    }
    if (ids.has(militarId)) continue;
    ids.add(militarId);
    militaresUnicos.push(militar);
  }

  if (!militaresUnicos.length) {
    throw new Error('Não foi possível identificar militares válidos para o lote.');
  }

  const militaresOrdenados = ordenarMilitaresPorAntiguidade(militaresUnicos);

  const resultados = [];
  let ordemAtual = 1;
  for (const militar of militaresOrdenados) {
    const militarId = normalizarTexto(militar?.id);
    let ordemCandidata = ordemAtual;
    let processado = false;
    let ultimaMensagemErro = null;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_COLISAO; tentativa += 1) {
      const militaresMesmoPostoData = await listarMilitaresMesmoPostoData(novoPosto, novaDataPromocao);
      const ordensOcupadas = mapearOrdensOcupadas(militaresMesmoPostoData, militarId);
      const ordemDisponivel = proximaAntiguidadeDisponivel(ordemCandidata, ordensOcupadas);

      if (ordemDisponivel !== ordemCandidata) {
        ultimaMensagemErro = `Colisão detectada para ordem ${ordemCandidata}; recalculada para ${ordemDisponivel}.`;
        ordemCandidata = ordemDisponivel;
        if (tentativa < MAX_TENTATIVAS_COLISAO) {
          continue;
        }
      }

      try {
        const resultado = await promoverMilitarSimples({
          militarAtual: militar,
          postoGraduacao: novoPosto,
          dataPromocaoAtual: novaDataPromocao,
          antiguidadeReferenciaOrdem: ordemCandidata,
          userEmail,
        });

        const status = resultado?.atualizou ? 'promovido' : 'sem_alteracao';
        resultados.push({
          militar_id: militarId,
          status,
          mensagem: status === 'promovido' ? null : (resultado?.motivo || 'sem_alteracao'),
          antiguidade_referencia_ordem: ordemCandidata,
          tentativas: tentativa,
        });

        ordemAtual = ordemCandidata + 1;
        processado = true;
        break;
      } catch (error) {
        ultimaMensagemErro = normalizarTexto(error?.message) || 'Falha ao promover militar no lote.';
        if (tentativa === MAX_TENTATIVAS_COLISAO) {
          resultados.push({
            militar_id: militarId,
            status: 'falha',
            mensagem: ultimaMensagemErro,
            antiguidade_referencia_ordem: null,
            tentativas: tentativa,
          });
        }
      }
    }

    if (!processado && resultados[resultados.length - 1]?.militar_id !== militarId) {
      resultados.push({
        militar_id: militarId,
        status: 'falha',
        mensagem: ultimaMensagemErro || 'Falha na promoção após tentativas de reprocessamento.',
        antiguidade_referencia_ordem: null,
        tentativas: MAX_TENTATIVAS_COLISAO,
      });
    }
  }

  const promovidos = resultados.filter((item) => item.status === 'promovido').length;
  const semAlteracao = resultados.filter((item) => item.status === 'sem_alteracao').length;
  const falhas = resultados.filter((item) => item.status === 'falha').length;

  const snapshotFinalMesmoPostoData = await listarMilitaresMesmoPostoData(novoPosto, novaDataPromocao);
  const duplicidadesAntiguidade = mapearDuplicidadesDeAntiguidade(snapshotFinalMesmoPostoData);

  return {
    totalSelecionados: militaresUnicos.length,
    promovidos,
    semAlteracao,
    falhas,
    descartadosSemIdValido,
    alertaIntegridade: duplicidadesAntiguidade.length
      ? {
        tipo: 'duplicidade_antiguidade_referencia_ordem',
        mensagem: 'Foram encontradas ordens de antiguidade duplicadas no checkpoint pós-lote.',
        duplicidades: duplicidadesAntiguidade,
      }
      : null,
    resultados,
  };
}
