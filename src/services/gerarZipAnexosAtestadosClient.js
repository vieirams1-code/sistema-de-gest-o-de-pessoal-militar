import { appParams } from '@/lib/app-params';

export async function gerarZipAnexosAtestadosClient(idsSelecionados = []) {
  const response = await fetch(`${appParams.serverUrl}/functions/v1/gerarZipAnexosAtestados`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appParams.token}`,
      apikey: appParams.appId,
    },
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
    },
  };
}
