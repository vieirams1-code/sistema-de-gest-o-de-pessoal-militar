// Sanitiza links de sistemas externos (e-MS, TARS) removendo tokens sensíveis
// da query string/fragmento, preservando o endereço útil do processo.

const PARAMS_SENSIVEIS = [
  'access_token',
  'token',
  'auth',
  'authorization',
  'jwt',
  'id_token',
  'refresh_token',
  'api_key',
  'apikey',
  'key',
  'senha',
  'password',
  'secret',
];

/**
 * @param {string} link
 * @returns {{ linkLimpo: string, removeu: boolean, paramsRemovidos: string[] }}
 */
export function sanitizarLinkExterno(link) {
  const original = String(link || '').trim();
  if (!original) return { linkLimpo: '', removeu: false, paramsRemovidos: [] };

  try {
    const url = new URL(original);
    const removidos = [];

    PARAMS_SENSIVEIS.forEach((param) => {
      // Comparação case-insensitive nas chaves da query string.
      [...url.searchParams.keys()].forEach((chave) => {
        if (chave.toLowerCase() === param) {
          url.searchParams.delete(chave);
          removidos.push(chave);
        }
      });
    });

    // Remove fragmento se contiver indício de token sensível.
    if (url.hash && PARAMS_SENSIVEIS.some((p) => url.hash.toLowerCase().includes(p))) {
      removidos.push('fragmento');
      url.hash = '';
    }

    return {
      linkLimpo: url.toString(),
      removeu: removidos.length > 0,
      paramsRemovidos: [...new Set(removidos)],
    };
  } catch {
    // Não é uma URL válida — devolve como veio, sem sanitização.
    return { linkLimpo: original, removeu: false, paramsRemovidos: [] };
  }
}