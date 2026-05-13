export function isPeriodoDisponivelOperacional(periodo) {
  if (!periodo) return false;
  if (periodo.inativo === true) return false;
  if (periodo.status === 'Inativo') return false;
  if (periodo.legado_ativa === true) return false;
  if (periodo.excluido_da_cadeia_designacao === true) return false;
  if (periodo.cancelado_transicao === true) return false;
  return true;
}
