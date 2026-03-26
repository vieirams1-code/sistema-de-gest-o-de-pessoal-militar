import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { getPunicaoEntity } from '@/services/justicaDisciplinaService';
import ComportamentoTimeline from '@/components/militar/ComportamentoTimeline';
import { calcularComportamento } from '@/utils/calcularComportamento';

const punicaoEntity = getPunicaoEntity();

export default function FichaMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const militarId = searchParams.get('id');
  const { hasAccess, hasSelfAccess, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const { data: militar } = useQuery({
    queryKey: ['militar', militarId],
    queryFn: async () => {
      const r = await base44.entities.Militar.filter({ id: militarId });
      return r[0];
    },
    enabled: !!militarId && isAccessResolved
  });

  const canViewMilitar = militar ? (hasAccess(militar) || hasSelfAccess(militar)) : false;

  const { data: punicoes = [] } = useQuery({
    queryKey: ['ficha-punicoes', militarId],
    queryFn: () => punicaoEntity.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['ficha-comportamento', militarId],
    queryFn: () => base44.entities.HistoricoComportamento.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: pendenciasComportamento = [] } = useQuery({
    queryKey: ['ficha-pendencias-comportamento', militarId],
    queryFn: () => base44.entities.PendenciaComportamento.filter({ militar_id: militarId, status_pendencia: 'Pendente' }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const avaliacaoComportamento = useMemo(() => {
    if (!militar) return null;
    return calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
      dataInclusaoMilitar: militar.data_inclusao,
      comportamentoAtual: militar.comportamento,
    });
  }, [punicoes, militar]);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;

  if (!militarId) {
    return <div className="p-8 text-center text-slate-500">Militar não especificado.</div>;
  }

  if (militar && !canViewMilitar) {
    return <div className="p-8 text-center text-slate-500">Acesso negado para esta ficha militar.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Ficha Militar</h1>
            {militar && (
              <p className="text-slate-500 text-sm">
                {militar.posto_graduacao} {militar.nome_completo} · Mat. {militar.matricula}
              </p>
            )}
          </div>

          {militar && (
            <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militarId}`)}>
              <User className="w-4 h-4 mr-2" />
              Ver Cadastro
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Comportamento atual</p>
              <p className="text-lg font-semibold text-slate-900">{avaliacaoComportamento?.comportamento || militar?.comportamento || '—'}</p>
              {avaliacaoComportamento?.fundamento && (
                <p className="text-xs text-slate-600 mt-2">{avaliacaoComportamento.fundamento}</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2">
              <p className="text-xs text-slate-500 mb-2">Pendências de comportamento</p>
              {pendenciasComportamento.length === 0 ? (
                <p className="text-sm text-slate-500">Sem pendências no momento.</p>
              ) : (
                <div className="space-y-2">
                  {pendenciasComportamento.map((pendencia) => (
                    <div key={pendencia.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">{pendencia.comportamento_anterior || '—'} → {pendencia.comportamento_sugerido || '—'}</p>
                      <p className="text-xs text-amber-700 mt-1">{pendencia.motivo || 'Aguardando análise disciplinar.'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Linha do tempo / histórico de comportamento</h3>
            <ComportamentoTimeline eventos={historico} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-2">Informações disciplinares relacionadas</h3>
            <p className="text-sm text-slate-600">Punições vinculadas ao militar: <span className="font-semibold text-slate-800">{punicoes.length}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
