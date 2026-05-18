import { POSTOS_GRADUACOES_HIERARQUIA } from '../constants/postosGraduacoes.js';

const EFEITOS_ATUALIZACAO_CADASTRO = {
  historica: {
    atualizar: false,
    tipo: 'historica',
    titulo: 'Promoção histórica',
    mensagem: 'Não altera o cadastro atual.',
    bloqueiaSalvar: false,
  },
  atual: {
    atualizar: false,
    tipo: 'atual',
    titulo: 'Promoção atual',
    mensagem: 'Cadastro já compatível.',
    bloqueiaSalvar: false,
  },
  imediatamente_superior: {
    atualizar: true,
    tipo: 'imediatamente_superior',
    titulo: 'Cadastro será atualizado',
    mensagem: 'Promoção imediatamente superior ao cadastro atual.',
    bloqueiaSalvar: false,
  },
  incompativel: {
    atualizar: false,
    tipo: 'incompativel',
    titulo: 'Promoção incompatível',
    mensagem: 'Está duas ou mais graduações acima do cadastro atual.',
    bloqueiaSalvar: true,
  },
  revisao: {
    atualizar: false,
    tipo: 'revisao',
    titulo: 'Revisar cadastro',
    mensagem: 'Posto/graduação não reconhecido.',
    bloqueiaSalvar: true,
  },
};

const MOTIVO_INFERIOR = EFEITOS_ATUALIZACAO_CADASTRO.historica.mensagem;

function texto(valor) {
  return String(valor ?? '').trim();
}

function chave(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, 'o')
    .replace(/[-–—]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const ALIASES = new Map([
  ['soldado', 'Soldado'],
  ['sd', 'Soldado'],
  ['cabo', 'Cabo'],
  ['cb', 'Cabo'],
  ['3o sargento', '3º Sargento'],
  ['3 sargento', '3º Sargento'],
  ['3o sgt', '3º Sargento'],
  ['3 sgt', '3º Sargento'],
  ['terceiro sargento', '3º Sargento'],
  ['2o sargento', '2º Sargento'],
  ['2 sargento', '2º Sargento'],
  ['2o sgt', '2º Sargento'],
  ['2 sgt', '2º Sargento'],
  ['segundo sargento', '2º Sargento'],
  ['1o sargento', '1º Sargento'],
  ['1 sargento', '1º Sargento'],
  ['1o sgt', '1º Sargento'],
  ['1 sgt', '1º Sargento'],
  ['primeiro sargento', '1º Sargento'],
  ['subtenente', 'Subtenente'],
  ['sub tenente', 'Subtenente'],
  ['st', 'Subtenente'],
  ['aspirante', 'Aspirante a Oficial'],
  ['aspirante a oficial', 'Aspirante a Oficial'],
  ['asp oficial', 'Aspirante a Oficial'],
  ['2o tenente', '2º Tenente'],
  ['2 tenente', '2º Tenente'],
  ['2o ten', '2º Tenente'],
  ['2 ten', '2º Tenente'],
  ['segundo tenente', '2º Tenente'],
  ['1o tenente', '1º Tenente'],
  ['1 tenente', '1º Tenente'],
  ['1o ten', '1º Tenente'],
  ['1 ten', '1º Tenente'],
  ['primeiro tenente', '1º Tenente'],
  ['capitao', 'Capitão'],
  ['cap', 'Capitão'],
  ['major', 'Major'],
  ['maj', 'Major'],
  ['tenente coronel', 'Tenente-Coronel'],
  ['ten cel', 'Tenente-Coronel'],
  ['tc', 'Tenente-Coronel'],
  ['coronel', 'Coronel'],
  ['cel', 'Coronel'],
]);

const INDICE_POR_POSTO = new Map(POSTOS_GRADUACOES_HIERARQUIA.map((posto, indice) => [posto, indice]));

function copiarEfeito(tipo) {
  const efeito = EFEITOS_ATUALIZACAO_CADASTRO[tipo] || EFEITOS_ATUALIZACAO_CADASTRO.revisao;
  return {
    ...efeito,
    atualizar_cadastro_militar: efeito.atualizar,
    motivo_atualizacao_cadastro: efeito.mensagem,
    resultado_aplicacao_cadastro: efeito.tipo,
    comparacao: efeito.tipo,
  };
}

export function diferencaHierarquicaPostos(postoNovo, postoAtual) {
  const normalizadoNovo = normalizarPostoGraduacao(postoNovo);
  const normalizadoAtual = normalizarPostoGraduacao(postoAtual);
  if (!normalizadoNovo || !normalizadoAtual) return null;

  const indiceNovo = INDICE_POR_POSTO.get(normalizadoNovo);
  const indiceAtual = INDICE_POR_POSTO.get(normalizadoAtual);
  if (!Number.isInteger(indiceNovo) || !Number.isInteger(indiceAtual)) return null;

  return indiceNovo - indiceAtual;
}

export function normalizarPostoGraduacao(valor) {
  const normalizado = ALIASES.get(chave(valor));
  return normalizado || '';
}

export function compararPostos(postoA, postoB) {
  const normalizadoA = normalizarPostoGraduacao(postoA);
  const normalizadoB = normalizarPostoGraduacao(postoB);
  if (!normalizadoA || !normalizadoB) return null;

  const indiceA = INDICE_POR_POSTO.get(normalizadoA);
  const indiceB = INDICE_POR_POSTO.get(normalizadoB);
  if (indiceA === indiceB) return 0;
  return indiceA > indiceB ? 1 : -1;
}

export function isPostoSuperior(postoNovo, postoAtual) {
  return compararPostos(postoNovo, postoAtual) === 1;
}

export function isPostoInferior(postoNovo, postoAtual) {
  return compararPostos(postoNovo, postoAtual) === -1;
}

export function isPostoIgual(postoNovo, postoAtual) {
  return compararPostos(postoNovo, postoAtual) === 0;
}

export function getSugestaoAtualizacaoCadastro({ militar, promocao } = {}) {
  const postoAtual = militar?.posto_graduacao || militar?.posto_graduacao_atual || '';
  const postoNovo = promocao?.posto_graduacao || promocao?.posto_graduacao_novo || '';
  const diferenca = diferencaHierarquicaPostos(postoNovo, postoAtual);

  if (diferenca === null) return copiarEfeito('revisao');
  if (diferenca < 0) return copiarEfeito('historica');
  if (diferenca === 0) return copiarEfeito('atual');
  if (diferenca === 1) return copiarEfeito('imediatamente_superior');
  return copiarEfeito('incompativel');
}

export const MENSAGEM_REBAIXAMENTO_CADASTRAL = MOTIVO_INFERIOR;
export const MENSAGEM_BLOQUEIO_REBAIXAMENTO_CADASTRAL = 'Há militar incompatível com o cadastro atual. Revise antes de salvar.';
