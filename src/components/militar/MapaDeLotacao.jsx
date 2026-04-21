import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronRight, Eye, Grip, Shield, Users } from 'lucide-react';

const postoAbreviado = {
  Soldado: 'Sd',
  Cabo: 'Cb',
  '3º Sargento': '3º Sgt',
  '2º Sargento': '2º Sgt',
  '1º Sargento': '1º Sgt',
  Subtenente: 'ST',
  Aspirante: 'Asp',
  '2º Tenente': '2º Ten',
  '1º Tenente': '1º Ten',
  Capitão: 'Cap',
  Major: 'Maj',
  'Tenente-Coronel': 'TC',
  Coronel: 'Cel',
};

const groupHeaderPalette = [
  'from-[#214e87] to-[#1b3f6d]',
  'from-[#0f766e] to-[#115e59]',
  'from-[#7c3aed] to-[#6d28d9]',
  'from-[#b45309] to-[#92400e]',
  'from-[#be123c] to-[#9f1239]',
  'from-[#334155] to-[#1e293b]',
];

function normalizeName(value, fallback) {
  return String(value || fallback || '').trim();
}

function normalizeStatus(status) {
  return String(status || 'Ativo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getStatusClass(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'ATIVO') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalizedStatus === 'FERIAS') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (normalizedStatus === 'INATIVO') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalizedStatus === 'RESERVA') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (normalizedStatus === 'REFORMA') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (normalizedStatus === 'FALECIDO') return 'bg-rose-50 text-rose-700 border-rose-200';

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function buildColumns(militares) {
  const setoresMap = new Map();

  militares.forEach((militar) => {
    const setorNome = normalizeName(militar.grupamento_nome, militar.lotacao || 'Sem lotação definida');
    const setorId = normalizeName(militar.grupamento_id, `setor:${setorNome}`);

    if (!setoresMap.has(setorId)) {
      setoresMap.set(setorId, {
        id: setorId,
        nome: setorNome,
        tipoLabel: normalizeName(militar.grupamento_tipo || militar.tipo_grupamento, 'Subsetor').toUpperCase(),
        unidadesMap: new Map(),
      });
    }

    const setor = setoresMap.get(setorId);
    const unidadeNome = normalizeName(militar.subgrupamento_nome, 'Efetivo do agrupador');
    const unidadeId = normalizeName(
      militar.subgrupamento_id,
      unidadeNome === 'Efetivo do agrupador' ? `base:${setorId}` : `sub:${setorId}:${unidadeNome}`
    );

    if (!setor.unidadesMap.has(unidadeId)) {
      setor.unidadesMap.set(unidadeId, {
        id: unidadeId,
        nome: unidadeNome,
        militares: [],
      });
    }

    setor.unidadesMap.get(unidadeId).militares.push(militar);
  });

  return Array.from(setoresMap.values())
    .map((setor) => ({
      id: setor.id,
      nome: setor.nome,
      tipoLabel: setor.tipoLabel,
      unidades: Array.from(setor.unidadesMap.values())
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((unidade) => ({
          ...unidade,
          militares: unidade.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR')),
        })),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function MilitarCompactCard({ militar, onViewMilitar }) {
  return (
    <button
      type="button"
      onClick={() => onViewMilitar?.(militar)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-[#1e3a5f]/35 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f]">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {(postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao || 'Sem posto') + ' '}
              {militar.nome_guerra || militar.nome_completo || 'Militar sem identificação'}
            </p>
            <Badge className={`mt-1 border px-1.5 py-0 text-[10px] font-medium ${getStatusClass(militar.status_cadastro)}`}>
              {militar.status_cadastro || 'Ativo'}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Mat. {militar.matricula || 'N/I'}</span>
          <Eye className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function UnidadeCard({ unidade, isExpanded, onToggle, onViewMilitar }) {
  return (
    <div className="relative pl-4">
      <span className="pointer-events-none absolute left-[7px] top-0 h-4 w-px bg-slate-200" />
      <span className="pointer-events-none absolute left-[7px] top-4 h-px w-4 bg-slate-200" />

      <div
        className={`rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition-all ${
          isExpanded ? 'border-[#2563eb] ring-2 ring-[#2563eb]/10' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Building2 className="h-3.5 w-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{unidade.nome}</p>
          </div>

          <Badge variant="outline" className="shrink-0 rounded-full border-slate-200 bg-slate-50 px-2 py-0 text-[10px] font-semibold text-slate-600">
            {unidade.militares.length} MIL.
          </Badge>

          {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
        </button>
      </div>

      {isExpanded && (
        <div className="relative mt-2 pl-4">
          <span className="pointer-events-none absolute left-[7px] top-0 h-4 w-px bg-slate-200" />
          <span className="pointer-events-none absolute left-[7px] top-4 h-px w-4 bg-slate-200" />

          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
            <div className="space-y-2">
              {unidade.militares.map((militar) => (
                <MilitarCompactCard key={militar.id} militar={militar} onViewMilitar={onViewMilitar} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetorColumn({ setor, paletteClass, expandedUnits, onToggleUnit, onExpandCollapseAllFromSetor, onViewMilitar }) {
  const allExpanded = setor.unidades.every((unidade) => !!expandedUnits[unidade.id]);

  return (
    <div className="w-[360px] shrink-0 space-y-4">
      <div className={`rounded-2xl bg-gradient-to-r ${paletteClass} p-4 text-white shadow-sm`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-white/80">{setor.tipoLabel}</p>
            <h4 className="mt-1 truncate text-lg font-semibold">{setor.nome}</h4>
          </div>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => onExpandCollapseAllFromSetor(setor)}
            className="h-8 w-8 rounded-full border border-white/30 bg-white/20 text-white hover:bg-white/30"
          >
            {allExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="relative space-y-3">
        <span className="pointer-events-none absolute left-[7px] top-0 h-full w-px bg-slate-200" />
        {setor.unidades.map((unidade) => (
          <UnidadeCard
            key={unidade.id}
            unidade={unidade}
            isExpanded={!!expandedUnits[unidade.id]}
            onToggle={() => onToggleUnit(unidade.id)}
            onViewMilitar={onViewMilitar}
          />
        ))}
      </div>
    </div>
  );
}

export default function MapaDeLotacao({ militares = [], onViewMilitar }) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const containerRef = useRef(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const columns = useMemo(() => buildColumns(militares), [militares]);

  const toggleUnit = (id) => {
    setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSetorUnits = (setor) => {
    const shouldExpand = setor.unidades.some((unidade) => !expandedUnits[unidade.id]);

    setExpandedUnits((prev) => {
      const next = { ...prev };
      setor.unidades.forEach((unidade) => {
        next[unidade.id] = shouldExpand;
      });
      return next;
    });
  };

  const handleMouseDown = (event) => {
    if (!containerRef.current) return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.pageX - containerRef.current.offsetLeft,
      startY: event.pageY - containerRef.current.offsetTop,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };

    setIsDragging(true);
  };

  const handleMouseMove = (event) => {
    if (!dragStateRef.current.isDragging || !containerRef.current) return;

    event.preventDefault();

    const x = event.pageX - containerRef.current.offsetLeft;
    const y = event.pageY - containerRef.current.offsetTop;
    const walkX = x - dragStateRef.current.startX;
    const walkY = y - dragStateRef.current.startY;

    containerRef.current.scrollLeft = dragStateRef.current.scrollLeft - walkX;
    containerRef.current.scrollTop = dragStateRef.current.scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    dragStateRef.current.isDragging = false;
    setIsDragging(false);
  };

  if (!militares.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-slate-500">
        Nenhum militar disponível para montar o mapa de lotação.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
          <p className="text-xs text-slate-500">Visualização em colunas por agrupador principal.</p>
        </div>

        <Badge variant="outline" className="flex items-center gap-1">
          <Grip className="h-3 w-3" />
          arraste para navegar
        </Badge>
      </div>

      <div
        ref={containerRef}
        className={`h-[68vh] overflow-auto bg-slate-50/70 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <div className="min-w-max p-6">
          <div className="flex items-start gap-6">
            {columns.map((setor, index) => (
              <SetorColumn
                key={setor.id}
                setor={setor}
                paletteClass={groupHeaderPalette[index % groupHeaderPalette.length]}
                expandedUnits={expandedUnits}
                onToggleUnit={toggleUnit}
                onExpandCollapseAllFromSetor={toggleSetorUnits}
                onViewMilitar={onViewMilitar}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {militares.length} militar(es) no mapa
        </span>
        <span>Unidades iniciam recolhidas para priorizar legibilidade.</span>
      </div>
    </div>
  );
}
