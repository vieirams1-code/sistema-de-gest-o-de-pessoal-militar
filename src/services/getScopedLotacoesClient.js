import { base44 } from '@/api/base44Client';

// =====================================================================
// getScopedLotacoesClient — Lote 1C-A
// ---------------------------------------------------------------------
// Helper mínimo para invocar a Deno Function `getScopedLotacoes` a partir
// do frontend. Encapsula:
//   - leitura do effectiveEmail do sessionStorage (modo usuário efetivo);
//   - normalização do payload;
//   - extração da resposta axios-like (response.data) com fallback seguro.
//
// A validação real de impersonação ocorre no backend; o sessionStorage
// aqui é apenas uma ponte controlada (mesmo padrão do
// getScopedMilitaresClient e do useCurrentUser).
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

export function getEffectiveEmail() {
  return readEffectiveEmailFromStorage();
}

/**
 * Invoca a Deno Function `getScopedLotacoes`.
 *
 * @param {Object} payload
 * @returns {Promise<{ lotacoes: Array, meta: Object }>}
 */
export async function fetchScopedLotacoes(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : readEffectiveEmailFromStorage();

  const finalPayload = { ...payload };
  if (effectiveEmail) {
    finalPayload.effectiveEmail = effectiveEmail;
  } else {
    delete finalPayload.effectiveEmail;
  }

  const response = await base44.functions.invoke('getScopedLotacoes', finalPayload);
  const data = response?.data ?? response ?? {};
  return {
    lotacoes: Array.isArray(data.lotacoes) ? data.lotacoes : [],
    meta: data.meta || {},
  };
}