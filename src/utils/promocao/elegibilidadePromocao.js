function normalizarTexto(valor = '') {
  return String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
}

export function isPromocaoSubtenenteParaSegundoTenenteQAOBM(promocao = {}) {
  const postoDestino = normalizarTexto(promocao?.posto_graduacao);
  const quadroDestino = normalizarTexto(promocao?.quadro);
  return ['2ºtenente','2otenente','2tenente','2ºten','2oten','2ten','segundotenente','segundoten'].includes(postoDestino) && quadroDestino === 'qaobm';
}

export function getPostoOrigemEsperado(promocao = {}) {
  if (isPromocaoSubtenenteParaSegundoTenenteQAOBM(promocao)) return 'Subtenente';
  return '';
}
