
/**
 * Helpers oficiais para leitura de Posto/Graduação e Quadro da entidade Militar.
 * Centraliza a lógica de prioridade de campos (oficial vs aliases) para evitar divergências.
 */

const ALIASES_POSTO = [
  'posto_graduacao',
  'postoGraduacao',
  'posto_grad',
  'posto_graduacao_atual',
  'posto',
  'graduacao',
  'rank'
];

const ALIASES_QUADRO = [
  'quadro',
  'quadro_atual',
  'quadroAtual',
  'quadro_militar',
  'militar_quadro',
  'qbmp'
];

/**
 * Obtém o Posto/Graduação do militar seguindo a ordem de prioridade.
 */
export function getPostoGraduacaoMilitar(militar) {
  if (!militar) return '';

  for (const campo of ALIASES_POSTO) {
    const valor = militar[campo];
    if (valor && String(valor).trim()) {
      if (campo !== 'posto_graduacao') {
        console.warn(`[MilitarPostoGraduacao]\nAlias utilizado:\nmilitarId=${militar.id || 'N/A'}\nmatricula=${militar.matricula || 'N/A'}\ncampo=${campo}`);
      }
      return String(valor).trim();
    }
  }

  return '';
}

/**
 * Obtém o Quadro do militar seguindo a ordem de prioridade.
 */
export function getQuadroMilitar(militar) {
  if (!militar) return '';

  for (const campo of ALIASES_QUADRO) {
    const valor = militar[campo];
    if (valor && String(valor).trim()) {
      if (campo !== 'quadro') {
        console.warn(`[MilitarPostoGraduacao]\nAlias utilizado:\nmilitarId=${militar.id || 'N/A'}\nmatricula=${militar.matricula || 'N/A'}\ncampo=${campo}`);
      }
      return String(valor).trim();
    }
  }

  return '';
}

/**
 * Alias para manter compatibilidade com chamadas existentes.
 * @deprecated Use getPostoGraduacaoMilitar
 */
export const getPostoGraduacaoOficial = (m) => getPostoGraduacaoMilitar(m);
