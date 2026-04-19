import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  Grip,
  Shield,
  UserRound,
  Expand,
  Building2,
} from 'lucide-react';

const statusColors = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
  Férias: 'bg-amber-100 text-amber-700 border-amber-200',
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

const setorThemes = [
  'from-emerald-600 to-emerald-500',
  'from-cyan-600 to-blue-600',
  'from-indigo-600 to-violet-600',
  'from-[#1e3a5f] to-[#2d4a6f]',
];

function textOr(value, fallback = '') {
  return String(value || fallback).trim();
}

function buildMapaData(militares) {
  const setorMap = new Map();

  militares.forEach((militar) => {
    const setorNome = textOr(militar.grupamento_nome, militar.lotacao || 'Sem lotação definida');
    const setorId = textOr(militar.grupamento_id, `setor:${setorNome}`);

    if (!setorMap.has(setorId)) {
      setorMap.set(setorId, { id: setorId, nome: setorNome, tipo: 'setor', unidadesMap: new Map() });
    }

    const setor = setorMap.get(setorId);
    const unidadeNome = textOr(militar.subgrupamento_nome, militar.lotacao || `Efetivo ${setorNome}`);
    const unidadeId = textOr(militar.subgrupamento_id, `uni:${setorId}:${unidadeNome}`);

    if (!setor.unidadesMap.has(unidadeId)) {
      setor.unidadesMap.set(unidadeId, { id: unidadeId, nome: unidadeNome, militares: [] });
    }

    setor.unidadesMap.get(unidadeId).militares.push(militar);
  });

  const byName = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

  return Array.from(setorMap.values())
    .map((setor) => ({
      id: setor.id,
      nome: setor.nome,
      tipo: 'setor',
      unidades: Array.from(setor.unidadesMap.values())
        .map((unidade) => ({
          ...unidade,
          militares: unidade.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR')),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

function MilitarLinha({ militar }) {
  const status = militar.status_cadastro || 'Ativo';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
          <UserRound className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {(postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao || 'Militar')} {militar.nome_guerra || militar.nome_completo || 'Sem identificação'}
          </p>
          <Badge className={`${statusColors[status] || statusColors.Ativo} border text-[10px] mt-0.5`}>
            {status}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-mono shrink-0">#{militar.matricula || '---'}</p>
    </div>
  );
}

function UnidadeCard({ unidade, expandedUnits, setExpandedUnits }) {
  const isExpanded = !!expandedUnits[unidade.id];

  return (
    <div className="relative">
      <div className="h-4 w-px bg-slate-300 mx-auto" />
      <div className={`rounded-2xl border bg-white shadow-sm transition-colors ${isExpanded ? 'border-blue-400' : 'border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setExpandedUnits((prev) => ({ ...prev, [unidade.id]: !prev[unidade.id] }))}
          className="w-full px-3 py-3 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <p className="font-semibold text-slate-800 text-left truncate">{unidade.nome}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-blue-600 text-white">{unidade.militares.length} MIL.</Badge>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              {unidade.militares.map((militar) => (
                <MilitarLinha key={militar.id} militar={militar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SetorColuna({ setor, index, expandedUnits, setExpandedUnits }) {
  const theme = setorThemes[index % setorThemes.length];
  const unidadeIds = setor.unidades.map((item) => item.id);
  const allExpanded = unidadeIds.length > 0 && unidadeIds.every((id) => expandedUnits[id]);

  const toggleBatch = () => {
    const nextExpand = !allExpanded;
    setExpandedUnits((prev) => {
      const next = { ...prev };
      unidadeIds.forEach((id) => {
        next[id] = nextExpand;
      });
      return next;
    });
  };

  return (
    <div className="min-w-[360px] max-w-[420px]">
      <div className={`rounded-2xl bg-gradient-to-r ${theme} text-white p-4 shadow-md`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/80">Setor</p>
            <h3 className="text-2xl font-bold truncate">{setor.nome}</h3>
          </div>
          <Button variant="secondary" size="icon" className="bg-white/20 hover:bg-white/30 text-white border-0">
            <Expand className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleBatch}
            className="bg-white/15 hover:bg-white/25 text-white border-0"
          >
            {allExpanded ? 'Recolher unidades' : 'Expandir unidades'}
          </Button>
        </div>
      </div>

      <div className="h-8 w-px bg-slate-300 mx-auto" />

      <div className="space-y-3">
        {setor.unidades.map((unidade) => (
          <UnidadeCard
            key={unidade.id}
            unidade={unidade}
            expandedUnits={expandedUnits}
            setExpandedUnits={setExpandedUnits}
          />
        ))}
      </div>
    </div>
  );
}

export default function MapaDeLotacao({ militares = [] }) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const containerRef = useRef(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, left: 0, top: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const setores = useMemo(() => buildMapaData(militares), [militares]);

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

  const stopDrag = () => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };

  if (!militares.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">
        Nenhum militar disponível para montar o mapa de lotação.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#1e3a5f]" />
          <div>
            <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
            <p className="text-xs text-slate-500">Organograma interativo por setor e unidade.</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Grip className="w-3 h-3" />
          arraste para navegar
        </Badge>
      </div>

      <div
        ref={containerRef}
        className={`h-[70vh] overflow-auto bg-slate-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <div className="min-w-max p-5 md:p-6">
          <div className="flex items-start gap-6">
            {setores.map((setor, index) => (
              <SetorColuna
                key={setor.id}
                setor={setor}
                index={index}
                expandedUnits={expandedUnits}
                setExpandedUnits={setExpandedUnits}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
