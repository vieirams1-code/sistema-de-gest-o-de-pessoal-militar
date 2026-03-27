import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const comportamentoClasses = {
  Excepcional: 'bg-blue-100 text-blue-700',
  Ótimo: 'bg-emerald-100 text-emerald-700',
  Bom: 'bg-slate-100 text-slate-700',
  Insuficiente: 'bg-amber-100 text-amber-700',
  MAU: 'bg-red-100 text-red-700',
};

function formatarData(data) {
  if (!data) return 'Data não informada';
  try {
    return format(new Date(`${data}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return data;
  }
}

function normalizarDataVigencia(data) {
  if (!data) return '';
  const texto = String(data);
  return texto.length >= 10 ? texto.slice(0, 10) : texto;
}

function ehDataValida(data) {
  const normalizada = normalizarDataVigencia(data);
  if (!normalizada) return false;
  const parsed = new Date(`${normalizada}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function ehComportamentoValido(comportamento) {
  if (!comportamento) return false;
  return String(comportamento).trim().toUpperCase() !== 'N/D';
}

function getMomentoRegistro(evento = {}) {
  const candidatos = [
    evento?.created_date,
    evento?.updated_date,
    evento?.createdDate,
    evento?.updatedDate,
  ].filter(Boolean);

  for (const candidato of candidatos) {
    const data = new Date(candidato);
    if (!Number.isNaN(data.getTime())) return data.getTime();
  }

  return 0;
}

function ehRegistroAutomaticoIntermediario(evento = {}) {
  const origem = String(evento?.origem_tipo || '').toUpperCase();
  const motivo = String(evento?.motivo_mudanca || '').toUpperCase();
  return origem.includes('AUTOMAT') || origem.includes('CALCUL') || motivo.includes('AUTOMÁTIC') || motivo.includes('AUTOMATIC');
}

function limparEventos(eventos = []) {
  const ordenados = [...eventos]
    .filter((evento) => ehDataValida(evento?.data_alteracao))
    .filter((evento) => ehComportamentoValido(evento?.comportamento_novo))
    .filter((evento) => !ehRegistroAutomaticoIntermediario(evento))
    .sort((a, b) => {
      const diffData = new Date(`${normalizarDataVigencia(a.data_alteracao)}T00:00:00`) - new Date(`${normalizarDataVigencia(b.data_alteracao)}T00:00:00`);
      if (diffData !== 0) return diffData;
      return getMomentoRegistro(a) - getMomentoRegistro(b);
    });

  const ultimoPorDia = new Map();
  for (const evento of ordenados) {
    ultimoPorDia.set(normalizarDataVigencia(evento.data_alteracao), evento);
  }
  const registrosPorDia = Array.from(ultimoPorDia.values());

  const marcosReais = [];
  for (const evento of registrosPorDia) {
    const ultimo = marcosReais[marcosReais.length - 1];
    if (ultimo?.comportamento_novo === evento.comportamento_novo) continue;
    marcosReais.push(evento);
  }

  return marcosReais;
}

export default function ComportamentoTimeline({ eventos = [], selectedEventoId = null, onSelectEvento = null }) {
  const eventosOrdenados = limparEventos(eventos);

  if (!eventosOrdenados.length) {
    return <p className="text-sm text-slate-500">Nenhum marco de comportamento registrado.</p>;
  }

  return (
    <div className="space-y-3">
      {eventosOrdenados.map((evento) => (
        <button
          type="button"
          key={evento.id}
          onClick={() => onSelectEvento?.(evento)}
          className={`w-full text-left border rounded p-3 text-sm transition ${
            selectedEventoId === evento.id
              ? 'border-[#1e3a5f] bg-blue-50/60'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge className={comportamentoClasses[evento.comportamento_novo] || 'bg-slate-100 text-slate-700'}>
              {evento.comportamento_novo || 'N/D'}
            </Badge>
            <span className="text-slate-500">{formatarData(evento.data_alteracao)}</span>
          </div>

          {evento.comportamento_anterior ? (
            <p><strong>{evento.comportamento_anterior}</strong> → <strong>{evento.comportamento_novo || 'N/D'}</strong></p>
          ) : (
            <p><strong>Comportamento vigente:</strong> {evento.comportamento_novo || 'N/D'}</p>
          )}
          <p className="text-slate-700 mt-1"><strong>Motivo:</strong> {evento.motivo_mudanca || '—'}</p>
          {evento.fundamento_legal && (
            <p className="text-slate-700 mt-1"><strong>Fundamento:</strong> {evento.fundamento_legal}</p>
          )}
          {evento.observacoes && <p className="text-slate-600 mt-1">{evento.observacoes}</p>}
        </button>
      ))}
    </div>
  );
}
