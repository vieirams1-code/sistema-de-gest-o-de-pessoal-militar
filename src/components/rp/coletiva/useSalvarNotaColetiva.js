import { useMutation, useQueryClient } from '@tanstack/react-query';
import { criarEscopado, atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { base44 } from '@/api/base44Client';

export default function useSalvarNotaColetiva(onSuccess) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados, militares, token, excluir }) => {
      const data = { ...dados, coletiva: true, coletiva_token: token, militares_ids: militares.map(m => m.militar_id) };
      const effectiveEmail = getEffectiveEmail();
      if (effectiveEmail) {
        const res = await base44.functions.invoke('cudEscopado', { entityName: 'PublicacaoExOfficio', operation: excluir ? 'delete' : id ? 'update' : 'create', registroId: id || null, data, effectiveEmail });
        if (res.data?.error) throw new Error(res.data.error);
        return res.data.data;
      }
      return excluir ? excluirEscopado('PublicacaoExOfficio', id) : id ? atualizarEscopado('PublicacaoExOfficio', id, data) : criarEscopado('PublicacaoExOfficio', data);
    },
    onSuccess: async result => {
      await queryClient.invalidateQueries({ predicate: q => /publicac|registros-militar|registro-rp|militar-timeline|folha-alteracoes/.test(String(q.queryKey[0])) });
      onSuccess(result);
    },
  });
}