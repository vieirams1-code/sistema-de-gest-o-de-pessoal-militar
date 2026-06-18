import React from 'react';
import { AlertTriangle, CalendarClock, ChevronDown, Flag, Info, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const comportamentoClasses = {
  Excepcional: 'bg-blue-100 text-blue-800 border-blue-200',
  Ótimo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Otimo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Bom: 'bg-slate-100 text-slate-800 border-slate-200',
  Insuficiente: 'bg-amber-100 text-amber-800 border-amber-200',
  Mau: 'bg-red-100 text-red-800 border-red-200',
  MAU: 'bg-red-100 text-red-800 border-red-200',
};

const eventoClasses = {
  INCLUSAO: 'bg-sky-600 border-sky-100',
  PUNICAO: 'bg-red-600 border-red-100',
  MUDANCA_COMPORTAMENTO: 'bg-indigo-600 border-indigo-100',
  HOJE: 'bg-emerald-600 border-emerald-100',
  PROJECAO_FUTURA: 'bg-violet-600 border-violet-100',
};

function parseDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatarData(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function formatarPeriodo(value) {
  if (!value) return '—';
  if (String(value).toUpperCase() === 'HOJE') return 'Hoje';
  return formatarData(value);
}

function getRange(eventos = [], segmentos = []) {
  const datas = [
    ...eventos.map((evento) => parseDate(evento?.data)),
    ...segmentos.flatMap((segmento) => [parseDate(segmento?.inicio), parseDate(segmento?.fim)]),
  ].filter(Boolean);

  if (!datas.length) return null;
  const min = Math.min(...datas.map((date) => date.getTime()));
  const max = Math.max(...datas.map((date) => date.getTime()));
  return { min, max: min === max ? min + 1 : max };
}

function getEventoPosition(evento, range) {
  const date = parseDate(evento?.data);
  if (!date || !range) return 0;
  const percent = ((date.getTime() - range.min) / (range.max - range.min)) * 100;
  return Math.min(98, Math.max(2, percent));
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

function EventosLinha({ eventos = [], segmentos = [] }) {
  const range = getRange(eventos, segmentos);

  if (!eventos.length) {
    return <p className="text-sm text-slate-500">Nenhum evento calculado para exibição.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="relative h-16">
        <div className="absolute left-0 right-0 top-8 h-1 rounded-full bg-slate-300" />
        {eventos.map((evento, index) => (
          <div
            key={`${evento.data}-${evento.tipo}-${index}`}
            className="group absolute top-5 -translate-x-1/2"
            style={{ left: `${getEventoPosition(evento, range)}%` }}
          >
            <div className={`h-7 w-7 rounded-full border-4 shadow ${eventoClasses[evento.tipo] || 'bg-slate-600 border-slate-100'}`} />
            <div className="pointer-events-none absolute bottom-10 left-1/2 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg group-hover:block">
              <p className="font-semibold text-slate-900">{formatarData(evento.data)}</p>
              <p><strong>Tipo:</strong> {evento.tipo || '—'}</p>
              <p><strong>Descrição:</strong> {evento.descricao || '—'}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
        <span><span className="inline-block h-2 w-2 rounded-full bg-sky-600" /> inclusão</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-red-600" /> punições</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-indigo-600" /> mudanças</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-violet-600" /> projeção futura</span>
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

      <div className="grid gap-3 md:grid-cols-3">
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
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Próxima melhoria prevista</p>
            <p className="text-sm">
              {proximaMelhoria?.data
                ? `${formatarData(proximaMelhoria.data)} → ${proximaMelhoria.comportamento_futuro || 'comportamento não informado'}`
                : 'Sem melhoria prevista pelo motor histórico.'}
            </p>
          </div>
        </div>
      </div>

      <EventosLinha eventos={eventos} segmentos={segmentos} />

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
