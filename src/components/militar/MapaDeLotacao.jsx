import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronUp, Grip, Shield, UserRound } from 'lucide-react';

const statusClasses = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
};

const postoAbreviado = {
  Soldado: 'Sd',
  Cabo: 'Cb',
  '3º Sargento': '3º Sgt',
  '2º Sargento': '2º Sgt',
  '1º Sargento': '1º Sgt',
  Subtenente: 'SubTen',
  Aspirante: 'Asp',
  '2º Tenente': '2º Ten',
  '1º Tenente': '1º Ten',
  Capitão: 'Cap',
  Major: 'Maj',
  'Tenente-Coronel': 'TC',
  Coronel: 'Cel',
};

function valorOu(texto, fallback = '') {
  return String(texto || fallback).trim();
}

function montarMapa(militares) {
  const setoresMap = new Map();

  militares.forEach((militar) => {
    const setorNome = valorOu(militar.grupamento_nome, militar.lotacao || 'Sem lotação');
    const setorId = valorOu(militar.grupamento_id, `setor:${setorNome}`);

    if (!setoresMap.has(setorId)) {
      setoresMap.set(setorId, { id: setorId, nome: setorNome, unidadesMap: new Map() });
    }

    const unidadeNome = valorOu(militar.subgrupamento_nome, militar.lotacao || `Efetivo ${setorNome}`);
    const unidadeId = valorOu(militar.subgrupamento_id, `unidade:${setorId}:${unidadeNome}`);

    const setor = setoresMap.get(setorId);
    if (!setor.unidadesMap.has(unidadeId)) {
      setor.unidadesMap.set(unidadeId, { id: unidadeId, nome: unidadeNome, militares: [] });
    }

    setor.unidadesMap.get(unidadeId).militares.push(militar);
  });

  const sortByNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

  return Array.from(setoresMap.values())
    .map((setor) => ({
      id: setor.id,
      nome: setor.nome,
      unidades: Array.from(setor.unidadesMap.values())
        .map((unidade) => ({
          ...unidade,
          militares: unidade.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR')),
        }))
        .sort(sortByNome),
    }))
    .sort(sortByNome);
}

function CardMilitar({ militar, onViewMilitar }) {
  const status = militar.status_cadastro || 'Ativo';

  return (
    <button
      type="button"
      onClick={() => onViewMilitar?.(militar)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
            <UserRound className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {(postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao || 'Militar')} {militar.nome_guerra || militar.nome_completo || 'Sem nome'}
            </p>
            <Badge className={`${statusClasses[status] || statusClasses.Ativo} border text-[10px]`}>{status}</Badge>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono shrink-0">#{militar.matricula || '---'}</span>
      </div>
    </button>
  );
}

function BlocoUnidade({ unidade, expandedUnits, setExpandedUnits, onViewMilitar }) {
  const expanded = !!expandedUnits[unidade.id];

  return (
    <div className="relative">
      <div className="h-4 w-px bg-slate-300 mx-auto" />
      <div className={`rounded-2xl border bg-white shadow-sm ${expanded ? 'border-blue-400' : 'border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setExpandedUnits((prev) => ({ ...prev, [unidade.id]: !prev[unidade.id] }))}
          className="w-full px-3 py-3 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
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
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              {unidade.militares.map((militar) => (
                <CardMilitar key={militar.id} militar={militar} onViewMilitar={onViewMilitar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapaDeLotacao({ militares = [], onViewMilitar }) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const containerRef = useRef(null);

  const setores = useMemo(() => montarMapa(militares), [militares]);

  const toggleSetor = (setor) => {
    const unidadeIds = setor.unidades.map((u) => u.id);
    const temFechada = unidadeIds.some((id) => !expandedUnits[id]);

    setExpandedUnits((prev) => {
      const next = { ...prev };
      unidadeIds.forEach((id) => {
        next[id] = temFechada;
      });
      return next;
    });
  };

  const onMouseDown = (event) => {
    if (!containerRef.current) return;
    dragRef.current = {
      active: true,
      startX: event.pageX - containerRef.current.offsetLeft,
      startY: event.pageY - containerRef.current.offsetTop,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
    setDragging(true);
  };

  const onMouseMove = (event) => {
    if (!dragRef.current.active || !containerRef.current) return;
    event.preventDefault();
    const x = event.pageX - containerRef.current.offsetLeft;
    const y = event.pageY - containerRef.current.offsetTop;
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - (x - dragRef.current.startX);
    containerRef.current.scrollTop = dragRef.current.scrollTop - (y - dragRef.current.startY);
  };

  const stopDrag = () => {
    dragRef.current.active = false;
    setDragging(false);
  };

  if (!militares.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center text-slate-500">
        Nenhum militar para exibir no mapa.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#1e3a5f]" />
          <div>
            <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
            <p className="text-xs text-slate-500">Visualização por setor e unidade com expansão controlada.</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1"><Grip className="w-3 h-3" />arraste para navegar</Badge>
      </div>

      <div
        ref={containerRef}
        className={`h-[70vh] overflow-auto bg-slate-100 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <div className="min-w-max p-6">
          <div className="flex items-start gap-6">
            {setores.map((setor, idx) => {
              const theme = idx % 2 === 0 ? 'from-emerald-600 to-emerald-500' : 'from-indigo-600 to-violet-600';
              const allExpanded = setor.unidades.length > 0 && setor.unidades.every((u) => expandedUnits[u.id]);

              return (
                <div key={setor.id} className="min-w-[360px] max-w-[420px]">
                  <div className={`rounded-2xl bg-gradient-to-r ${theme} text-white p-4 shadow-md`}>
                    <p className="text-xs uppercase tracking-wide text-white/80">Setor</p>
                    <h4 className="text-2xl font-bold truncate">{setor.nome}</h4>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleSetor(setor)}
                      className="mt-3 bg-white/15 hover:bg-white/25 text-white border-0"
                    >
                      {allExpanded ? 'Recolher unidades' : 'Expandir unidades'}
                    </Button>
                  </div>

                  <div className="h-8 w-px bg-slate-300 mx-auto" />

                  <div className="space-y-3">
                    {setor.unidades.map((unidade) => (
                      <BlocoUnidade
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
