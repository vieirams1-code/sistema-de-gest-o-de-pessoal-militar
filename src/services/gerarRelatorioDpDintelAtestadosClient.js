import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

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

const buildBase44FunctionHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (appParams.appId) headers['X-App-Id'] = appParams.appId;
  if (appParams.functionsVersion) headers['Base44-Functions-Version'] = appParams.functionsVersion;
  return headers;
};

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/pdf' });
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (_e) {
    return {};
  }
}

export async function gerarRelatorioDpDintelAtestados(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : readEffectiveEmailFromStorage();
  const finalPayload = { ...payload, incluirHistorico: false };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.fetch('gerarRelatorioDpDintelAtestados', {
    method: 'POST',
    headers: buildBase44FunctionHeaders(),
    body: JSON.stringify(finalPayload),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok || data?.error || !data?.base64) {
    const detail = data?.meta?.detail || data?.detail || response.statusText || '';
    const baseMessage = String(data?.error || 'Falha ao gerar relatório DP/DINTEL.');
    const fullMessage = response.status === 429
      ? 'Limite de requisições excedido. Aguarde alguns segundos e tente novamente.'
      : (detail && !baseMessage.includes(detail) ? `${baseMessage} (HTTP ${response.status}: ${detail})` : `${baseMessage} (HTTP ${response.status})`);
    const error = new Error(fullMessage);
    error.code = String(data?.code || 'REPORT_FAILED');
    error.status = response.status;
    error.meta = data?.meta || {};
    error.raw = { response: { status: response.status, statusText: response.statusText }, data };
    throw error;
  }

  return {
    blob: base64ToBlob(data.base64, data.mimeType || 'application/pdf'),
    fileName: data.fileName || `relatorio-dp-dintel-atestados-sem-historico-${new Date().toISOString().slice(0, 10)}.pdf`,
    meta: data.meta || {},
  };
}