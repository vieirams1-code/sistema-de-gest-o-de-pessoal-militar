import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

const SGP_START_DATE = '2014-01-01';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

export default function CoberturaHistorica({ acervo = [], dataInclusao }) {
  const timeline = useMemo(() => {
    // 1. Filtrar apenas alterações ativas
    const alteracoes = acervo
      .filter(a => a.tipo_documento === 'ALTERACAO' && a.ativo && a.status_documento === 'ATIVO')
      .sort((a, b) => a.periodo_inicial.localeCompare(b.periodo_inicial));

    if (!dataInclusao && alteracoes.length === 0) return [];

    const events = [];
    let currentDate = dataInclusao || (alteracoes.length > 0 ? alteracoes[0].periodo_inicial : SGP_START_DATE);

    // 2. Identificar Gaps e Períodos Cobertos
    alteracoes.forEach((alt) => {
      // Se houver gap entre currentDate e o início desta alteração
      if (isAfter(parseISO(alt.periodo_inicial), parseISO(currentDate))) {
        events.push({
          type: 'gap',
          start: currentDate,
          end: alt.periodo_inicial,
          label: 'Sem documentação'
        });
      }

      events.push({
        type: 'covered',
        start: alt.periodo_inicial,
        end: alt.periodo_final,
        label: alt.titulo,
        id: alt.id
      });

      // Avançar currentDate para o final desta alteração (ou manter se houver sobreposição)
      if (isAfter(parseISO(alt.periodo_final), parseISO(currentDate))) {
        currentDate = alt.periodo_final;
      }
    });

    // 3. Adicionar marco do SGP se aplicável
    if (isBefore(parseISO(currentDate), parseISO(SGP_START_DATE))) {
      events.push({
        type: 'gap',
        start: currentDate,
        end: SGP_START_DATE,
        label: 'Sem documentação (Pré-SGP)'
      });
      currentDate = SGP_START_DATE;
    }

    events.push({
      type: 'sgp',
      start: SGP_START_DATE,
      end: format(new Date(), 'yyyy-MM-dd'),
      label: 'Período SGP'
    });

    return events;
  }, [acervo, dataInclusao]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
          <Clock className="w-5 h-5" />
          Cobertura Histórica Documental
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Dados insuficientes para gerar cobertura histórica.</p>
          ) : (
            timeline.map((event, idx) => (
              <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${
                event.type === 'covered' ? 'bg-emerald-50 border-emerald-100' :
                event.type === 'sgp' ? 'bg-blue-50 border-blue-100' :
                'bg-amber-50 border-amber-100'
              }`}>
                {event.type === 'covered' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : event.type === 'sgp' ? (
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className={`text-sm font-semibold ${
                      event.type === 'covered' ? 'text-emerald-900' :
                      event.type === 'sgp' ? 'text-blue-900' :
                      'text-amber-900'
                    }`}>
                      {event.label}
                    </p>
                    <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap ml-2">
                      {formatDate(event.start)} — {formatDate(event.end)}
                    </span>
                  </div>
                  {event.type === 'gap' && (
                    <p className="text-xs text-amber-700 mt-1">Lacuna identificada no acervo digitalizado.</p>
                  )}
                  {event.type === 'sgp' && (
                    <p className="text-xs text-blue-700 mt-1">Registros gerenciados nativamente pelo sistema.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
