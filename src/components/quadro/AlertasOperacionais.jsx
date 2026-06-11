import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { AlertTriangle, Bell, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const SESSION_KEY = 'sgp_alert_operacional_shown';

export default function AlertasOperacionais() {
  const { isAdmin, getMilitarScopeFilters, isAccessResolved } = useCurrentUser();
  const [modalOpen, setModalOpen] = useState(false);

  const fetchAccessibleMilitarIds = async () => {
    if (isAdmin) return null;
    const filters = getMilitarScopeFilters();
    if (filters.length === 0) return [];
    const queries = await Promise.all(filters.map(f => base44.entities.Militar.filter(f)));
    return [...new Set(queries.flat().map(m => m.id).filter(Boolean))];
  };

  const { data: urgentCards = [], isLoading } = useQuery({
    queryKey: ['urgent-cards-alerts'],
    queryFn: async () => {
      const filters = {
        prioridade: 'Urgente',
        arquivado: false
      };

      if (!isAdmin) {
        const militarIds = await fetchAccessibleMilitarIds();
        filters.militar_id = { $in: militarIds };
      }

      return base44.entities.CardOperacional.filter(filters, '-created_date', 50);
    },
    enabled: isAccessResolved,
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (!isLoading && urgentCards.length > 0) {
      const alreadyShown = sessionStorage.getItem(SESSION_KEY);
      if (!alreadyShown) {
        setModalOpen(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
      }
    }
  }, [urgentCards.length, isLoading]);

  if (urgentCards.length === 0) return null;

  return (
    <>
      {/* Modal de Alerta */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-xl font-bold">ALERTAS OPERACIONAIS</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">
              Há <strong>{urgentCards.length}</strong> card(s) marcado(s) como <strong>URGENTE</strong> sob sua responsabilidade ou escopo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {urgentCards.map((card) => (
              <div
                key={card.id}
                className="p-3 rounded-xl border border-red-100 bg-red-50/50 flex flex-col gap-1 transition-all hover:bg-red-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-800 leading-snug">{card.titulo}</h4>
                  <Link
                    to={`${createPageUrl('QuadroOperacional')}?cardId=${card.id}`}
                    onClick={() => setModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors shrink-0"
                    title="Ver detalhes"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  {card.militar_nome_snapshot && (
                    <span className="font-medium">{card.militar_nome_snapshot}</span>
                  )}
                  {card.militar_nome_snapshot && card.prazo && <span>•</span>}
                  {card.prazo && (
                    <span className="text-red-700 font-semibold">Prazo: {new Date(card.prazo).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setModalOpen(false)}
              className="px-6 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
            >
              Entendido
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Badge Minimalista */}
      {!modalOpen && (
        <div className="fixed top-4 right-20 z-[60] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <Link
            to={createPageUrl('QuadroOperacional')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white shadow-xl shadow-red-200 hover:bg-red-700 transition-all group"
          >
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            <span className="text-[11px] font-bold tracking-tight">
              {urgentCards.length} {urgentCards.length === 1 ? 'ALERTA URGENTE' : 'ALERTAS URGENTES'}
            </span>
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-red-100 text-red-600 shadow-lg hover:bg-red-50 transition-all"
            title="Ver alertas"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.05); border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.1); }
      `}</style>
    </>
  );
}
