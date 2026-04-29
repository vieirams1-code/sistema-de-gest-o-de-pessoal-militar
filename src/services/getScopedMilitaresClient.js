import { base44 } from '@/api/base44Client';

// =====================================================================
// getScopedMilitaresClient — Lote 1B
// ---------------------------------------------------------------------
// Helper mínimo para invocar a Deno Function `getScopedMilitares` a
// partir do frontend, encapsulando:
//   - leitura do effectiveEmail do sessionStorage (modo usuário efetivo);
//   - normalização do payload;
//   - extração da resposta axios-like (response.data) e fallback seguro.
//
// IMPORTANTE: a validação real de impersonação ocorre no backend.
// O sessionStorage aqui é apenas uma ponte controlada (mesmo padrão
// adotado em useCurrentUser).
// =====================================================================

const EFFECTIVE_EMAIL_STORAGE_KEY = 'sgp_effective_user_email';

function readEffectiveEmailFromStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(EFFECTIVE_EMAIL_STORAGE_KEY);
    const trimmed = (raw || '').trim();
    return trimmed ? trimmed.toLowerCase() : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Lê o effectiveEmail atual da sessão (ou null).
 * Útil para compor queryKey do React Query e payloads.
 */
export function getEffectiveEmail() {
  return readEffectiveEmailFromStorage();
}

/**
 * Invoca a Deno Function `getScopedMilitares` com o payload informado.
 * O effectiveEmail é injetado automaticamente quando presente no
 * sessionStorage (a menos que o caller já tenha passado um valor).
 *
 * @param {Object} payload
 * @returns {Promise<{ militares: Array, meta: Object }>}
 */
export async function fetchScopedMilitares(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : readEffectiveEmailFromStorage();

  const finalPayload = { ...payload };
  if (effectiveEmail) {
    finalPayload.effectiveEmail = effectiveEmail;
  } else {
    delete finalPayload.effectiveEmail;
  }

  const response = await base44.functions.invoke('getScopedMilitares', finalPayload);
  const data = response?.data ?? response ?? {};
  return {
    militares: Array.isArray(data.militares) ? data.militares : [],
    meta: data.meta || {},
  };
}