import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import VisualizacoesGestor from '@/components/efetivo-gestor/VisualizacoesGestor';
import montarArvoreLotacaoMilitares, { normalizarTagsMilitar } from '@/utils/efetivo/montarArvoreLotacaoMilitares';
import { filtrarMilitaresGestor, listarTagsDisponiveisGestor } from '@/utils/efetivo/visualizacaoGestor';
import { isMilitarAtivo } from '@/utils/militarStatus';
import { getTagsCompactasMilitar } from '@/utils/funcoesTags/tagsCompactasEfetivo';
import { APLICABILIDADE_TAG_MILITAR } from '@/utils/funcoesTags/militarTags';
import { buildFuncoesTagsScopeKey, funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { isCatalogoAtivo } from '@/utils/funcoesTags/contratoCampos';
import { base44 } from '@/api/base44Client';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import { fetchPreviaAntiguidadeMilitares } from '@/services/getPreviaAntiguidadeMilitaresClient';
import { calcularPreviaAntiguidadeGeral } from '@/utils/antiguidade/calcularPreviaAntiguidadeGeral';
import { getPosicaoOficialAntiguidadeFromCache } from '@/utils/antiguidade/getPosicaoOficialAntiguidade';

const STALE_TIME_MS = 5 * 60 * 1000;

export default function VisualizacaoGestorEfetivo() {
  const [busca, setBusca] = useState('');
  const [tagsSelecionadas, setTagsSelecionadas] = useState([]);
  const { canAccessModule, isAccessResolved, userEmail, modoAcesso, linkedMilitarEmail } = useCurrentUser();
  const effectiveEmail = getEffectiveEmail();
  const queryClient = useQueryClient();

  const militaresQuery = useQuery({
    queryKey: ['gestor-efetivo-militares', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: () => fetchScopedMilitares({ fetchAll: true }),
  });

  const lotacoesQuery = useQuery({
    queryKey: ['gestor-efetivo-lotacoes', effectiveEmail || 'self'],
    enabled: isAccessResolved,
    queryFn: () => fetchScopedLotacoes({}),
  });


  const idsMilitaresCarregados = useMemo(() => (militaresQuery.data?.militares || []).map((m) => String(m?.id || '')).filter(Boolean), [militaresQuery.data]);
  const idsHash = useMemo(() => idsMilitaresCarregados.join('|'), [idsMilitaresCarregados]);
  const funcoesTagsScopeKey = useMemo(
    () => buildFuncoesTagsScopeKey({ effectiveEmail, userEmail, modoAcesso, linkedMilitarId: linkedMilitarEmail }),
    [effectiveEmail, userEmail, modoAcesso, linkedMilitarEmail],
  );

  const { data: tagsAtivas = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'tags'),
    staleTime: STALE_TIME_MS,
    enabled: isAccessResolved,
    queryFn: async () => {
      const tags = await base44.entities.Tag.list('ordem_exibicao');
      return tags.filter((tag) => isCatalogoAtivo(tag) && APLICABILIDADE_TAG_MILITAR.has(String(tag?.aplicabilidade || '').toLowerCase()));
    },
  });

  const { data: vinculosTagsAtivos = [] } = useQuery({
    queryKey: funcoesTagsKeys.militaresTagsFiltros(funcoesTagsScopeKey, idsHash),
    staleTime: STALE_TIME_MS,
    enabled: isAccessResolved && idsMilitaresCarregados.length > 0,
    queryFn: () => base44.entities.MilitarTag.filter({
      status: 'ativa',
      militar_id: { '$in': idsMilitaresCarregados },
    }),
  });

  const militaresComTags = useMemo(() => (militaresQuery.data?.militares || []).map((militar) => ({
    ...militar,
    tags_resolvidas: normalizarTagsMilitar({
      tags_resolvidas: [
        ...getTagsCompactasMilitar({ militarId: militar?.id, tagsAtivas, vinculosTagsAtivos }),
        ...normalizarTagsMilitar(militar),
      ],
    }),
  })), [militaresQuery.data, tagsAtivas, vinculosTagsAtivos]);

  const militaresOperacionais = useMemo(() => militaresComTags.filter(isMilitarAtivo), [militaresComTags]);

  const tagsDisponiveis = useMemo(() => listarTagsDisponiveisGestor(militaresOperacionais), [militaresOperacionais]);
  const militaresFiltrados = useMemo(
    () => filtrarMilitaresGestor(militaresOperacionais, busca, tagsSelecionadas),
    [militaresOperacionais, busca, tagsSelecionadas],
  );
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
      militares: militaresOperacionais,
      historicoPromocoes: historicoPromocoesEfetivo,
    });
    return new Map((previaAntiguidade?.itens || []).map((item) => [String(item?.militar_id || ''), Number(item?.posicao)]));
  }, [cacheAntiguidade, hasOrdemOficialAntiguidade, militaresOperacionais, historicoPromocoesEfetivo]);

  const estrutura = useMemo(
    () => montarArvoreLotacaoMilitares(militaresFiltrados, lotacoesQuery.data?.lotacoes || []),
    [militaresFiltrados, lotacoesQuery.data],
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
          {tagsDisponiveis.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Tags:</span>
              {tagsDisponiveis.slice(0, 12).map((tag) => {
                const ativo = tagsSelecionadas.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setTagsSelecionadas((atuais) => (ativo ? atuais.filter((id) => id !== tag.id) : [...atuais, tag.id]))}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      ativo ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {tag.nome}<span className="ml-1 text-[10px] opacity-70">{tag.total}</span>
                  </button>
                );
              })}
              {tagsSelecionadas.length ? (
                <button type="button" onClick={() => setTagsSelecionadas([])} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                  Limpar tags
                </button>
              ) : null}
            </div>
          ) : null}
          {militaresQuery.isLoading || lotacoesQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando dados do efetivo...</p>
          ) : (
            <VisualizacoesGestor estrutura={estrutura} ordemAntiguidadeMap={ordemAntiguidadeMap} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
