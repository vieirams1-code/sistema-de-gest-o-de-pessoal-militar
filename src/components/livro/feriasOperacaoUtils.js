export const FERIAS_OPERACOES = {
  INICIO: 'inicio',
  INTERRUPCAO: 'interrupcao',
  CONTINUACAO: 'continuacao',
  TERMINO: 'termino',
};

export const FERIAS_TIPO_MAP = {
  'Saída Férias': FERIAS_OPERACOES.INICIO,
  'Interrupção de Férias': FERIAS_OPERACOES.INTERRUPCAO,
  'Nova Saída / Retomada': FERIAS_OPERACOES.CONTINUACAO,
  'Retorno Férias': FERIAS_OPERACOES.TERMINO,
};

export const FERIAS_OPERACAO_LABELS = {
  [FERIAS_OPERACOES.INICIO]: 'Início de Férias',
  [FERIAS_OPERACOES.INTERRUPCAO]: 'Interrupção de Férias',
  [FERIAS_OPERACOES.CONTINUACAO]: 'Continuação de Férias',
  [FERIAS_OPERACOES.TERMINO]: 'Término de Férias',
};

const STATUS_INICIAVEIS = new Set(['Prevista', 'Autorizada']);

function getPeriodoSortKey(ferias) {
  const ref = ferias?.periodo_aquisitivo_ref || '';
  const match = String(ref).match(/(\d{4})\s*\/\s*(\d{4})/);

  if (match) return Number(match[1]);

  if (ferias?.data_inicio) {
    const d = new Date(`${ferias.data_inicio}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

export function ordenarFerias(lista = []) {
  return [...lista].sort((a, b) => {
    const ka = getPeriodoSortKey(a);
    const kb = getPeriodoSortKey(b);
    if (ka !== kb) return ka - kb;

    const da = a?.data_inicio ? new Date(`${a.data_inicio}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b?.data_inicio ? new Date(`${b.data_inicio}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

export function getLivroOperacaoFerias(tipoRegistro) {
  return FERIAS_TIPO_MAP[tipoRegistro] || null;
}

export function getLivroOperacaoFeriasLabel(operacao) {
  return FERIAS_OPERACAO_LABELS[operacao] || 'Férias';
}

export function isTipoRegistroFerias(tipoRegistro) {
  return Boolean(getLivroOperacaoFerias(tipoRegistro));
}

export function getFeriasElegiveisPorOperacao(ferias = [], operacao) {
  const lista = ordenarFerias(ferias);

  if (operacao === FERIAS_OPERACOES.INTERRUPCAO || operacao === FERIAS_OPERACOES.TERMINO) {
    return lista.filter((item) => item.status === 'Em Curso');
  }

  if (operacao === FERIAS_OPERACOES.CONTINUACAO) {
    return lista.filter((item) => item.status === 'Interrompida');
  }

  if (operacao === FERIAS_OPERACOES.INICIO) {
    const emCurso = lista.filter((item) => item.status === 'Em Curso');
    if (emCurso.length > 0) return [];

    const interrompidas = lista.filter((item) => item.status === 'Interrompida');
    if (interrompidas.length > 0) return [];

    const previstas = lista.filter((item) => STATUS_INICIAVEIS.has(item.status));
    if (previstas.length === 0) return [];

    return previstas.slice(0, 1);
  }

  return [];
}

export function hasMilitarElegivelParaOperacao(ferias = [], operacao) {
  return getFeriasElegiveisPorOperacao(ferias, operacao).length > 0;
}

export function getMensagemSemElegibilidade(operacao) {
  const label = getLivroOperacaoFeriasLabel(operacao);
  return {
    titulo: 'Nenhum militar elegível para este tipo de lançamento na data informada.',
    texto: `Verifique se há férias previstas, em andamento ou interrompidas compatíveis com a operação selecionada (${label}).`,
  };
}
