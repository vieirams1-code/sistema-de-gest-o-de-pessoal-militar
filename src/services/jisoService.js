import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/utils/impersonation';

export const jisoContextKey = (email = '') => getEffectiveEmail() || email;
export const invalidateJisoQueries = (queryClient) => queryClient.invalidateQueries({ predicate: (query) => /jiso|atestado|quadro|publicac|saude|efetivo|afastamento|dashboard/i.test(String(query.queryKey[0] || '')) });

async function invoke(acao, payload = {}) {
  const response = await base44.functions.invoke('jisoGateway', { acao, ...payload, ...(getEffectiveEmail() ? { effectiveEmail: getEffectiveEmail() } : {}) });
  const data = response?.data || response || {};
  if (data?.success === false || data?.error) {
    const err = new Error(data?.error || 'Falha na operação de JISO.');
    err.code = data?.code;
    err.meta = data?.meta;
    throw err;
  }
  return data;
}

export const jisoService = {
  listar: () => invoke('LISTAR'),
  atestadosDisponiveis: () => invoke('ATESTADOS_DISPONIVEIS'),
  detalhar: (jisoId) => invoke('DETALHAR', { jiso_id: jisoId }),
  criar: ({ atestadoIds, jiso }) => invoke('CRIAR', { atestado_ids: atestadoIds, jiso }),
  atualizar: (jisoId, jiso, versao) => invoke('ATUALIZAR', { jiso_id: jisoId, jiso, versao }),
  vincularAtestados: (jisoId, atestadoIds) => invoke('VINCULAR_ATESTADOS', { jiso_id: jisoId, atestado_ids: atestadoIds }),
  removerVinculo: (jisoId, atestadoId, motivo) => invoke('REMOVER_VINCULO', { jiso_id: jisoId, atestado_id: atestadoId, motivo }),
  cancelar: (jisoId, motivo) => invoke('CANCELAR', { jiso_id: jisoId, motivo }),
  publicarAta: (jisoId, publicacao) => invoke('PUBLICAR_ATA', { jiso_id: jisoId, publicacao }),
  migracao: ({ aplicar = false, jisoIdContexto = '' } = {}) => invoke(aplicar ? 'MIGRACAO_APLICAR' : 'MIGRACAO_DRY_RUN', { jiso_id: jisoIdContexto }),
};
