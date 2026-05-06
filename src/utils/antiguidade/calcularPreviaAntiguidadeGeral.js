import { POSTOS_GRADUACOES, QUADROS } from '../../components/antiguidade/promocaoHistoricaUtils.js';
import {
  QUADROS_FIXOS,
  isQuadroComDestaque,
  isQuadroCompativel,
  normalizarQuadroLegado,
} from '../postoQuadroCompatibilidade.js';

export const PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL = Object.freeze({
  SEM_POSTO: 'PENDENTE_SEM_POSTO',
  SEM_QUADRO: 'PENDENTE_SEM_QUADRO',
  SEM_PROMOCAO_ATUAL_ATIVA: 'PENDENTE_SEM_PROMOCAO_ATUAL_ATIVA',
  SEM_DATA_PROMOCAO: 'PENDENTE_SEM_DATA_PROMOCAO',
  SEM_ORDEM_ANTIGUIDADE: 'PENDENTE_SEM_ORDEM_ANTIGUIDADE',
  POSTO_FORA_DA_ORDEM: 'PENDENTE_POSTO_FORA_DA_ORDEM',
  QUADRO_FORA_DA_ORDEM: 'PENDENTE_QUADRO_FORA_DA_ORDEM',
});

export const ALERTAS_PREVIA_ANTIGUIDADE_GERAL = Object.freeze({
  MULTIPLOS_REGISTROS_ATIVOS_COMPATIVEIS: 'ALERTA_MULTIPLOS_REGISTROS_ATIVOS_COMPATIVEIS',
  REGISTRO_PREVISTO_IGNORADO: 'ALERTA_REGISTRO_PREVISTO_IGNORADO',
  REGISTRO_CANCELADO_IGNORADO: 'ALERTA_REGISTRO_CANCELADO_IGNORADO',
  REGISTRO_RETIFICADO_IGNORADO: 'ALERTA_REGISTRO_RETIFICADO_IGNORADO',
  QUADRO_NORMALIZADO: 'ALERTA_QUADRO_NORMALIZADO',
  QUADRO_ESPECIAL: 'ALERTA_QUADRO_ESPECIAL',
  QAOBM_SUBTENENTE_2TEN: 'ALERTA_QAOBM_SUBTENENTE_2TEN',
  EMPATE_RESOLVIDO_POR_NOME_MATRICULA: 'ALERTA_EMPATE_RESOLVIDO_POR_NOME_MATRICULA',
  EMPATE_NAO_RESOLVIDO: 'ALERTA_EMPATE_NAO_RESOLVIDO',
});

const VALOR_AUSENTE_NUMERICO = Number.POSITIVE_INFINITY;
const STATUS_ATIVO = new Set(['', 'ATIVO', 'ATIVA']);
const STATUS_INATIVO_MILITAR = new Set(['INATIVO', 'INATIVA', 'INATIVADO', 'INATIVADA', 'EXCLUIDO', 'EXCLUIDA', 'DESLIGADO', 'DESLIGADA']);

const POSTO_ALIASES = new Map([
  ['CEL', 'CORONEL'],
  ['CORONEL', 'CORONEL'],
  ['TC', 'TENENTE CORONEL'],
  ['TEN CEL', 'TENENTE CORONEL'],
  ['TEN CEL BM', 'TENENTE CORONEL'],
  ['TENENTE CORONEL', 'TENENTE CORONEL'],
  ['MAJ', 'MAJOR'],
  ['MAJOR', 'MAJOR'],
  ['CAP', 'CAPITAO'],
  ['CAPITAO', 'CAPITAO'],
  ['1TEN', '1 TENENTE'],
  ['1 TEN', '1 TENENTE'],
  ['1 TENENTE', '1 TENENTE'],
  ['PRIMEIRO TENENTE', '1 TENENTE'],
  ['2TEN', '2 TENENTE'],
  ['2 TEN', '2 TENENTE'],
  ['2 TENENTE', '2 TENENTE'],
  ['SEGUNDO TENENTE', '2 TENENTE'],
  ['ASP', 'ASPIRANTE A OFICIAL'],
  ['ASP OF', 'ASPIRANTE A OFICIAL'],
  ['ASPIRANTE', 'ASPIRANTE A OFICIAL'],
  ['ASPIRANTE A OFICIAL', 'ASPIRANTE A OFICIAL'],
  ['ST', 'SUBTENENTE'],
  ['SUB TEN', 'SUBTENENTE'],
  ['SUBTENENTE', 'SUBTENENTE'],
  ['1SGT', '1 SARGENTO'],
  ['1 SGT', '1 SARGENTO'],
  ['1 SARGENTO', '1 SARGENTO'],
  ['PRIMEIRO SARGENTO', '1 SARGENTO'],
  ['2SGT', '2 SARGENTO'],
  ['2 SGT', '2 SARGENTO'],
  ['2 SARGENTO', '2 SARGENTO'],
  ['SEGUNDO SARGENTO', '2 SARGENTO'],
  ['3SGT', '3 SARGENTO'],
  ['3 SGT', '3 SARGENTO'],
  ['3 SARGENTO', '3 SARGENTO'],
  ['TERCEIRO SARGENTO', '3 SARGENTO'],
  ['CB', 'CABO'],
  ['CABO', 'CABO'],
  ['SD', 'SOLDADO'],
  ['SOLDADO', 'SOLDADO'],
]);

