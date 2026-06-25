export const TIPO_DESCONTO_FERIAS = 'Dispensa com Desconto em Férias';
export const TIPO_TORNAR_SEM_EFEITO = 'Tornar sem Efeito';
export const STATUS_FERIAS_BLOQUEIAM_REVERSAO = ['Gozada', 'Finalizada', 'Retornada', 'Concluída', 'Encerrada'];

export function publicacaoEstaPublicada(pub = {}) {
  if (String(pub.status || '').trim() === 'Publicado') return true;
  return Boolean(pub.numero_bg && pub.data_bg);
}

export function deveAplicarReversaoDesconto(desconto = {}) {
  if (String(desconto.status || '') === 'revertido') return false;
  if (desconto.saldo_aplicado === false) return false;
  return String(desconto.status || '') === 'ativo' && desconto.saldo_aplicado === true;
}

export function calcularDiasDireitoAposReversao(periodo = {}, desconto = {}) {
  const atual = Number.isFinite(Number(periodo.dias_direito)) ? Number(periodo.dias_direito) : 30;
  const dias = Math.max(0, Number(desconto.dias) || 0);
  return { atual, dias, novo: atual + dias };
}

export function feriasBloqueiaReversao(ferias = {}) {
  return STATUS_FERIAS_BLOQUEIAM_REVERSAO.includes(String(ferias.status || '').trim());
}
