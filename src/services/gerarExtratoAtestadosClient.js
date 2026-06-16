import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
// (P0.1) Usa o helper central de impersonação (envelope com TTL) em vez de
// ler sgp_effective_user_email diretamente do sessionStorage.
import { getEffectiveEmail as getEffectiveEmailFromStorage } from '@/utils/impersonation';

const buildBase44FunctionHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (appParams.appId) headers['X-App-Id'] = appParams.appId;
  if (appParams.functionsVersion) headers['Base44-Functions-Version'] = appParams.functionsVersion;

  return headers;
};

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (_e) {
    return {};
  }
}

export async function gerarExtratoAtestados(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmailFromStorage();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.fetch('gerarExtratoAtestados', {
    method: 'POST',
    headers: buildBase44FunctionHeaders(),
    body: JSON.stringify(finalPayload),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok || data?.error) {
    const error = new Error(String(data?.error || 'Falha ao gerar extrato de atestados.'));
    error.status = response.status;
    error.meta = data?.meta || {};
    error.raw = { response: { status: response.status, statusText: response.statusText }, data };
    throw error;
  }

  return {
    formato: data.formato === 'pdf' ? 'pdf' : 'xlsx',
    atestados: Array.isArray(data.atestados) ? data.atestados : [],
    extrato_parcial: Boolean(data.extrato_parcial),
    meta: {
      ...(data.meta || {}),
      sensiveis_incluidos: Boolean(data?.meta?.sensiveis_incluidos),
      sensiveis_bloqueados: Boolean(data?.meta?.sensiveis_bloqueados),
    },
  };
}