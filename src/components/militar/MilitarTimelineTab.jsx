import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Briefcase,
  Heart,
  Calendar,
  FileText,
  Award,
  Shield,
  Clock,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMilitarTimeline } from '@/services/militarTimelineService';

const CATEGORIA_CONFIG = {
  'Carreira': { color: 'bg-blue-100 text-blue-700', icon: Briefcase },
  'Saúde': { color: 'bg-red-100 text-red-700', icon: Heart },
  'Férias': { color: 'bg-emerald-100 text-emerald-700', icon: Calendar },
  'Registro': { color: 'bg-slate-100 text-slate-700', icon: FileText },
  'Função': { color: 'bg-purple-100 text-purple-700', icon: Shield },
  'Gratificação': { color: 'bg-amber-100 text-amber-700', icon: Award },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    // Add time component to avoid timezone shifts if it's just a date
    const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export default function MilitarTimelineTab({ militarId }) {
  const [limit, setLimit] = React.useState(10);

  const { data: timeline = [], isLoading, error } = useQuery({
    queryKey: ['militar-timeline', militarId],
    queryFn: () => getMilitarTimeline(militarId),
    enabled: !!militarId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Clock className="w-8 h-8 text-slate-300 animate-spin" />
        <p className="text-slate-500 text-sm">Carregando linha do tempo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Erro ao carregar a linha do tempo.</p>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Clock className="w-12 h-12 mx-auto text-slate-200 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Nenhum evento registrado</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-2">
          Ainda não há marcos importantes registrados na vida funcional deste militar.
        </p>
      </div>
    );
  }

  const visibleTimeline = timeline.slice(0, limit);
  const hasMore = timeline.length > limit;

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {visibleTimeline.map((event, index) => {
        const config = CATEGORIA_CONFIG[event.categoria] || { color: 'bg-slate-100 text-slate-700', icon: Clock };
        const Icon = config.icon;

        return (
          <div key={`${event.id}-${index}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-50 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <Icon className="w-5 h-5" />
            </div>

            {/* Content */}
            <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-0 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <time className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {formatDate(event.data)}
                  </time>
                  <Badge className={`${config.color} border-none font-medium`}>
                    {event.categoria}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800 leading-snug">
                    {event.titulo}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-3" title={event.descricao}>
                    {event.descricao}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium uppercase">
                    Fonte: {event.origem}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-4 relative z-10">
          <Button
            variant="outline"
            className="rounded-full bg-white shadow-sm border-slate-200 text-[#1e3a5f]"
            onClick={() => setLimit(prev => prev + 10)}
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            Ver mais eventos
          </Button>
        </div>
      )}
    </div>
  );
}
