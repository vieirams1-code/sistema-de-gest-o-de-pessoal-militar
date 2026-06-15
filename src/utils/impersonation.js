// =====================================================================
// utils/impersonation.js — Sprint P0 Segurança
// ---------------------------------------------------------------------
// Gerencia o "modo usuário efetivo" (impersonação para suporte/teste
// administrativo) com um ENVELOPE COM EXPIRAÇÃO (TTL) no sessionStorage.
//
// Formato persistido (novo):
//   { email, startedAt, expiresAt }   // timestamps em ms (epoch)
//
// Compatibilidade: se for encontrada uma string legada simples (apenas o
// email), ela é convertida automaticamente para o novo envelope com TTL.
//
// IMPORTANTE: esta chave NÃO concede privilégio algum por si só. A
// validação real (somente admin real pode impersonar) ocorre no backend
// (getUserPermissions, getScopedMilitares, getScopedAtestadosBundle, etc.).
// Este módulo apenas garante TTL, encerramento e leitura segura no front.
// =====================================================================

export const EFFECTIVE_EMAIL_STORAGE_KEY = 'sgp_effective_user_email';

// TTL padrão de impersonação: 60 minutos.
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

function hasSessionStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

function normalizeEmail(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * Remove a impersonação do sessionStorage (operação idempotente e segura).
 */
export function clearImpersonation() {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(EFFECTIVE_EMAIL_STORAGE_KEY);
  } catch (_e) {
    // ignore
  }
}

/**
 * Lê o estado atual de impersonação aplicando TTL.
 * - Converte valor legado (string simples) para envelope com TTL.
 * - Se expirado, limpa e retorna null.
 *
 * @returns {{ email: string, startedAt: number, expiresAt: number } | null}
 */
export function getImpersonationState() {
  if (!hasSessionStorage()) return null;

  let raw = null;
  try {
    raw = window.sessionStorage.getItem(EFFECTIVE_EMAIL_STORAGE_KEY);
  } catch (_e) {
    return null;
  }

  if (!raw) return null;

  const now = Date.now();

  // Tenta interpretar como envelope JSON.
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    parsed = null;
  }

  // Caso legado: string simples (email puro). Converte para envelope com TTL.
  if (parsed === null || typeof parsed !== 'object') {
    const email = normalizeEmail(raw);
    if (!email) {
      clearImpersonation();
      return null;
    }
    const envelope = { email, startedAt: now, expiresAt: now + IMPERSONATION_TTL_MS };
    try {
      window.sessionStorage.setItem(EFFECTIVE_EMAIL_STORAGE_KEY, JSON.stringify(envelope));
    } catch (_e) {
      // ignore
    }
    return envelope;
  }

  const email = normalizeEmail(parsed.email);
  const expiresAt = Number(parsed.expiresAt);

  if (!email) {
    clearImpersonation();
    return null;
  }

  // TTL expirado → encerra impersonação silenciosa.
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    clearImpersonation();
    return null;
  }

  return {
    email,
    startedAt: Number(parsed.startedAt) || now,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : now + IMPERSONATION_TTL_MS,
  };
}

/**
 * Retorna apenas o email efetivo válido (ou null), respeitando o TTL.
 * Substitui a leitura direta do sessionStorage feita anteriormente.
 */
export function getEffectiveEmail() {
  return getImpersonationState()?.email || null;
}

/**
 * Inicia/renova a impersonação com TTL padrão.
 */
export function startImpersonation(email) {
  if (!hasSessionStorage()) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const now = Date.now();
  const envelope = { email: normalized, startedAt: now, expiresAt: now + IMPERSONATION_TTL_MS };
  try {
    window.sessionStorage.setItem(EFFECTIVE_EMAIL_STORAGE_KEY, JSON.stringify(envelope));
  } catch (_e) {
    return null;
  }
  return envelope;
}