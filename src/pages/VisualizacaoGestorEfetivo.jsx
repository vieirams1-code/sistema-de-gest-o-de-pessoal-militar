import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import VisualizacoesGestor from '@/components/efetivo-gestor/VisualizacoesGestor';
import montarArvoreLotacaoMilitares from '@/utils/efetivo/montarArvoreLotacaoMilitares';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import { fetchPreviaAntiguidadeMilitares } from '@/services/getPreviaAntiguidadeMilitaresClient';
import { calcularPreviaAntiguidadeGeral } from '@/utils/antiguidade/calcularPreviaAntiguidadeGeral';
import { getPosicaoOficialAntiguidadeFromCache } from '@/utils/antiguidade/getPosicaoOficialAntiguidade';

export default function VisualizacaoGestorEfetivo() {
  const [busca, setBusca] = useState('');
  const { canAccessModule, isAccessResolved } = useCurrentUser();
  const effectiveEmail = getEffectiveEmail();
  const queryClient = useQueryClient();

  const militaresQuery = useQuery({
    queryKey: ['gestor-efetivo-militares', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: async () => {
      const data = await fetchScopedMilitares({});
      console.log("VISAO_GESTOR_MILITARES", data.militares.length);
      return data;
    },
  });

  const lotacoesQuery = useQuery({
    queryKey: ['gestor-efetivo-lotacoes', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: () => fetchScopedLotacoes({}),
  });


  const idsMilitaresCarregados = useMemo(() => (militaresQuery.data?.militares || []).map((m) => String(m?.id || '')).filter(Boolean), [militaresQuery.data]);
  const idsHash = useMemo(() => idsMilitaresCarregados.join('|'), [idsMilitaresCarregados]);
  const cacheAntiguidade = getPosicaoOficialAntiguidadeFromCache(queryClient);
  const hasOrdemOficialAntiguidade = cacheAntiguidade.hasOrdemOficialAntiguidade;

  const { data: historicoPromocoesEfetivo = [] } = useQuery({
    queryKey: ['historico-promocao-militares-efetivo-gestor', effectiveEmail || 'self', idsHash],
    enabled: isAccessResolved && !hasOrdemOficialAntiguidade && idsMilitaresCarregados.length > 0,
    queryFn: async () => {
      const { historicoPromocoes } = await fetchPreviaAntiguidadeMilitares({ idsMilitares: idsMilitaresCarregados });
      return historicoPromocoes;
    },
  });

  const ordemAntiguidadeMap = useMemo(() => {
    const { posicaoOficialByMilitarId } = cacheAntiguidade;
    if (hasOrdemOficialAntiguidade) return posicaoOficialByMilitarId;
    const previaAntiguidade = calcularPreviaAntiguidadeGeral({
      militares: militaresQuery.data?.militares || [],
      historicoPromocoes: historicoPromocoesEfetivo,
    });
    return new Map((previaAntiguidade?.itens || []).map((item) => [String(item?.militar_id || ''), Number(item?.posicao)]));
  }, [cacheAntiguidade, hasOrdemOficialAntiguidade, militaresQuery.data, historicoPromocoesEfetivo]);

  const estrutura = useMemo(
    () => montarArvoreLotacaoMilitares(militaresQuery.data?.militares || [], lotacoesQuery.data?.lotacoes || []),
    [militaresQuery.data, lotacoesQuery.data],
  );

  if (!canAccessModule('militares')) return <AccessDenied moduleName="Efetivo" />;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Visão de Gestor do Efetivo (Read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Buscar por nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {militaresQuery.isLoading || lotacoesQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando dados do efetivo...</p>
          ) : (
            <VisualizacoesGestor estrutura={estrutura} filtro={busca} ordemAntiguidadeMap={ordemAntiguidadeMap} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
