import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const buildBase44FunctionHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (appParams.appId) {
    headers['X-App-Id'] = appParams.appId;
  }

  if (appParams.functionsVersion) {
    headers['Base44-Functions-Version'] = appParams.functionsVersion;
  }

  return headers;
};

export async function gerarZipAnexosAtestadosClient(idsSelecionados = []) {
  const response = await base44.functions.fetch('gerarZipAnexosAtestados', {
    method: 'POST',
    headers: buildBase44FunctionHeaders(),
    body: JSON.stringify({ idsSelecionados }),
  });

  if (!response.ok) {
    let errorData = {};
    try { errorData = await response.json(); } catch { errorData = {}; }
    const error = new Error(String(errorData?.error || 'Falha ao gerar ZIP de anexos.'));
    error.code = String(errorData?.code || '');
    error.meta = errorData?.meta || {};
    error.detail = errorData?.detail || null;
    error.status = response.status;
    error.raw = { response: { status: response.status, statusText: response.statusText }, data: errorData };
    throw error;
  }

  return {
    blob: await response.blob(),
    fileName: response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || `anexos-atestados-${new Date().toISOString().slice(0, 10)}.zip`,
    meta: {
      quantidade_anexos: Number(response.headers.get('x-quantidade-anexos') || 0),
      arquivos_ignorados_sem_anexo: Number(response.headers.get('x-arquivos-ignorados-sem-anexo') || 0),
      extrato_parcial: response.headers.get('x-extrato-parcial') === 'true',
      arquivos_ignorados_falha: Number(response.headers.get('x-arquivos-ignorados-falha') || 0),
      legacy_attachment_count: Number(response.headers.get('x-legacy-attachment-count') || 0),
    },
  };
}
