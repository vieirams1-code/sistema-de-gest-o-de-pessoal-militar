import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronUp, Grip, Shield, UserRound } from 'lucide-react';

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

const statusColors = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

function txt(v, fallback = '') {
  return String(v || fallback).trim();
}

function montarSetores(militares) {
  const setoresMap = new Map();

  militares.forEach((militar) => {
    const setorNome = txt(militar.grupamento_nome, militar.lotacao || 'Sem lotação');
    const setorId = txt(militar.grupamento_id, `setor:${setorNome}`);
    const unidadeNome = txt(militar.subgrupamento_nome, militar.lotacao || `Efetivo ${setorNome}`);
    const unidadeId = txt(militar.subgrupamento_id, `uni:${setorId}:${unidadeNome}`);

    if (!setoresMap.has(setorId)) {
      setoresMap.set(setorId, { id: setorId, nome: setorNome, unidadesMap: new Map() });
    }

    const setor = setoresMap.get(setorId);

    if (!setor.unidadesMap.has(unidadeId)) {
      setor.unidadesMap.set(unidadeId, { id: unidadeId, nome: unidadeNome, militares: [] });
    }

    setor.unidadesMap.get(unidadeId).militares.push(militar);
  });

  const byName = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');

  return Array.from(setoresMap.values())
    .map((setor) => ({
      id: setor.id,
      nome: setor.nome,
      unidades: Array.from(setor.unidadesMap.values())
        .map((unidade) => ({
          ...unidade,
          militares: unidade.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR')),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

function MilitarItem({ militar, onViewMilitar }) {
  const status = militar.status_cadastro || 'Ativo';

  return (
    <button
      type="button"
      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-left hover:border-blue-300 transition-colors"
      onClick={() => onViewMilitar?.(militar)}
    >
      <div className="min-w-0 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
          <UserRound className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {(postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao || 'Militar')} {militar.nome_guerra || militar.nome_completo || 'Sem identificação'}
          </p>
          <Badge className={`${statusColors[status] || statusColors.Ativo} border text-[10px]`}>
            {status}
          </Badge>
        </div>
      </div>
      <span className="text-xs text-slate-400 font-mono shrink-0">#{militar.matricula || '---'}</span>
    </button>
  );
}

function UnidadeCard({ unidade, expandedUnits, setExpandedUnits, onViewMilitar }) {
  const isExpanded = !!expandedUnits[unidade.id];

  return (
    <div className="space-y-1.5">
      <div className={`rounded-2xl border bg-white shadow-sm ${isExpanded ? 'border-blue-400' : 'border-slate-200'}`}>
        <button
          type="button"
          className="w-full px-3 py-3 flex items-center justify-between gap-2"
          onClick={() => setExpandedUnits((prev) => ({ ...prev, [unidade.id]: !prev[unidade.id] }))}
        >
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-800 truncate">{unidade.nome}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-blue-600 text-white">{unidade.militares.length} MIL.</Badge>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              {unidade.militares.map((militar) => (
                <MilitarItem key={militar.id} militar={militar} onViewMilitar={onViewMilitar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapaDeLotacao({ militares = [], onViewMilitar }) {
  const setores = useMemo(() => montarSetores(militares), [militares]);
  const [expandedUnits, setExpandedUnits] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, left: 0, top: 0 });
  const containerRef = useRef(null);

  const onMouseDown = (event) => {
    if (!containerRef.current) return;
    dragRef.current = {
      isDragging: true,
      startX: event.pageX - containerRef.current.offsetLeft,
      startY: event.pageY - containerRef.current.offsetTop,
      left: containerRef.current.scrollLeft,
      top: containerRef.current.scrollTop,
    };
    setIsDragging(true);
  };

  const onMouseMove = (event) => {
    if (!dragRef.current.isDragging || !containerRef.current) return;
    event.preventDefault();
    const currentX = event.pageX - containerRef.current.offsetLeft;
    const currentY = event.pageY - containerRef.current.offsetTop;
    containerRef.current.scrollLeft = dragRef.current.left - (currentX - dragRef.current.startX);
    containerRef.current.scrollTop = dragRef.current.top - (currentY - dragRef.current.startY);
  };

  const onMouseStop = () => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };

  if (!militares.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center text-slate-500">
        Nenhum militar disponível para montar o mapa.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#1e3a5f]" />
          <div>
            <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
            <p className="text-xs text-slate-500">Visualização em organograma por setor e unidade.</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Grip className="w-3 h-3" /> arraste para navegar
        </Badge>
      </div>

      <div
        ref={containerRef}
        className={`h-[70vh] overflow-auto bg-slate-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseStop}
        onMouseLeave={onMouseStop}
      >
        <div className="min-w-max p-6">
          <div className="flex items-start gap-6">
            {setores.map((setor, index) => {
              const ids = setor.unidades.map((u) => u.id);
              const allExpanded = ids.length > 0 && ids.every((id) => expandedUnits[id]);

              return (
                <div key={setor.id} className="min-w-[360px] max-w-[420px]">
                  <div className={`rounded-2xl p-4 text-white shadow-md bg-gradient-to-r ${index % 2 === 0 ? 'from-emerald-600 to-emerald-500' : 'from-indigo-600 to-violet-600'}`}>
                    <p className="text-xs uppercase tracking-wide text-white/80">Setor</p>
                    <h4 className="text-2xl font-bold truncate">{setor.nome}</h4>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3 bg-white/15 hover:bg-white/25 text-white border-0"
                      onClick={() => {
                        const next = !allExpanded;
                        setExpandedUnits((prev) => {
                          const updated = { ...prev };
                          ids.forEach((id) => {
                            updated[id] = next;
                          });
                          return updated;
                        });
                      }}
                    >
                      {allExpanded ? 'Recolher unidades' : 'Expandir unidades'}
                    </Button>
                  </div>

                  <div className="h-8 w-px bg-slate-300 mx-auto" />

                  <div className="space-y-3">
                    {setor.unidades.map((unidade) => (
                      <UnidadeCard
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
