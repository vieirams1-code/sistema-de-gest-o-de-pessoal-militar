import React, { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronRight, Users, Grip, Eye } from 'lucide-react';

const statusColors = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

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

function normalizeName(value, fallback) {
  return String(value || fallback || '').trim();
}

function buildLotacaoTree(militares) {
  const setoresMap = new Map();

  militares.forEach((militar) => {
    const setorNome = normalizeName(militar.grupamento_nome, militar.lotacao || 'Sem lotação definida');
    const setorId = normalizeName(militar.grupamento_id, `setor:${setorNome}`);

    if (!setoresMap.has(setorId)) {
      setoresMap.set(setorId, {
        id: setorId,
        nome: setorNome,
        tipo: 'setor',
        children: [],
        militares: [],
      });
    }

    const setorNode = setoresMap.get(setorId);

    const subNome = normalizeName(militar.subgrupamento_nome, '');
    const subId = normalizeName(militar.subgrupamento_id, subNome ? `sub:${setorId}:${subNome}` : '');

    if (subNome || subId) {
      let subNode = setorNode.children.find((child) => child.id === subId);
      if (!subNode) {
        subNode = {
          id: subId || `sub:${setorId}:${subNome}`,
          nome: subNome || 'Subunidade',
          tipo: 'subunidade',
          children: [],
          militares: [],
        };
        setorNode.children.push(subNode);
      }
      subNode.militares.push(militar);
      return;
    }

    setorNode.militares.push(militar);
  });

  const sortByName = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
  const tree = Array.from(setoresMap.values()).sort(sortByName);
  tree.forEach((setor) => {
    setor.children.sort(sortByName);
    setor.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR'));
    setor.children.forEach((child) => {
      child.militares.sort((a, b) => String(a.nome_completo || '').localeCompare(String(b.nome_completo || ''), 'pt-BR'));
    });
  });

  return {
    id: 'root-organograma-efetivo',
    nome: 'Estrutura de Lotação do Efetivo',
    tipo: 'root',
    children: tree,
    militares: [],
  };
}

function MilitarCompactCard({ militar, onViewMilitar }) {
  return (
    <button
      type="button"
      onClick={() => onViewMilitar?.(militar)}
      className="w-full text-left rounded-md border border-slate-200 bg-white px-2.5 py-2 hover:border-[#1e3a5f]/40 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1e3a5f] truncate">
            {postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao || 'Sem posto'}
          </p>
          <p className="text-sm font-medium text-slate-800 truncate">
            {militar.nome_guerra || militar.nome_completo || 'Militar sem identificação'}
          </p>
          <p className="text-xs text-slate-500 truncate">Mat: {militar.matricula || 'Não informada'}</p>
        </div>
        <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>
      <div className="mt-1.5">
        <Badge className={`${statusColors[militar.status_cadastro] || statusColors.Ativo} border text-[10px]`}>
          {militar.status_cadastro || 'Ativo'}
        </Badge>
      </div>
    </button>
  );
}

function TreeNode({ node, depth = 0, expandedUnits, onToggleNode, onToggleChildren, onViewMilitar }) {
  const isRoot = node.tipo === 'root';
  const isExpanded = isRoot ? true : !!expandedUnits[node.id];
  const hasChildren = node.children.length > 0;
  const hasMilitares = node.militares.length > 0;
  const hasContent = hasChildren || hasMilitares;

  return (
    <div className="flex flex-col items-center min-w-[280px]">
      <div className={`rounded-xl border bg-white shadow-sm ${isRoot ? 'border-[#1e3a5f]/30 px-4 py-3' : 'border-slate-200 p-3'} w-full`}>
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className={`w-4 h-4 ${isRoot ? 'text-[#1e3a5f]' : 'text-slate-500'}`} />
            <div className="min-w-0">
              <p className={`font-semibold truncate ${isRoot ? 'text-[#1e3a5f]' : 'text-slate-800'}`}>{node.nome}</p>
              {!isRoot && <p className="text-xs text-slate-500">{node.tipo === 'setor' ? 'Setor' : 'Subunidade'}</p>}
            </div>
          </div>
          {!isRoot && hasContent && (
            <Button variant="ghost" size="icon" onClick={() => onToggleNode(node.id)} className="h-7 w-7">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {!isRoot && (
          <div className="mt-2 flex gap-2 flex-wrap">
            <Badge variant="outline">{node.militares.length} militares</Badge>
            {node.children.length > 0 && <Badge variant="outline">{node.children.length} subunidades</Badge>}
            {node.children.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onToggleChildren(node)}
              >
                {node.children.every((child) => expandedUnits[child.id]) ? 'Recolher subníveis' : 'Expandir subníveis'}
              </Button>
            )}
          </div>
        )}

        {isExpanded && hasMilitares && (
          <div className="mt-3 space-y-1.5">
            {node.militares.map((militar) => (
              <MilitarCompactCard key={militar.id} militar={militar} onViewMilitar={onViewMilitar} />
            ))}
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <>
          <div className="h-5 w-px bg-slate-300" />
          <div className={`border-t border-slate-300 pt-5 flex gap-4 ${depth === 0 ? 'items-start' : 'items-stretch'}`}>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedUnits={expandedUnits}
                onToggleNode={onToggleNode}
                onToggleChildren={onToggleChildren}
                onViewMilitar={onViewMilitar}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MapaDeLotacao({ militares = [], onViewMilitar }) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const containerRef = useRef(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const tree = useMemo(() => buildLotacaoTree(militares), [militares]);

  const toggleNode = (id) => {
    setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleChildren = (node) => {
    const shouldExpand = node.children.some((child) => !expandedUnits[child.id]);
    setExpandedUnits((prev) => {
      const next = { ...prev };
      node.children.forEach((child) => {
        next[child.id] = shouldExpand;
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">
        Nenhum militar disponível para montar o mapa de lotação.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-[#1e3a5f]">Mapa de Lotação</h3>
          <p className="text-xs text-slate-500">Visualização top-down por estrutura real de lotação.</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Grip className="w-3 h-3" />
          arraste para navegar
        </Badge>
      </div>

      <div
        ref={containerRef}
        className={`overflow-auto h-[68vh] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} bg-slate-50/60`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <div className="min-w-max p-8">
          <TreeNode
            node={tree}
            expandedUnits={expandedUnits}
            onToggleNode={toggleNode}
            onToggleChildren={toggleChildren}
            onViewMilitar={onViewMilitar}
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-4">
        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {militares.length} militar(es) no mapa</span>
        <span>Início com unidades recolhidas para reduzir carga visual.</span>
      </div>
    </div>
  );
}