export function normalizarTextoPreviaAntiguidade(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª]/g, '')
    .replace(/[.]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const POSTO_CANONICO_POR_NORMALIZADO = new Map(
  POSTOS_GRADUACOES.map((posto) => [normalizarTextoPreviaAntiguidade(posto), posto]),
);
const POSTO_INDICE_POR_NORMALIZADO = new Map(
  POSTOS_GRADUACOES.map((posto, index) => [normalizarPostoGraduacao(posto), index]),
);
const QUADROS_ORDEM = Array.from(new Set([...(QUADROS_FIXOS || []), ...(QUADROS || [])]));
const QUADRO_INDICE_POR_NORMALIZADO = new Map(
  QUADROS_ORDEM.map((quadro, index) => [normalizarQuadroPreviaAntiguidade(quadro).valor, index]),
);

export function normalizarPostoGraduacao(valor) {
  const texto = normalizarTextoPreviaAntiguidade(valor)
    .replace(/\bBM\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return '';
  return POSTO_ALIASES.get(texto) || normalizarTextoPreviaAntiguidade(POSTO_CANONICO_POR_NORMALIZADO.get(texto) || texto);
}

export function normalizarQuadroPreviaAntiguidade(valor) {
  const original = String(valor ?? '').trim();
  if (!original) return { valor: '', foiNormalizado: false, original };
  const legado = normalizarQuadroLegado(original);
  const valorNormalizado = String(legado || '').trim().toUpperCase();
  const originalNormalizado = original.toUpperCase().replace(/\s+/g, '');
  return {
    valor: valorNormalizado,
    foiNormalizado: Boolean(valorNormalizado && valorNormalizado !== originalNormalizado),
    original,
  };
}

function valorTexto(valor) {
  return String(valor ?? '').trim();
}

function obterMilitarId(militar) {
  return valorTexto(militar?.id ?? militar?.militar_id);
}

function obterRegistroId(registro) {
  return valorTexto(registro?.id ?? registro?.registro_id ?? registro?.historico_promocao_id);
}

function normalizarStatus(valor) {
  return normalizarTextoPreviaAntiguidade(valor || 'ativo');
}

function isRegistroCancelado(registro) {
  return normalizarStatus(registro?.status_registro).includes('CANCEL');
}

function isRegistroRetificado(registro) {
  return normalizarStatus(registro?.status_registro).includes('RETIFIC');
}

function isRegistroPrevisto(registro) {
  return normalizarStatus(registro?.status_registro).includes('PREVIST');
}

function isRegistroAtivo(registro) {
  return STATUS_ATIVO.has(normalizarStatus(registro?.status_registro));
}

function isMilitarAtivo(militar) {
  if (militar?.ativo === false) return false;
  const status = normalizarTextoPreviaAntiguidade(
    militar?.status_registro ?? militar?.status ?? militar?.situacao ?? militar?.situacao_funcional ?? 'ativo',
  );
  return !STATUS_INATIVO_MILITAR.has(status);
}

function toTimestamp(data) {
  const texto = valorTexto(data);
  if (!texto) return null;
  const timestamp = Date.parse(texto);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toNumeroValido(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function addUnico(lista, valor) {
  if (valor && !lista.includes(valor)) lista.push(valor);
}

function incrementar(contador, chaves) {
  chaves.forEach((chave) => {
    contador[chave] = (contador[chave] || 0) + 1;
  });
}

function indexarHistoricoPorMilitar(historicoPromocoes) {
  return (historicoPromocoes || []).reduce((mapa, registro) => {
    const militarId = valorTexto(registro?.militar_id);
    if (!militarId) return mapa;
    if (!mapa.has(militarId)) mapa.set(militarId, []);
    mapa.get(militarId).push(registro);
    return mapa;
  }, new Map());
}

function escolherRegistroAtualCompativel(militar, historicos, alertas) {
  const postoMilitar = normalizarPostoGraduacao(militar?.posto_graduacao);
  const quadroMilitar = normalizarQuadroPreviaAntiguidade(militar?.quadro);
  const compativeis = [];

  historicos.forEach((registro) => {
    if (isRegistroCancelado(registro)) {
      addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_CANCELADO_IGNORADO);
      return;
    }
    if (isRegistroRetificado(registro)) {
      addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_RETIFICADO_IGNORADO);
      return;
    }
    if (isRegistroPrevisto(registro)) {
      addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_PREVISTO_IGNORADO);
      return;
    }
    if (!isRegistroAtivo(registro)) return;

    const postoRegistro = normalizarPostoGraduacao(registro?.posto_graduacao_novo);
    const quadroRegistro = normalizarQuadroPreviaAntiguidade(registro?.quadro_novo);
    const postoCompativel = !postoMilitar || !postoRegistro || postoRegistro === postoMilitar;
    const quadroCompativel = !quadroMilitar.valor || !quadroRegistro.valor || quadroRegistro.valor === quadroMilitar.valor;
    if (postoCompativel && quadroCompativel) compativeis.push(registro);
  });

  if (compativeis.length > 1) {
    addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.MULTIPLOS_REGISTROS_ATIVOS_COMPATIVEIS);
  }

  return compativeis.sort((a, b) => {
    const dataA = toTimestamp(a?.data_promocao) ?? -1;
    const dataB = toTimestamp(b?.data_promocao) ?? -1;
    if (dataA !== dataB) return dataB - dataA;

    const ordemA = toNumeroValido(a?.antiguidade_referencia_ordem);
    const ordemB = toNumeroValido(b?.antiguidade_referencia_ordem);
    if ((ordemA === null) !== (ordemB === null)) return ordemA === null ? 1 : -1;
    if ((ordemA ?? VALOR_AUSENTE_NUMERICO) !== (ordemB ?? VALOR_AUSENTE_NUMERICO)) {
      return (ordemA ?? VALOR_AUSENTE_NUMERICO) - (ordemB ?? VALOR_AUSENTE_NUMERICO);
    }

    return obterRegistroId(a).localeCompare(obterRegistroId(b), 'pt-BR', { numeric: true });
  })[0] || null;
}

