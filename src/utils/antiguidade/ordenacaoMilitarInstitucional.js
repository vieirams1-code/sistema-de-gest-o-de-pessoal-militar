import {
  normalizarPostoGraduacao,
  normalizarTextoPreviaAntiguidade,
} from './calcularPreviaAntiguidadeGeral.js';
import {
  criarContextoOrdemQuadrosAntiguidade,
  obterDetalheAntiguidadeQuadro,
} from './ordemQuadrosAntiguidade.js';
import { POSTOS_GRADUACOES } from '../../components/antiguidade/promocaoHistoricaUtils.js';

const VALOR_AUSENTE_NUMERICO = Number.POSITIVE_INFINITY;
const POSTO_INDICE_POR_NORMALIZADO = new Map(
  POSTOS_GRADUACOES.map((posto, index) => [normalizarPostoGraduacao(posto), index]),
);

function toNumeroValido(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function toTimestamp(data) {
  const texto = String(data ?? '').trim();
  if (!texto) return null;
  const timestamp = Date.parse(texto);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function obterAntiguidadeOrdem(militar = {}) {
  const campos = [
    militar?.antiguidade_referencia_ordem,
    militar?.ordem_antiguidade,
    militar?.antiguidade_ordem,
    militar?.numero_antiguidade,
    militar?.antiguidade,
  ];

  for (const valor of campos) {
    const numero = toNumeroValido(valor);
    if (numero !== null) return numero;
  }

  return null;
}

function montarChaveEstavel(militar = {}) {
  const nome = normalizarTextoPreviaAntiguidade(militar?.nome_guerra || militar?.nome || militar?.nome_completo);
  const matricula = normalizarTextoPreviaAntiguidade(militar?.matricula);
  const id = normalizarTextoPreviaAntiguidade(militar?.id || militar?.militar_id);
  return { nome, matricula, id };
}

function obterOrdemQuadrosAntiguidadeConfig(config = {}) {
  if (Array.isArray(config?.ordemQuadrosAntiguidade)) return config.ordemQuadrosAntiguidade;
  if (Array.isArray(config?.ordem_quadros)) return config.ordem_quadros;
  if (Array.isArray(config?.configuracaoAntiguidade?.ordem_quadros)) return config.configuracaoAntiguidade.ordem_quadros;
  if (Array.isArray(config?.configuracaoAntiguidade?.ordemQuadrosAntiguidade)) return config.configuracaoAntiguidade.ordemQuadrosAntiguidade;
  return undefined;
}

export function ordenarMilitaresPorAntiguidadeInstitucional(militares = [], config = {}) {
  const contextoOrdemQuadros = criarContextoOrdemQuadrosAntiguidade(obterOrdemQuadrosAntiguidadeConfig(config));

  return militares.slice().sort((a, b) => {
    const postoA = POSTO_INDICE_POR_NORMALIZADO.get(normalizarPostoGraduacao(a?.posto_grad || a?.posto_graduacao || a?.posto)) ?? VALOR_AUSENTE_NUMERICO;
    const postoB = POSTO_INDICE_POR_NORMALIZADO.get(normalizarPostoGraduacao(b?.posto_grad || b?.posto_graduacao || b?.posto)) ?? VALOR_AUSENTE_NUMERICO;
    if (postoA !== postoB) return postoA - postoB;

    const quadroA = obterDetalheAntiguidadeQuadro(a?.quadro, contextoOrdemQuadros).quadroIndice;
    const quadroB = obterDetalheAntiguidadeQuadro(b?.quadro, contextoOrdemQuadros).quadroIndice;
    if (quadroA !== quadroB) return quadroA - quadroB;

    const ordemA = obterAntiguidadeOrdem(a) ?? VALOR_AUSENTE_NUMERICO;
    const ordemB = obterAntiguidadeOrdem(b) ?? VALOR_AUSENTE_NUMERICO;
    if (ordemA !== ordemB) return ordemA - ordemB;

    const dataA = toTimestamp(a?.data_promocao) ?? VALOR_AUSENTE_NUMERICO;
    const dataB = toTimestamp(b?.data_promocao) ?? VALOR_AUSENTE_NUMERICO;
    if (dataA !== dataB) return dataA - dataB;

    const chaveA = montarChaveEstavel(a);
    const chaveB = montarChaveEstavel(b);
    const nomeCmp = chaveA.nome.localeCompare(chaveB.nome, 'pt-BR', { numeric: true });
    if (nomeCmp !== 0) return nomeCmp;
    const matCmp = chaveA.matricula.localeCompare(chaveB.matricula, 'pt-BR', { numeric: true });
    if (matCmp !== 0) return matCmp;
    return chaveA.id.localeCompare(chaveB.id, 'pt-BR', { numeric: true });
  });
}
