export const CHAVES_INSTITUCIONAIS_UNICAS = new Set(['comandante', 'subcomandante']);

export function normalizarChaveInstitucional(valor) {
  return String(valor || '').trim().toLowerCase();
}

export function separarFuncoesPorStatus(funcoes = []) {
  const ativas = [];
  const encerradas = [];

  funcoes.forEach((item) => {
    if (String(item?.status || '').toLowerCase() === 'ativa') {
      ativas.push(item);
      return;
    }
    encerradas.push(item);
  });

  return { ativas, encerradas };
}

export function validarDuplicidadeInstitucionalAtiva({ vinculosAtivos = [], funcaoSelecionada }) {
  const chaveSelecionada = normalizarChaveInstitucional(funcaoSelecionada?.institucional_chave);
  if (!CHAVES_INSTITUCIONAIS_UNICAS.has(chaveSelecionada)) {
    return null;
  }

  const jaExisteAtiva = vinculosAtivos.some((vinculo) => {
    const chave = normalizarChaveInstitucional(vinculo?.funcao?.institucional_chave);
    return chave === chaveSelecionada;
  });

  if (!jaExisteAtiva) return null;

  if (chaveSelecionada === 'comandante') {
    return 'Este militar já possui a função Comandante ativa.';
  }

  return 'Este militar já possui a função Subcomandante ativa.';
}