function montarCriterioOrdenacao({ militar, registroAtual, postoNormalizado, quadroNormalizado }) {
  const dataPromocaoTimestamp = toTimestamp(registroAtual?.data_promocao);
  const antiguidadeReferenciaOrdem = toNumeroValido(registroAtual?.antiguidade_referencia_ordem);
  const antiguidadeReferenciaId = valorTexto(registroAtual?.antiguidade_referencia_id);
  const nomeNormalizado = normalizarTextoPreviaAntiguidade(militar?.nome ?? militar?.nome_completo);
  const matriculaNormalizada = normalizarTextoPreviaAntiguidade(militar?.matricula);
  const militarIdNormalizado = normalizarTextoPreviaAntiguidade(obterMilitarId(militar));

  return {
    postoIndice: POSTO_INDICE_POR_NORMALIZADO.has(postoNormalizado)
      ? POSTO_INDICE_POR_NORMALIZADO.get(postoNormalizado)
      : VALOR_AUSENTE_NUMERICO,
    postoNormalizado,
    quadroIndice: QUADRO_INDICE_POR_NORMALIZADO.has(quadroNormalizado)
      ? QUADRO_INDICE_POR_NORMALIZADO.get(quadroNormalizado)
      : VALOR_AUSENTE_NUMERICO,
    quadroNormalizado,
    dataPromocaoTimestamp: dataPromocaoTimestamp ?? VALOR_AUSENTE_NUMERICO,
    antiguidadeReferenciaOrdem: antiguidadeReferenciaOrdem ?? VALOR_AUSENTE_NUMERICO,
    antiguidadeReferenciaId: antiguidadeReferenciaId || '',
    nomeNormalizado,
    matriculaNormalizada,
    militarIdNormalizado,
  };
}

