import { getFeriasTagTagId, isRegistroAtivo } from './contratoCampos';

export const APLICABILIDADE_TAG_FERIAS = new Set(['', 'ferias', 'todos', 'ambos']);

const normalizarTexto = (valor) => String(valor || '').trim().toLowerCase();
const isCampoFalseExplicito = (valor) => {
  if (valor === false) return true;
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    return ['false', '0', 'nao', 'não'].includes(normalizado);
  }
  if (typeof valor === 'number') return valor === 0;
  return false;
};

export function isFeriasTagVinculoAtivo(vinculo = {}) {
  const status = normalizarTexto(vinculo?.status);
  const statusAtivo = status === 'ativa' || status === 'ativo';
  const semRemocao = !vinculo?.data_remocao;
  const campoAtivoValido = !isCampoFalseExplicito(vinculo?.ativo);
  const campoAtivaValido = !isCampoFalseExplicito(vinculo?.ativa);
  return statusAtivo && semRemocao && campoAtivoValido && campoAtivaValido;
}

export function separarTagsFeriasPorStatus(vinculos = []) {
  const ativas = [];
  const removidas = [];

  vinculos.forEach((vinculo) => {
    if (isFeriasTagVinculoAtivo(vinculo)) {
      ativas.push(vinculo);
      return;
    }
    removidas.push(vinculo);
  });

  return { ativas, removidas };
}

export function validarAplicabilidadeTagFerias(tag) {
  if (!tag) return 'Selecione uma tag válida.';
  if (!APLICABILIDADE_TAG_FERIAS.has(normalizarTexto(tag.aplicabilidade))) {
    return 'Esta tag não pode ser aplicada em férias.';
  }
  return null;
}

export function isTagAplicavelEmFerias(tag) {
  return isRegistroAtivo(tag) && !validarAplicabilidadeTagFerias(tag);
}

export function validarDuplicidadeTagAtivaFerias({ vinculosAtivos = [], tagId }) {
  const alvo = String(tagId || '');
  const existe = vinculosAtivos.some((vinculo) => isFeriasTagVinculoAtivo(vinculo) && String(getFeriasTagTagId(vinculo) || '') === alvo);
  return existe ? 'Estas férias já possuem esta tag ativa.' : null;
}


export function isTagAplicavelNoAtestado(tag) {
  const aplicabilidade = normalizarTexto(tag?.aplicabilidade);
  return isRegistroAtivo(tag) && (aplicabilidade === 'atestado' || aplicabilidade === 'todos');
}
