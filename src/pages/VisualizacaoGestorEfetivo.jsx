import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import VisualizacoesGestor from '@/components/efetivo-gestor/VisualizacoesGestor';
import montarArvoreLotacaoMilitares from '@/utils/efetivo/montarArvoreLotacaoMilitares';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';

export default function VisualizacaoGestorEfetivo() {
  const [busca, setBusca] = useState('');
  const { canAccessModule, isAccessResolved } = useCurrentUser();
  const effectiveEmail = getEffectiveEmail();

  const militaresQuery = useQuery({
    queryKey: ['gestor-efetivo-militares', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: () => fetchScopedMilitares({}),
  });

  const lotacoesQuery = useQuery({
    queryKey: ['gestor-efetivo-lotacoes', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: () => fetchScopedLotacoes({}),
  });

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
            <VisualizacoesGestor estrutura={estrutura} filtro={busca} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