function compararItens(a, b) {
  const ca = a.criterioOrdenacao;
  const cb = b.criterioOrdenacao;
  const comparadores = [
    ca.postoIndice - cb.postoIndice,
    ca.quadroIndice - cb.quadroIndice,
    ca.dataPromocaoTimestamp - cb.dataPromocaoTimestamp,
    ca.antiguidadeReferenciaOrdem - cb.antiguidadeReferenciaOrdem,
    ca.antiguidadeReferenciaId.localeCompare(cb.antiguidadeReferenciaId, 'pt-BR', { numeric: true }),
    ca.nomeNormalizado.localeCompare(cb.nomeNormalizado, 'pt-BR', { numeric: true }),
    ca.matriculaNormalizada.localeCompare(cb.matriculaNormalizada, 'pt-BR', { numeric: true }),
    ca.militarIdNormalizado.localeCompare(cb.militarIdNormalizado, 'pt-BR', { numeric: true }),
  ];
  return comparadores.find((resultado) => resultado !== 0) || 0;
}

function chaveEmpateAteReferenciaId(criterio) {
  return [
    criterio.postoIndice,
    criterio.quadroIndice,
    criterio.dataPromocaoTimestamp,
    criterio.antiguidadeReferenciaOrdem,
    criterio.antiguidadeReferenciaId,
  ].join('|');
}

function marcarAlertasEmpate(itens) {
  const grupos = new Map();
  itens.forEach((item) => {
    const chave = chaveEmpateAteReferenciaId(item.criterioOrdenacao);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  });

  grupos.forEach((grupo) => {
    if (grupo.length < 2) return;
    const chavesNomeMatricula = new Set(
      grupo.map((item) => `${item.criterioOrdenacao.nomeNormalizado}|${item.criterioOrdenacao.matriculaNormalizada}`),
    );
    const alerta = chavesNomeMatricula.size === grupo.length
      ? ALERTAS_PREVIA_ANTIGUIDADE_GERAL.EMPATE_RESOLVIDO_POR_NOME_MATRICULA
      : ALERTAS_PREVIA_ANTIGUIDADE_GERAL.EMPATE_NAO_RESOLVIDO;
    grupo.forEach((item) => addUnico(item.alertas, alerta));
  });
}

function temPendenciaCritica(item) {
  return item.pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_POSTO)
    || item.pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_QUADRO)
    || item.pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_PROMOCAO_ATUAL_ATIVA)
    || item.pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_DATA_PROMOCAO);
}

/**
 * Motor puro frontend/read-only para a prévia da Listagem de Antiguidade Geral.
 *
 * A fonte operacional de promoção atual esperada em `historicoPromocoes` é
 * HistoricoPromocaoMilitarV2. A função não consulta Base44, não usa React/DOM,
 * não grava Militar, não grava HistoricoPromocaoMilitarV2 e não utiliza os
 * históricos legados.
 */
