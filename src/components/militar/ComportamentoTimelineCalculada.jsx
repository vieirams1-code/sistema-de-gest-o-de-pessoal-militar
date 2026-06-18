import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock, ChevronDown, Flag, Info, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const comportamentoClasses = {
  Excepcional: 'bg-blue-100 text-blue-800 border-blue-200',
  Ótimo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Otimo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Bom: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Insuficiente: 'bg-orange-100 text-orange-800 border-orange-200',
  Mau: 'bg-red-100 text-red-800 border-red-200',
  MAU: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_COLORS = {
  Excepcional: '#3b82f6',
  'Ótimo': '#22c55e',
  Otimo: '#22c55e',
  Bom: '#facc15',
  Insuficiente: '#f97316',
  Mau: '#ef4444',
  MAU: '#ef4444',
  Projecao: '#8b5cf6',
};

const EVENT_TRACKS = [
  { side: 'top', y: -118 },
  { side: 'top', y: -66 },
  { side: 'bottom', y: 66 },
  { side: 'bottom', y: 118 },
];

const STATUS_RANK = {
  Mau: 1,
  Insuficiente: 2,
  Bom: 3,
  'Ótimo': 4,
  Excepcional: 5,
};

function parseDate(value) {
  if (!value || String(value).toUpperCase() === 'HOJE') return new Date();
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatarData(value) {
  if (!value) return '—';
  if (String(value).toUpperCase() === 'HOJE') return 'Hoje';
  const date = parseDate(value);
  if (!date) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function formatarPeriodo(value) {
  if (!value) return '—';
  if (String(value).toUpperCase() === 'HOJE') return 'Hoje';
  return formatarData(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('ótimo') || text.includes('otimo')) return 'Ótimo';
  if (text.includes('excepcional')) return 'Excepcional';
  if (text.includes('insuficiente')) return 'Insuficiente';
  if (text.includes('mau')) return 'Mau';
  return 'Bom';
}

function getSegmentColor(segmento) {
  if (segmento?.isProjetado) return STATUS_COLORS.Projecao;
  return STATUS_COLORS[normalizeStatus(segmento?.comportamento)] || '#94a3b8';
}

function removeAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function getEventKind(evento) {
  const tipo = removeAccents(evento?.tipo);
  const subtipo = removeAccents(evento?.subtipo || evento?.tipo_punicao || evento?.descricao);

  if (tipo.includes('INCLUSAO')) return 'inclusao';
  if (tipo.includes('HOJE')) return 'hoje';
  if (tipo.includes('PROJECAO')) return 'projecao';
  if (tipo.includes('MUDANCA')) return 'mudanca';
  if (tipo.includes('ADVERTENCIA') || subtipo.includes('ADVERTENCIA')) return 'advertencia';

  if (tipo.includes('PUNICAO') || subtipo.includes('PRISAO') || subtipo.includes('DETENCAO') || subtipo.includes('REPREENSAO')) {
    if (evento?.impacto_comportamento === false) return 'advertencia';
    return 'punicao';
  }

  return 'evento';
}

function getPunicaoLabel(evento) {
  const raw = String(evento?.subtipo || evento?.tipo_punicao || evento?.descricao || evento?.tipo || '').toLowerCase();

  if (raw.includes('prisao em separado') || raw.includes('prisão em separado')) return 'Prisão em separado';
  if (raw.includes('prisao') || raw.includes('prisão')) return 'Prisão';
  if (raw.includes('detencao') || raw.includes('detenção')) return 'Detenção';
  if (raw.includes('repreensao') || raw.includes('repreensão')) return 'Repreensão';
  if (raw.includes('advertencia verbal') || raw.includes('advertência verbal')) return 'Advertência verbal';
  if (raw.includes('advertencia') || raw.includes('advertência')) return 'Advertência';

  return evento?.descricao || evento?.tipo || 'Evento';
}

function getEventLabel(evento, kind) {
  if (kind === 'punicao' || kind === 'advertencia') return getPunicaoLabel(evento);
  if (kind === 'inclusao') return 'Inclusão';
  if (kind === 'hoje') return 'Hoje';
  if (kind === 'projecao') return evento?.comportamento ? `Projeção para ${evento.comportamento}` : 'Projeção futura';
  if (kind === 'mudanca') return evento?.comportamento ? `Sobe para ${evento.comportamento}` : 'Mudança de comportamento';
  return evento?.descricao || evento?.tipo || 'Evento';
}

function buildTimelineScale(segmentos = [], eventos = []) {
  const dates = [];

  segmentos.forEach((segmento) => {
    const start = parseDate(segmento?.inicio);
    const end = parseDate(segmento?.fim);
    if (start) dates.push(start);
    if (end) dates.push(end);
  });

  eventos.forEach((evento) => {
    const date = parseDate(evento?.data);
    if (date) dates.push(date);
  });

  dates.push(new Date());

  const min = new Date(Math.min(...dates.map((date) => date.getTime())));
  const max = new Date(Math.max(...dates.map((date) => date.getTime())));
  min.setDate(min.getDate() - 30);
  max.setDate(max.getDate() + 30);

  const total = max.getTime() - min.getTime();
  const toPercent = (value) => {
    const date = parseDate(value);
    if (!date || total <= 0) return 0;
    return clamp(((date.getTime() - min.getTime()) / total) * 100, 0, 100);
  };

  const totalYears = Math.max(1, (max.getTime() - min.getTime()) / (365.25 * 86400000));
  const tickStep = totalYears <= 10 ? 1 : 2;
  const firstYear = Math.ceil(min.getFullYear() / tickStep) * tickStep;
  const ticks = [];

  for (let year = firstYear; year <= max.getFullYear(); year += tickStep) {
    const date = new Date(`${year}-01-01T00:00:00`);
    ticks.push({ year, left: toPercent(date.toISOString().slice(0, 10)) });
  }

  return { min, max, ticks, toPercent };
}

function criarTimelineEventGroups(eventos = [], toPercent, segmentos = []) {
  const sorted = [...eventos]
    .map((evento, originalIndex) => ({
      ...evento,
      originalIndex,
      left: toPercent(evento?.data),
      kind: getEventKind(evento),
    }))
    .sort((a, b) => a.left - b.left);

  const groupGapPercent = 3;
  const groups = [];

  sorted.forEach((evento) => {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && evento.left - currentGroup.maxLeft <= groupGapPercent) {
      currentGroup.eventos.push(evento);
      currentGroup.maxLeft = Math.max(currentGroup.maxLeft, evento.left);
      currentGroup.left = currentGroup.eventos.reduce((sum, item) => sum + item.left, 0) / currentGroup.eventos.length;
      return;
    }

    groups.push({
      id: `timelineEventGroup-${groups.length}`,
      eventos: [evento],
      left: evento.left,
      maxLeft: evento.left,
    });
  });

  return groups.map((group) => ({
    ...group,
    mainKind: getGroupMainKind(group.eventos),
    dataLabel: getGroupDateLabel(group.eventos),
    eventos: group.eventos.map((evento) => ({
      ...evento,
      impactoVisual: getImpactoVisualEvento(evento, segmentos),
    })),
  }));
}

function assignEventTracks(groups = []) {
  const sorted = [...groups].sort((a, b) => a.left - b.left);
  const lastByTrack = new Array(EVENT_TRACKS.length).fill(-999);
  const minGap = 8.5;

  return sorted.map((group) => {
    let trackIndex = 0;
    for (let i = 0; i < EVENT_TRACKS.length; i += 1) {
      if (group.left - lastByTrack[i] >= minGap) {
        trackIndex = i;
        break;
      }
    }

    lastByTrack[trackIndex] = group.left;
    return { ...group, track: EVENT_TRACKS[trackIndex], trackIndex };
  });
}

function getGroupMainKind(eventos = []) {
  const priority = ['hoje', 'punicao', 'projecao', 'mudanca', 'advertencia', 'inclusao', 'evento'];
  return priority.find((kind) => eventos.some((evento) => evento.kind === kind)) || 'evento';
}

function getGroupDateLabel(eventos = []) {
  const uniqueDates = [...new Set(eventos.map((evento) => formatarData(evento.data)))];
  if (uniqueDates.length === 1) return uniqueDates[0];
  return `${uniqueDates[0]} +${uniqueDates.length - 1}`;
}

function getEventIcon(kind, label = '') {
  if (kind === 'punicao' || kind === 'advertencia') return '📌';
  if (kind === 'mudanca') return label.toLowerCase().includes('cai') ? '⬇' : '⬆';
  if (kind === 'projecao') return '🔮';
  if (kind === 'hoje') return 'HOJE';
  if (kind === 'inclusao') return '⚑';
  return '•';
}

function getSegmentoAnteriorPosterior(evento, segmentos = []) {
  const data = parseDate(evento?.data);
  if (!data) return { anterior: null, posterior: null };
  const time = data.getTime();

  const sorted = [...segmentos]
    .map((segmento) => ({
      ...segmento,
      inicioDate: parseDate(segmento?.inicio),
      fimDate: parseDate(segmento?.fim || 'Hoje'),
    }))
    .filter((segmento) => segmento.inicioDate)
    .sort((a, b) => a.inicioDate.getTime() - b.inicioDate.getTime());

  let anterior = null;
  let posterior = null;

  sorted.forEach((segmento) => {
    const inicioTime = segmento.inicioDate.getTime();
    const fimTime = segmento.fimDate?.getTime() ?? inicioTime;
    if (fimTime <= time) anterior = segmento;
    if (!posterior && inicioTime >= time) posterior = segmento;
    if (inicioTime <= time && fimTime >= time) {
      anterior = anterior || segmento;
      posterior = posterior || segmento;
    }
  });

  return { anterior, posterior };
}

function getImpactoVisualEvento(evento, segmentos = []) {
  const kind = getEventKind(evento);
  if (kind === 'advertencia') return 'Sem impacto';
  if (kind !== 'punicao' && kind !== 'mudanca') return null;

  const { anterior, posterior } = getSegmentoAnteriorPosterior(evento, segmentos);
  const statusAnterior = anterior ? normalizeStatus(anterior.comportamento) : null;
  const statusPosterior = posterior ? normalizeStatus(posterior.comportamento) : null;
  if (!statusAnterior || !statusPosterior) return kind === 'punicao' ? 'Mantém comportamento' : null;

  const rankAnterior = STATUS_RANK[statusAnterior] || 0;
  const rankPosterior = STATUS_RANK[statusPosterior] || 0;

  if (rankPosterior > rankAnterior) return `⬆ Sobe para ${statusPosterior}`;
  if (rankPosterior < rankAnterior) return `⬇ Cai para ${statusPosterior}`;
  return kind === 'punicao' ? (evento?.impacto_comportamento === false ? 'Sem impacto' : `Permaneceu ${statusPosterior}`) : `Mantém ${statusPosterior}`;
}

function getSegmentTooltip(segmento) {
  const punicoes = segmento?.punicoesConsideradas?.length ?? 0;
  const advertencias = segmento?.advertenciasInformativas?.length ?? 0;
  return [
    `Comportamento: ${segmento?.comportamento || '—'}`,
    `Período: ${formatarPeriodo(segmento?.inicio)} → ${formatarPeriodo(segmento?.fim)}`,
    `Duração: ${calcularDuracaoAproximada(segmento?.inicio, segmento?.fim)}`,
    `Punições impactantes: ${punicoes}`,
    `Advertências: ${advertencias}`,
    `Fundamento: ${segmento?.fundamento || '—'}`,
  ].join('\n');
}

function calcularDuracaoAproximada(inicioValue, fimValue) {
  const inicio = parseDate(inicioValue);
  const fim = parseDate(fimValue);
  if (!inicio || !fim) return '—';
  const dias = Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1);
  const anos = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  if (anos > 0) return `${anos} ano(s) e ${meses} mês(es)`;
  if (meses > 0) return `${meses} mês(es)`;
  return `${dias} dia(s)`;
}

function resumirMemoria(timelineCalculada, segmento) {
  const memoria = timelineCalculada?.memoriaCalculo || [];
  return memoria.find((item) => item?.dataReferencia === segmento?.inicio) || null;
}

function getPunicaoTitulo(punicao = {}) {
  return punicao.tipo_resolvido || punicao.tipo_punicao || punicao.tipo || punicao.descricao || 'Punição considerada';
}

function JanelasResumo({ janelas = {} }) {
  const entries = [
    ['1 ano', janelas.j1],
    ['2 anos', janelas.j2],
    ['4 anos', janelas.j4],
    ['8 anos', janelas.j8],
  ].filter(([, janela]) => janela);

  if (!entries.length) return <p className="text-sm text-slate-500">Nenhuma janela informada pelo motor histórico.</p>;

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {entries.map(([label, janela]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Janela de {label}</p>
          <p>Período: {formatarPeriodo(janela.inicio)} até {formatarPeriodo(janela.fim)}</p>
          <p>Punições: {janela.quantidade ?? 0}</p>
          <p>Prisão equivalente: {janela.prisao_equivalente ?? 0}</p>
          <p>Detenção equivalente: {janela.detencao_equivalente ?? 0}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineHorizontal({ eventos = [], segmentos = [] }) {
  const scale = useMemo(() => buildTimelineScale(segmentos, eventos), [segmentos, eventos]);
  const timelineEventGroups = useMemo(() => criarTimelineEventGroups(eventos, scale.toPercent, segmentos), [eventos, scale, segmentos]);
  const gruposComTrilha = useMemo(() => assignEventTracks(timelineEventGroups), [timelineEventGroups]);

  if (!segmentos.length) {
    return <p className="text-sm text-slate-500">Nenhum segmento calculado para exibição.</p>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="overflow-x-auto pb-2">
        <div className="relative h-[390px] min-w-[980px]">
          {scale.ticks.map((tick) => (
            <div
              key={tick.year}
              className="absolute bottom-8 top-10 border-l border-slate-200/80"
              style={{ left: `${tick.left}%` }}
            >
              <span className="absolute -left-5 top-full mt-2 w-10 text-center text-[11px] font-semibold text-slate-500">{tick.year}</span>
            </div>
          ))}
          <div className="absolute bottom-8 left-0 right-0 border-t border-slate-300" />

          <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200 shadow-inner" />

          {segmentos.map((segmento, index) => {
            const left = scale.toPercent(segmento?.inicio);
            const right = scale.toPercent(segmento?.fim || 'Hoje');
            const width = Math.max(right - left, 2);
            const color = getSegmentColor(segmento);

            return (
              <div
                key={`${segmento.inicio}-${segmento.fim}-${segmento.comportamento}-${index}`}
                className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${segmento.isAtual ? 'ring-4 ring-inset ring-slate-900/20' : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  minWidth: '32px',
                  backgroundColor: segmento.isProjetado ? undefined : color,
                  backgroundImage: segmento.isProjetado
                    ? `repeating-linear-gradient(135deg, ${color}, ${color} 8px, rgba(139, 92, 246, 0.55) 8px, rgba(139, 92, 246, 0.55) 16px)`
                    : undefined,
                }}
                title={getSegmentTooltip(segmento)}
              >
                <span className="truncate px-2">{segmento.isProjetado ? 'Projeção' : segmento.comportamento}</span>
              </div>
            );
          })}

          {gruposComTrilha.map((group, index) => {
            const kind = group.mainKind;
            const isTop = group.track.side === 'top';
            const labelOrder = isTop ? 'order-1' : 'order-3';
            const markerOrder = isTop ? 'order-3' : 'order-1';
            const markerClass = {
              punicao: 'bg-red-600 text-white border-white',
              advertencia: 'bg-white border-slate-500 ring-2 ring-slate-300',
              mudanca: 'bg-emerald-500 border-white',
              inclusao: 'bg-sky-600 border-white',
              hoje: 'bg-blue-700 border-white',
              projecao: 'bg-white border-violet-500 border-dashed',
              evento: 'bg-slate-600 border-white',
            }[kind];

            return (
              <div
                key={`${group.id}-${index}`}
                className={`absolute flex -translate-x-1/2 flex-col items-center ${kind === 'hoje' ? 'z-30' : 'z-10'}`}
                style={{ left: `${group.left}%`, top: `calc(50% + ${group.track.y}px)` }}
                title={group.eventos.map((evento) => `${formatarData(evento.data)} — ${getEventLabel(evento, evento.kind)}`).join('\n')}
              >
                {kind === 'hoje' && (
                  <>
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[250px] -translate-x-1/2 -translate-y-1/2 border-l-2 border-dotted border-blue-700/80" />
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-blue-700 px-2 py-0.5 text-[10px] font-black tracking-wide text-white shadow-lg">HOJE</div>
                  </>
                )}
                <div className={`${labelOrder} w-[112px] rounded-xl border bg-white px-2 py-1.5 text-left text-[10.5px] leading-tight text-slate-600 shadow-lg ${kind === 'hoje' ? 'border-blue-300 ring-2 ring-blue-100' : kind === 'projecao' ? 'border-violet-300' : 'border-slate-200'}`}>
                  <strong className="mb-1 block text-center text-[11px] text-slate-700">{group.dataLabel}</strong>
                  <div className="space-y-1">
                    {group.eventos.map((evento) => {
                      const label = getEventLabel(evento, evento.kind);
                      return (
                        <div key={`${evento.data}-${evento.tipo}-${evento.originalIndex}`} className="border-t border-slate-100 pt-1 first:border-t-0 first:pt-0">
                          <span className="block font-bold text-slate-900">{getEventIcon(evento.kind, label)} {label.replace(/^Sobe para /, '').replace(/^Projeção para /, 'Projeção para ')}</span>
                          {evento.impactoVisual && <small className="block text-slate-500">{evento.impactoVisual}</small>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="order-2 h-9 border-l border-dashed border-slate-400" />
                <div className={`${markerOrder} grid h-7 w-7 place-items-center rounded-full border-[3px] text-sm shadow-lg ${markerClass}`}>
                  {kind === 'hoje' ? '' : getEventIcon(kind)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span><span className="inline-block h-3 w-3 rounded bg-blue-500" /> Excepcional</span>
        <span><span className="inline-block h-3 w-3 rounded bg-emerald-500" /> Ótimo</span>
        <span><span className="inline-block h-3 w-3 rounded bg-yellow-400" /> Bom</span>
        <span><span className="inline-block h-3 w-3 rounded bg-orange-500" /> Insuficiente</span>
        <span><span className="inline-block h-3 w-3 rounded bg-red-500" /> Mau</span>
        <span><span className="inline-block h-3 w-3 rounded bg-violet-500" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #8b5cf6, #8b5cf6 4px, #c4b5fd 4px, #c4b5fd 8px)' }} /> Projeção futura</span>
        <span><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> Punição impactante</span>
        <span><span className="inline-block h-3 w-3 rounded-full border-2 border-slate-500 bg-white" /> Advertência sem impacto</span>
      </div>
    </div>
  );
}

export default function ComportamentoTimelineCalculada({ timelineCalculada }) {
  const segmentos = timelineCalculada?.segmentos || [];
  const eventos = timelineCalculada?.eventos || [];
  const proximaMelhoria = timelineCalculada?.proximaMelhoria;
  const inconsistencias = timelineCalculada?.inconsistencias || [];

  if (!timelineCalculada) {
    return <p className="text-sm text-slate-500">Linha do tempo calculada indisponível.</p>;
  }

  return (
    <div className="space-y-5">
      {inconsistencias.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Inconsistências identificadas pelo motor histórico</p>
            <ul className="mt-1 list-disc pl-5">
              {inconsistencias.map((inconsistencia, index) => (
                <li key={`${inconsistencia}-${index}`}>{inconsistencia}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Calculado hoje</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{timelineCalculada.comportamentoCalculadoHoje || '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Segmento atual</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{timelineCalculada.segmentoAtual?.comportamento || '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Divergência cadastral</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{timelineCalculada.divergente ? 'Sim' : 'Não'}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Próxima melhoria prevista</p>
              <p className="mt-1 text-sm font-semibold">
                {proximaMelhoria?.data
                  ? `${formatarData(proximaMelhoria.data)} → ${proximaMelhoria.comportamento_futuro || 'comportamento não informado'}`
                  : 'Sem melhoria prevista pelo motor histórico.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <TimelineHorizontal eventos={eventos} segmentos={segmentos} />

      <div className="space-y-4">
        {segmentos.length ? segmentos.map((segmento, index) => {
          const memoria = resumirMemoria(timelineCalculada, segmento);
          return (
            <details
              key={`${segmento.inicio}-${segmento.fim}-${segmento.comportamento}-${index}`}
              className={`group rounded-2xl border bg-white p-4 shadow-sm ${segmento.isAtual ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'}`}
            >
              <summary className="flex cursor-pointer list-none items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-white">
                  {segmento.isProjetado ? <Sparkles className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={comportamentoClasses[segmento.comportamento] || 'bg-slate-100 text-slate-800 border-slate-200'}>
                      {segmento.comportamento || '—'}
                    </Badge>
                    {segmento.isAtual && <Badge className="bg-emerald-600 text-white">ATUAL</Badge>}
                    {segmento.isProjetado && <Badge className="bg-violet-100 text-violet-800 border-violet-200">PROJETADO</Badge>}
                  </div>
                  <div className="mt-3 grid items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
                    <span className="text-sm font-semibold text-slate-700">{formatarPeriodo(segmento.inicio)}</span>
                    <span className="h-1 rounded-full bg-gradient-to-r from-[#1e3a5f] to-slate-300" />
                    <span className="text-sm font-semibold text-slate-700">{formatarPeriodo(segmento.fim)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600"><strong>Fundamento:</strong> {segmento.fundamento || '—'}</p>
                </div>
                <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
              </summary>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p><strong>Origem:</strong> {segmento.origem || '—'}</p>
                  <p><strong>Indicador Atual:</strong> {segmento.isAtual ? 'Sim' : 'Não'}</p>
                  <p><strong>Indicador Projetado:</strong> {segmento.isProjetado ? 'Sim' : 'Não'}</p>
                  <p><strong>Período:</strong> {formatarPeriodo(segmento.inicio)} até {formatarPeriodo(segmento.fim)}</p>
                  <p><strong>Duração aproximada:</strong> {calcularDuracaoAproximada(segmento.inicio, segmento.fim)}</p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Fundamento completo</p>
                  <p className="mt-1">{segmento.fundamento || '—'}</p>
                </div>

                <div className="mt-4">
                  <p className="mb-2 font-semibold text-slate-900">Punições consideradas</p>
                  {segmento.punicoesConsideradas?.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {segmento.punicoesConsideradas.map((punicao, punicaoIndex) => (
                        <div key={`${punicao.id || punicao.data_base_iso}-${punicaoIndex}`} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                          <p className="font-semibold text-slate-800">{getPunicaoTitulo(punicao)}</p>
                          <p>Data base: {formatarData(punicao.data_base_iso || punicao.data_base)}</p>
                          <p>Status: {punicao.status_resolvido || punicao.status_punicao || punicao.status || '—'}</p>
                          <p>Dias: {punicao.dias ?? punicao.dias_punicao ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma punição considerada neste segmento.</p>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-2 font-semibold text-slate-900">Advertências informativas do período</p>
                  {segmento.advertenciasInformativas?.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {segmento.advertenciasInformativas.map((advertencia, advertenciaIndex) => (
                        <div key={`${advertencia.id || advertencia.data_fim_cumprimento}-${advertenciaIndex}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          <p className="font-semibold text-slate-800">{advertencia.tipo}</p>
                          <p>Data base: {formatarData(advertencia.data_fim_cumprimento)}</p>
                          <p>Impacto no comportamento: Não</p>
                          <p>Equivalência: 0</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma advertência informativa neste segmento.</p>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-2 font-semibold text-slate-900">Janelas utilizadas</p>
                  <JanelasResumo janelas={segmento.janelas} />
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><Info className="h-4 w-4" /> Memória resumida</div>
                  {memoria ? (
                    <div className="grid gap-1 md:grid-cols-2">
                      <p>Data de referência: {formatarData(memoria.dataReferencia)}</p>
                      <p>Total de punições: {memoria.total_punicoes_consideradas ?? 0}</p>
                      <p>Última punição: {formatarData(memoria.ultima_punicao_data)}</p>
                      <p>Comportamento: {memoria.comportamento || '—'}</p>
                    </div>
                  ) : (
                    <p className="text-slate-500">Sem memória correspondente para o início deste segmento.</p>
                  )}
                </div>
              </div>
            </details>
          );
        }) : (
          <p className="text-sm text-slate-500">Nenhum segmento calculado para exibição.</p>
        )}
      </div>
    </div>
  );
}
