import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ChevronRight } from 'lucide-react';

/**
 * AuditoriaComportamentoAlert — Lote 1D-E
 * ----------------------------------------------------------------------------
 * Alerta administrativo, somente leitura, que mostra o contador de possíveis
 * melhorias de comportamento detectadas pelo dry-run.
 *
 * Garantias:
 *   - Só roda se isAdmin === true (enabled controlado).
 *   - Chama apenas verificarComportamentoDisciplinarDryRun (read-only).
 *   - Não cria pendências, não altera dados.
 *   - Em caso de erro, oculta-se silenciosamente (não quebra Dashboard).
 *   - Não lista militares: exibe apenas o total agregado.
 * ----------------------------------------------------------------------------
 */
export default function AuditoriaComportamentoAlert({ isAdmin }) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-auditoria-comportamento-dryrun'],
    queryFn: async () => {
      const response = await base44.functions.invoke('verificarComportamentoDisciplinarDryRun', {});
      return response?.data ?? response;
    },
    enabled: Boolean(isAdmin),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (!isAdmin) return null;
  if (isLoading || isError || !data) return null;

  const totalMudancas = Number(data?.total_mudancas_sugeridas || 0);
  if (totalMudancas <= 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-800">Auditoria de Comportamento</h2>
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                {totalMudancas}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              Existem <strong>{totalMudancas}</strong> possíve{totalMudancas > 1 ? 'is melhorias' : 'l melhoria'} de comportamento para auditoria.
            </p>
            <p className="text-xs text-slate-400">
              Nenhum dado foi alterado. Análise gerada por simulação (dry-run).
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() => navigate(createPageUrl('AuditoriaComportamento'))}
        >
          Abrir auditoria <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}