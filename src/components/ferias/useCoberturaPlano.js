import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useCoberturaPlano(planoId, enabled, userEmail) {
  return useQuery({
    queryKey: ['cobertura-plano-ferias-v2', planoId, userEmail],
    enabled: Boolean(planoId && enabled),
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const { data } = await base44.functions.invoke('portal_servicos', { acao: 'PLANO_ESCALA_LISTAR', plano_id: planoId, incluir_cobertura: true });
      if (!data?.ok || !Array.isArray(data.cobertura)) throw new Error(data?.cobertura_erro || data?.error || 'Não foi possível consultar a cobertura deste plano.');
      return data.cobertura;
    },
  });
}