import { base44 } from '@/api/base44Client';

export async function getAtestadoAnexoSignedUrlClient(atestado_id) {
  const response = await base44.functions.invoke('getAtestadoAnexoSignedUrl', { atestado_id });
  const data = response?.data ?? response ?? {};
  return {
    url: data?.url ? String(data.url) : '',
    expires_in: Number(data?.expires_in) || 0,
    atestado_id: data?.atestado_id ? String(data.atestado_id) : '',
  };
}
