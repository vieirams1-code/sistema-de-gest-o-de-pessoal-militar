import { base44 } from '@/api/base44Client';

export async function gerarExtratoAtestados(payload = {}) {
  const response = await base44.functions.invoke('gerarExtratoAtestados', payload);
  const data = response?.data ?? response ?? {};
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
