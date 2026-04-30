import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronRight, Layers, MapPin, Network } from 'lucide-react';

function getTypeMeta(type) {
  if (type === 'setor') return { Icon: Building2, iconClass: 'text-blue-600' };
  if (type === 'subsetor') return { Icon: Network, iconClass: 'text-indigo-600' };
  if (type === 'unidade') return { Icon: MapPin, iconClass: 'text-emerald-600' };
  return { Icon: Layers, iconClass: 'text-slate-500' };
}

function flattenTree(nodes = []) {
  const output = [];
  const visit = (items) => {
    items.forEach((item) => {
      output.push(item);
      if (Array.isArray(item.children) && item.children.length > 0) {
        visit(item.children);
      }
    });
  };
  visit(nodes);
  return output;
}

export default function HierarchicalLotacaoSelect({
  tree = [],
  value,
  onChange,
  placeholder = 'Todas as lotações',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedMap, setExpandedMap] = useState({});
  const rootRef = useRef(null);

  const flatItems = useMemo(() => flattenTree(tree), [tree]);
  const selectedItem = useMemo(() => {
    return flatItems.find((item) => String(item.id) === String(value)) || null;
  }, [flatItems, value]);

  useEffect(() => {
    const initialExpanded = {};
    flatItems.forEach((item) => {
      if (Array.isArray(item.children) && item.children.length > 0) {
        initialExpanded[item.id] = true;
      }
    });
    setExpandedMap(initialExpanded);
  }, [flatItems]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleNode = (event, nodeId) => {
    event.stopPropagation();
    setExpandedMap((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleSelect = (nodeId) => {
    onChange?.(nodeId);
    setIsOpen(false);
  };

  const renderNode = (node, depth = 0) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpanded = expandedMap[node.id] ?? true;
    const isSelected = String(node.id) === String(value);
    const { Icon, iconClass } = getTypeMeta(node.type);

    return (
      <div key={node.id}>
        <button
          type="button"
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md hover:bg-slate-50 ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-slate-700'}`}
          style={{ paddingLeft: `${8 + depth * 18}px` }}
          onClick={() => handleSelect(node.id)}
        >
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {hasChildren ? (
              <span onClick={(event) => toggleNode(event, node.id)} className="inline-flex items-center justify-center">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </span>
            ) : null}
          </span>

          <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{node.label}</span>
            {node.subtitle ? <span className="block truncate text-xs text-slate-500">{node.subtitle}</span> : null}
          </span>

          {isSelected ? <Check className="w-4 h-4 text-blue-600" /> : null}
        </button>

        {hasChildren && isExpanded ? (
          <div className="mt-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div ref={rootRef} className={`relative md:w-72 ${className}`}>
      <button
        type="button"
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm flex items-center justify-between"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="truncate">{selectedItem?.label || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-white shadow-lg p-1 max-h-80 overflow-auto">
          {tree.map((node) => renderNode(node, 0))}
        </div>
      ) : null}
    </div>
  );
}
