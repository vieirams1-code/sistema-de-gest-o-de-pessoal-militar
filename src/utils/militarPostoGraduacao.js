export function getPostoGraduacaoOficial(militar = {}) {
  return String(
    militar?.posto_graduacao
    || militar?.['posto_graduação']
    || militar?.posto_grad
    || militar?.posto
    || militar?.graduacao
    || ''
  ).trim();
}

export function normalizarPostoGraduacaoMilitar(militar = {}) {
  const postoGraduacao = getPostoGraduacaoOficial(militar);
  if (!postoGraduacao) return militar;
  if (String(militar?.posto_graduacao || '').trim() === postoGraduacao) return militar;
  return {
    ...militar,
    posto_graduacao: postoGraduacao,
  };
}
