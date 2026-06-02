export function isAtestadoAcompanhamento(acompanhado) {
  return acompanhado === true;
}

export function normalizeDadosAcompanhamentoAtestado(atestado = {}) {
  if (isAtestadoAcompanhamento(atestado.acompanhado)) return atestado;

  return {
    ...atestado,
    acompanhado_nome: '',
    grau_parentesco: '',
  };
}
