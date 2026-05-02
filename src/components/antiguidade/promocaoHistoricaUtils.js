export const POSTOS_GRADUACOES = [
  'Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante a Oficial',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
];

export const QUADROS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QOETBM', 'QOSTBM', 'QPTBM'];

const normalizar = (valor) => String(valor || '').trim().toLowerCase();

export function resolverQuadroPromocao({ postoAnterior, postoNovo, quadroInformado, quadroAtual }) {
  const anterior = normalizar(postoAnterior);
  const novo = normalizar(postoNovo);

  if (anterior === 'subtenente' && novo === '2º tenente') {
    return 'QAOBM';
  }

  return String(quadroInformado || quadroAtual || '').trim();
}
