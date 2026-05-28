import { base44 } from '@/api/base44Client';

export async function getAtestadoAnexoSignedUrlClient(atestado_id) {
  const response = await base44.functions.invoke('getAtestadoAnexoSignedUrl', { atestado_id });
  const data = response?.data ?? response ?? {};

  if (response?.error || !data?.url) {
    const error = new Error(String(data?.error || data?.message || response?.error?.message || 'Falha ao obter URL do anexo.'));
    error.code = String(data?.code || response?.error?.code || 'SIGNED_URL_FAILED');
    error.detail = data?.detail || null;
    error.status = Number(response?.status || response?.error?.status || data?.status || 0) || null;
    error.raw = { response, data };
    throw error;
  }

  return {
    url: String(data.url),
    expires_in: Number(data?.expires_in) || 0,
    atestado_id: data?.atestado_id ? String(data.atestado_id) : '',
    source: String(data?.source || ''),
  };
}

// Abre o anexo do atestado em uma nova aba de forma segura para navegadores modernos.
// Estratégia: abre a aba IMEDIATAMENTE (dentro do user-gesture do clique),
// depois faz o await pela signed URL e atualiza `popup.location`. Sem isso,
// muitos navegadores bloqueiam window.open chamado após await.
export async function obterLinkAnexoAtestado(atestadoId) {
  const { url } = await getAtestadoAnexoSignedUrlClient(atestadoId);
  let finalUrl;
  try {
    finalUrl = new URL(String(url), window.location.origin);
  } catch (_e) {
    const error = new Error('URL de anexo inválida retornada pelo backend.');
    error.code = 'INVALID_ATTACHMENT_URL';
    error.detail = { url };
    throw error;
  }

  if (!/^https?:$/.test(finalUrl.protocol)) {
    const error = new Error('URL de anexo não é HTTP/HTTPS.');
    error.code = 'INVALID_ATTACHMENT_URL_PROTOCOL';
    error.detail = { url: finalUrl.toString(), protocol: finalUrl.protocol };
    throw error;
  }
  return { url: finalUrl.toString() };
}