export function calcularPreviaAntiguidadeGeral({
  militares = [],
  historicoPromocoes = [],
  config = {},
} = {}) {
  const incluirSomenteMilitaresAtivos = config?.incluirSomenteMilitaresAtivos !== false;
  const historicoPorMilitar = indexarHistoricoPorMilitar(historicoPromocoes);
  const militaresConsiderados = (militares || []).filter((militar) => (
    incluirSomenteMilitaresAtivos ? isMilitarAtivo(militar) : true
  ));

  const itens = militaresConsiderados.map((militar) => {
    const pendencias = [];
    const alertas = [];
    const militarId = obterMilitarId(militar);
    const postoNormalizado = normalizarPostoGraduacao(militar?.posto_graduacao);
    const quadroNormalizadoInfo = normalizarQuadroPreviaAntiguidade(militar?.quadro);
    const historicos = historicoPorMilitar.get(militarId) || [];
    const registroAtual = escolherRegistroAtualCompativel(militar, historicos, alertas);

    if (!postoNormalizado) addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_POSTO);
    if (!quadroNormalizadoInfo.valor) addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_QUADRO);
    if (POSTO_INDICE_POR_NORMALIZADO.has(postoNormalizado) === false && postoNormalizado) {
      addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.POSTO_FORA_DA_ORDEM);
    }
    if (QUADRO_INDICE_POR_NORMALIZADO.has(quadroNormalizadoInfo.valor) === false && quadroNormalizadoInfo.valor) {
      addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_FORA_DA_ORDEM);
    }
    if (quadroNormalizadoInfo.foiNormalizado) addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_NORMALIZADO);
    if (quadroNormalizadoInfo.valor && isQuadroComDestaque(quadroNormalizadoInfo.valor)) {
      addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_ESPECIAL);
    }
    if (postoNormalizado && quadroNormalizadoInfo.valor && !isQuadroCompativel(militar?.posto_graduacao, quadroNormalizadoInfo.valor)) {
      addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_FORA_DA_ORDEM);
    }

    if (!registroAtual) {
      addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_PROMOCAO_ATUAL_ATIVA);
    } else {
      const dataPromocaoTimestamp = toTimestamp(registroAtual?.data_promocao);
      const ordem = toNumeroValido(registroAtual?.antiguidade_referencia_ordem);
      if (dataPromocaoTimestamp === null) addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_DATA_PROMOCAO);
      if (ordem === null) addUnico(pendencias, PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_ORDEM_ANTIGUIDADE);

      const postoAnterior = normalizarPostoGraduacao(registroAtual?.posto_graduacao_anterior);
      const postoNovo = normalizarPostoGraduacao(registroAtual?.posto_graduacao_novo);
      const quadroNovo = normalizarQuadroPreviaAntiguidade(registroAtual?.quadro_novo).valor;
      if (postoAnterior === 'SUBTENENTE' && postoNovo === '2 TENENTE' && quadroNovo === 'QAOBM') {
        addUnico(alertas, ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QAOBM_SUBTENENTE_2TEN);
      }
    }

    const criterioOrdenacao = montarCriterioOrdenacao({
      militar,
      registroAtual,
      postoNormalizado,
      quadroNormalizado: quadroNormalizadoInfo.valor,
    });

    return {
      posicao: null,
      militar_id: militarId || null,
      nome: valorTexto(militar?.nome ?? militar?.nome_completo),
      matricula: valorTexto(militar?.matricula),
      posto_graduacao: valorTexto(militar?.posto_graduacao),
      quadro: valorTexto(militar?.quadro),
      data_promocao: registroAtual?.data_promocao || null,
      antiguidade_referencia_ordem: toNumeroValido(registroAtual?.antiguidade_referencia_ordem),
      criterioOrdenacao,
      pendencias,
      alertas,
      registroPromocaoAtualId: registroAtual ? obterRegistroId(registroAtual) || null : null,
    };
  }).sort(compararItens);

  marcarAlertasEmpate(itens);
  itens.forEach((item, index) => {
    item.posicao = index + 1;
  });

  const pendenciasPorTipo = {};
  const alertasPorTipo = {};
  itens.forEach((item) => {
    incrementar(pendenciasPorTipo, item.pendencias);
    incrementar(alertasPorTipo, item.alertas);
  });

  return {
    itens,
    resumo: {
      totalMilitaresEntrada: (militares || []).length,
      totalMilitaresConsiderados: itens.length,
      totalOrdenadosSemPendenciaCritica: itens.filter((item) => !temPendenciaCritica(item)).length,
      totalComPendencias: itens.filter((item) => item.pendencias.length > 0).length,
      totalComAlertas: itens.filter((item) => item.alertas.length > 0).length,
    },
    pendenciasPorTipo,
    alertasPorTipo,
  };
}

export default calcularPreviaAntiguidadeGeral;
