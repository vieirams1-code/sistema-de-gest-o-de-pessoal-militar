import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronUp, Grip, Shield, UserRound } from 'lucide-react';

const statusColors = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

function texto(value, fallback = '') {
  return String(value || fallback).trim();
}

function montarMapa(militares) {
  const setoresMap = new Map();

  militares.forEach((m) => {
    const setorNome = texto(m.grupamento_nome, m.lotacao || 'Sem lotação definida');
    const setorId = texto(m.grupamento_id, `setor:${setorNome}`);

    if (!setoresMap.has(setorId)) {
      setoresMap.set(setorId, { id: setorId, nome: setorNome, unidades: new Map() });
    }

    const setor = setoresMap.get(setorId);
    const unidadeNome = texto(m.subgrupamento_nome, m.lotacao || `Efetivo ${setorNome}`);
    const unidadeId = texto(m.subgrupamento_id, `uni:${setorId}:${unidadeNome}`);

    if (!setor.unidades.has(unidadeId)) {
      setor.unidades.set(unidadeId, { id: unidadeId, nome: unidadeNome, militares: [] });
    }

    setor.unidades.get(unidadeId).militares.push(m);
  });

  const byName = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

  return Array.from(setoresMap.values())
    .map((setor) => ({
      id: setor.id,
      nome: setor.nome,
      unidades: Array.from(setor.unidades.values())
        .map((u) => ({
          ...u,
          militares: u.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR')),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

function MilitarCardCompacto({ militar, onViewMilitar }) {
  const status = militar.status_cadastro || 'Ativo';
  const nome = militar.nome_guerra || militar.nome_completo || 'Sem identificação';

  return (
    <button
      type="button"
      onClick={() => onViewMilitar?.(militar)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <UserRound className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{nome}</p>
            <p className="text-xs text-slate-500 truncate">Mat: {militar.matricula || 'N/I'}</p>
          </div>
        </div>
        <Badge className={`${statusColors[status] || statusColors.Ativo} border text-[10px]`}>{status}</Badge>
      </div>
    </button>
  );
}

function UnidadeItem({ unidade, expandedUnits, setExpandedUnits, onViewMilitar }) {
  const expanded = !!expandedUnits[unidade.id];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpandedUnits((prev) => ({ ...prev, [unidade.id]: !prev[unidade.id] }))}
        className={`w-full rounded-xl border px-3 py-2 bg-white flex items-center justify-between gap-2 ${expanded ? 'border-blue-400' : 'border-slate-200'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-800 truncate text-left">{unidade.nome}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-blue-600 text-white">{unidade.militares.length} MIL.</Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
          {unidade.militares.map((militar) => (
            <MilitarCardCompacto key={militar.id} militar={militar} onViewMilitar={onViewMilitar} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapaDeLotacao({ militares = [], onViewMilitar }) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const ref = useRef(null);
  const drag = useRef({ on: false, sx: 0, sy: 0, left: 0, top: 0 });
  const [dragging, setDragging] = useState(false);

  const setores = useMemo(() => montarMapa(militares), [militares]);

  const onMouseDown = (e) => {
    if (!ref.current) return;
    drag.current = {
      on: true,
      sx: e.pageX - ref.current.offsetLeft,
      sy: e.pageY - ref.current.offsetTop,
      left: ref.current.scrollLeft,
      top: ref.current.scrollTop,
    };
    setDragging(true);
  };

  const onMouseMove = (e) => {
    if (!drag.current.on || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const y = e.pageY - ref.current.offsetTop;
    ref.current.scrollLeft = drag.current.left - (x - drag.current.sx);
    ref.current.scrollTop = drag.current.top - (y - drag.current.sy);
  };

  const stopDrag = () => {
    drag.current.on = false;
    setDragging(false);
  };

  if (!militares.length) {
    return <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-500">Nenhum militar no mapa.</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#1e3a5f]" />
          <div>
            <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
            <p className="text-xs text-slate-500">Visualização por setor e unidade.</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1"><Grip className="w-3 h-3" /> arraste para navegar</Badge>
      </div>

      <div
        ref={ref}
        className={`h-[70vh] overflow-auto bg-slate-100 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <div className="min-w-max p-6">
          <div className="flex items-start gap-6">
            {setores.map((setor) => {
              const ids = setor.unidades.map((u) => u.id);
              const allOpen = ids.length > 0 && ids.every((id) => expandedUnits[id]);

              return (
                <div key={setor.id} className="min-w-[360px] max-w-[420px]">
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white p-4 shadow-md">
                    <p className="text-xs uppercase tracking-wide text-white/80">Setor</p>
                    <h4 className="text-xl font-bold truncate">{setor.nome}</h4>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const next = !allOpen;
                        setExpandedUnits((prev) => {
                          const draft = { ...prev };
                          ids.forEach((id) => { draft[id] = next; });
                          return draft;
                        });
                      }}
                      className="mt-3 bg-white/15 hover:bg-white/25 text-white border-0"
                    >
                      {allOpen ? 'Recolher unidades' : 'Expandir unidades'}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {setor.unidades.map((unidade) => (
                      <UnidadeItem
                        key={unidade.id}
                        unidade={unidade}
                        expandedUnits={expandedUnits}
                        setExpandedUnits={setExpandedUnits}
                        onViewMilitar={onViewMilitar}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
