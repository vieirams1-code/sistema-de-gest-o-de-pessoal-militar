function normalizeKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const FERIAS_TIPO_CANONICO = {
  SAIDA: 'Saída Férias',
  INTERRUPCAO: 'Interrupção de Férias',
  CONTINUACAO: 'Continuação de Férias',
  RETORNO: 'Retorno Férias',
};

const ALIAS_TO_CANONICO = new Map([
  ['inicio de ferias', FERIAS_TIPO_CANONICO.SAIDA],
  ['saida ferias', FERIAS_TIPO_CANONICO.SAIDA],

  ['interrupcao de ferias', FERIAS_TIPO_CANONICO.INTERRUPCAO],

  ['continuacao', FERIAS_TIPO_CANONICO.CONTINUACAO],
  ['nova saida', FERIAS_TIPO_CANONICO.CONTINUACAO],
  ['retomada', FERIAS_TIPO_CANONICO.CONTINUACAO],
  ['continuacao de ferias', FERIAS_TIPO_CANONICO.CONTINUACAO],
  ['nova saida retomada', FERIAS_TIPO_CANONICO.CONTINUACAO],

  ['termino', FERIAS_TIPO_CANONICO.RETORNO],
  ['retorno de ferias', FERIAS_TIPO_CANONICO.RETORNO],
  ['retorno ferias', FERIAS_TIPO_CANONICO.RETORNO],
]);

export function resolverTipoFeriasCanonico(tipo = '') {
  const key = normalizeKey(tipo);
  return ALIAS_TO_CANONICO.get(key) || null;
}

export function ehTipoFerias(tipo = '') {
  return Boolean(resolverTipoFeriasCanonico(tipo));
}

export function getTipoFeriasOperacional(canonico = '') {
  if (canonico === FERIAS_TIPO_CANONICO.CONTINUACAO) return 'Nova Saída / Retomada';
  return canonico;
}

export function getLabelTipoFerias(canonico = '') {
  if (canonico === FERIAS_TIPO_CANONICO.SAIDA) return 'Início';
  if (canonico === FERIAS_TIPO_CANONICO.INTERRUPCAO) return 'Interrupção';
  if (canonico === FERIAS_TIPO_CANONICO.CONTINUACAO) return 'Continuação';
  if (canonico === FERIAS_TIPO_CANONICO.RETORNO) return 'Término';
  return canonico;
}
