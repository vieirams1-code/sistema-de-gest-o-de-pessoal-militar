import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchPreviaAntiguidadeMilitares } from '@/services/getPreviaAntiguidadeMilitaresClient';
import { comporTextoNotaColetiva } from '@/services/notaColetivaTextoService';

export default function useComposicaoNotaColetiva(dados, militares, regenerar) {
  const ids = militares.map(m => String(m.militar_id)).sort();
  const gerar = dados.modo_texto_coletivo === 'lista' && regenerar;
  const consulta = useQuery({
    queryKey: ['nota-coletiva-composicao', getEffectiveEmail() || 'self', ids],
    enabled: gerar && ids.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const [efetivo, historico, configs] = await Promise.all([
        fetchScopedMilitares({ militarIds: ids, limit: 500, includeFoto: false }),
        fetchPreviaAntiguidadeMilitares({ idsMilitares: ids }),
        base44.entities.ConfiguracaoAntiguidade.filter({ ativo: true }, '-updated_date', 1),
      ]);
      if (efetivo.militares.length !== ids.length) throw new Error('Não foi possível carregar todos os militares selecionados. Confira os vínculos antes de salvar.');
      return { militares: efetivo.militares, historicos: historico.historicoPromocoes, config: configs[0] || {} };
    },
  });
  const composicao = gerar && consulta.data ? comporTextoNotaColetiva(dados.cabecalho_coletiva, consulta.data.militares, consulta.data.historicos, consulta.data.config) : null;
  return { texto: gerar ? composicao?.texto || '' : dados.texto_publicacao, ids: composicao?.ids, pendencias: composicao?.pendencias || 0, carregando: gerar && ids.length > 0 && consulta.isPending, erro: gerar ? consulta.error : null };
}