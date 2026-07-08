import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

const buildBase44FunctionHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
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

export async function criarAjusteSaldoFerias(payload = {}) {
  const effectiveEmail = getEffectiveEmail();
  const finalPayload = {
    ...(payload || {}),
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.fetch('criarAjusteSaldoFerias', {
    method: 'POST',
    headers: buildBase44FunctionHeaders(),
    body: JSON.stringify(finalPayload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok || body?.error) {
    const message = body?.error || response.statusText || 'Falha ao criar ajuste de saldo de férias.';
    const error = new Error(`${message} (HTTP ${response.status})`);
    error.status = response.status;
    throw error;
  }

  return body;
}
