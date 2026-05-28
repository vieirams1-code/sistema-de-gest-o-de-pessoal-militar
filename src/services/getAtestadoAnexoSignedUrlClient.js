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
export async function abrirAnexoAtestadoEmNovaAba(atestadoId, preOpenedTab = null) {
  const { url } = await getAtestadoAnexoSignedUrlClient(atestadoId);

  const directTab = typeof window !== 'undefined'
    ? window.open(url, '_blank', 'noopener,noreferrer')
    : null;

  if (directTab) return { url, opened: true, strategy: 'direct' };

  if (preOpenedTab && !preOpenedTab.closed) {
    preOpenedTab.location.href = url;
    return { url, opened: true, strategy: 'preopened' };
  }

  const error = new Error('O navegador bloqueou a abertura automática da nova aba.');
  error.code = 'POPUP_BLOCKED';
  error.detail = { url };
  throw error;
}