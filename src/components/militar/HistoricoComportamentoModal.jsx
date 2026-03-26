import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ArrowRight, History } from 'lucide-react';

const comportamentoColors = {
  'Excepcional': 'text-blue-700 font-semibold',
  'Ótimo': 'text-green-700 font-semibold',
  'Bom': 'text-slate-700 font-semibold',
  'Insuficiente': 'text-orange-700 font-semibold',
  'MAU': 'text-red-700 font-semibold',
};

export default function HistoricoComportamentoModal({ militarId, open, onClose }) {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['historico-comportamento', militarId],
    queryFn: () => base44.entities.HistoricoComportamento.filter({ militar_id: militarId }, 'data_vigencia'),
    enabled: !!militarId && open
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <History className="w-5 h-5" />
            Histórico de Comportamento
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : historico.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <History className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm">Nenhum marco de comportamento registrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((h) => (
              <div key={h.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className={comportamentoColors[h.comportamento_anterior] || 'text-slate-500'}>
                    {h.comportamento_anterior || 'Não definido'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className={comportamentoColors[h.comportamento] || 'text-slate-700'}>
                    {h.comportamento}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-slate-100 text-slate-700">
                    {h.motivo_mudanca || 'Marco disciplinar'}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {h.data_vigencia ? format(new Date(h.data_vigencia + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                  </span>
                </div>
                {h.observacoes && (
                  <p className="text-xs text-slate-500 mt-2 border-t border-slate-200 pt-2">{h.observacoes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
