import React, { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const CHART_LEVEL_MAP = {
  1: { offset: -2, label: 'Mau', colorClass: 'bg-red-500 ring-red-200', barClass: 'bg-red-500' },
  2: { offset: -1, label: 'Insuficiente', colorClass: 'bg-orange-500 ring-orange-200', barClass: 'bg-orange-500' },
  3: { offset: 0, label: 'Bom', colorClass: 'bg-blue-500 ring-blue-200', barClass: 'bg-blue-500' },
  4: { offset: 1, label: 'Ótimo', colorClass: 'bg-green-500 ring-green-200', barClass: 'bg-green-500' },
  5: { offset: 2, label: 'Excepcional', colorClass: 'bg-purple-500 ring-purple-200', barClass: 'bg-purple-500' },
};

const GRID_LINES = [2, 1, 0, -1, -2];
const PIXELS_PER_STEP = 24;
const DEFAULT_HEIGHT = 220;

export function mapLevelToOffset(level) {
  return CHART_LEVEL_MAP[level]?.offset ?? 0;
}

export function mapLevelToLabel(level) {
  return CHART_LEVEL_MAP[level]?.label ?? 'Bom';
}

export function mapLevelToColorClass(level) {
  return CHART_LEVEL_MAP[level]?.colorClass ?? CHART_LEVEL_MAP[3].colorClass;
}

function mapLevelToBarClass(level) {
  return CHART_LEVEL_MAP[level]?.barClass ?? CHART_LEVEL_MAP[3].barClass;
}

function sanitizeData(data = []) {
  return data
    .filter((item) => Number.isFinite(Number(item?.year)))
    .map((item, index) => ({
      year: Number(item.year),
      level: Number(item.level),
      desc: item?.desc ? String(item.desc) : 'Sem descrição informada.',
      _originalIndex: index,
    }))
    .sort((a, b) => (a.year === b.year ? a._originalIndex - b._originalIndex : a.year - b.year));
}

function consolidateByYear(data = []) {
  // Decisão de domínio: quando existem múltiplos eventos no mesmo ano,
  // o gráfico representa o estado final daquele ano (último evento recebido).
  const finalByYear = new Map();

  data.forEach((item) => {
    finalByYear.set(item.year, item);
  });

  return Array.from(finalByYear.values()).sort((a, b) => a.year - b.year);
}

export default function HistoricoComportamentoChart({
  data = [],
  title = 'Histórico de Comportamento',
  height = DEFAULT_HEIGHT,
}) {
  const consolidatedData = useMemo(() => consolidateByYear(sanitizeData(data)), [data]);
  const chartHeight = Math.max(Number(height) || DEFAULT_HEIGHT, 180);
  const centerY = chartHeight / 2;

  if (!consolidatedData.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
        Nenhum histórico de comportamento disponível para exibição.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <section className="rounded-xl border bg-white p-4 sm:p-6">
        {title ? <h3 className="mb-4 text-base font-semibold text-slate-800">{title}</h3> : null}

        <div className="overflow-x-auto pb-2">
          <div
            className="relative flex min-w-max items-end gap-6 px-2"
            style={{ minHeight: chartHeight + 44 }}
          >
            <div
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-blue-200"
              style={{ top: centerY }}
              aria-hidden="true"
            />

            {GRID_LINES.filter((line) => line !== 0).map((line) => (
              <div
                key={line}
                className="pointer-events-none absolute left-0 right-0 border-t border-slate-100"
                style={{ top: centerY - line * PIXELS_PER_STEP }}
                aria-hidden="true"
              />
            ))}

            {consolidatedData.map((item) => {
              const offset = mapLevelToOffset(item.level);
              const levelLabel = mapLevelToLabel(item.level);
              const markerClass = mapLevelToColorClass(item.level);
              const barClass = mapLevelToBarClass(item.level);
              const barHeight = Math.abs(offset) * PIXELS_PER_STEP;
              const isAbove = offset > 0;

              return (
                <div key={`${item.year}-${item._originalIndex}`} className="relative flex w-16 flex-col items-center">
                  <div className="relative" style={{ height: chartHeight, width: '100%' }}>
                    {offset !== 0 ? (
                      <div
                        className={`absolute left-1/2 w-2 -translate-x-1/2 rounded-full ${barClass}`}
                        style={{
                          height: barHeight,
                          top: isAbove ? centerY - barHeight : centerY,
                        }}
                        aria-hidden="true"
                      />
                    ) : null}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full ring-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${markerClass}`}
                          style={{ top: centerY - 8 }}
                          onClick={(event) => event.currentTarget.focus()}
                          aria-label={`${levelLabel} em ${item.year}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] space-y-1 p-3 text-xs leading-relaxed">
                        <p><strong>Nível:</strong> {levelLabel}</p>
                        <p><strong>Ano:</strong> {item.year}</p>
                        <p><strong>Evento:</strong> {item.desc}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <span className="mt-2 text-xs font-medium text-slate-600">{item.year}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <p className="text-center sm:text-left">↑ Acima do padrão</p>
          <p className="text-center">• Padrão</p>
          <p className="text-center sm:text-right">↓ Abaixo do padrão</p>
        </div>
      </section>
    </TooltipProvider>
  );
}
