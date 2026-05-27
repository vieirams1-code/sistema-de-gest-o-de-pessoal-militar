import { base44 } from '@/api/base44Client';

export async function registrarAuditoriaExtratoAtestadosClient(payload = {}) {
  const response = await base44.functions.invoke('registrarAuditoriaExtratoAtestados', payload);
  const data = response?.data ?? response ?? {};
  return {
    ok: Boolean(data?.ok),
    warning: data?.warning ? String(data.warning) : '',
  };
}
