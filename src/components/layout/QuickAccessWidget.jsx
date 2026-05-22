import React from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Minimize2, Pin, RefreshCcw, Rows3, Rows2, Text, Type } from 'lucide-react';

const EDGE = 8;
const MOBILE_BREAKPOINT = 768;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function QuickAccessWidget({ items, getPinKey, createHref, widgetPreferences, onWidgetChange, defaultWidget, sidebarFlyoutOpen = false }) {
  const containerRef = React.useRef(null);
  const dragState = React.useRef({
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    dragging: false,
    didDrag: false,
  });

  const [position, setPosition] = React.useState({ x: widgetPreferences?.x ?? defaultWidget.x, y: widgetPreferences?.y ?? defaultWidget.y });
  const [isDragging, setIsDragging] = React.useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

  const mode = React.useMemo(() => ({
    orientacao: widgetPreferences?.orientacao ?? defaultWidget.orientacao,
    densidade: widgetPreferences?.densidade ?? defaultWidget.densidade,
    minimized: Boolean(widgetPreferences?.minimized ?? defaultWidget.minimized),
  }), [defaultWidget, widgetPreferences]);

  const applyClampedPosition = React.useCallback((next) => {
    const node = containerRef.current;
    const width = node?.offsetWidth || 260;
    const height = node?.offsetHeight || 120;
    const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
    const maxY = Math.max(EDGE, window.innerHeight - height - EDGE);
    return {
      x: clamp(next.x, EDGE, maxX),
      y: clamp(next.y, EDGE, maxY),
    };
  }, []);

  const onWidgetChangeRef = React.useRef(onWidgetChange);
  React.useEffect(() => {
    onWidgetChangeRef.current = onWidgetChange;
  }, [onWidgetChange]);

  const persistState = React.useCallback((patch) => {
    onWidgetChangeRef.current((prev) => ({ ...prev, ...patch }));
  }, []);

  React.useEffect(() => {
    const next = { x: widgetPreferences?.x ?? defaultWidget.x, y: widgetPreferences?.y ?? defaultWidget.y };
    setPosition((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
  }, [defaultWidget.x, defaultWidget.y, widgetPreferences?.x, widgetPreferences?.y]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setPosition((prev) => {
        const clamped = applyClampedPosition(prev);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        persistState(clamped);
        return clamped;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyClampedPosition, persistState]);

  if (items.length === 0) return null;

  const handlePointerDown = (event) => {
    if (event.button !== 0 || isMobile || mode.minimized) return;
    const node = containerRef.current;
    if (!node) return;

    dragState.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      startX: event.clientX,
      startY: event.clientY,
      dragging: true,
      didDrag: false,
    };
    event.preventDefault();
    setIsDragging(true);
    if (node?.setPointerCapture) {
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }
  };

  const handlePointerMove = (event) => {
    if (!dragState.current.dragging || dragState.current.pointerId !== event.pointerId) return;
    const distanceX = event.clientX - dragState.current.startX;
    const distanceY = event.clientY - dragState.current.startY;
    if (!dragState.current.didDrag && Math.hypot(distanceX, distanceY) > 3) {
      dragState.current.didDrag = true;
    }

    const nextPos = applyClampedPosition({
      x: event.clientX - dragState.current.offsetX,
      y: event.clientY - dragState.current.offsetY,
    });

    setPosition(nextPos);
  };

  const finishDrag = (event) => {
    if (!dragState.current.dragging || dragState.current.pointerId !== event.pointerId) return;
    const node = containerRef.current;
    if (node?.hasPointerCapture?.(event.pointerId) && node?.releasePointerCapture) {
      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
    }
    dragState.current.dragging = false;
    dragState.current.pointerId = null;
    setIsDragging(false);
    persistState(position);
  };

  const preventGhostClick = (event) => {
    if (!dragState.current.didDrag) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.didDrag = false;
  };

  const resetPosition = () => {
    const next = applyClampedPosition({ x: defaultWidget.x, y: defaultWidget.y });
    setPosition(next);
    persistState(next);
  };

  const baseStyle = isMobile
    ? { left: EDGE, right: EDGE, bottom: EDGE, top: 'auto' }
    : { left: `${position.x}px`, top: `${position.y}px` };

  const containerZIndexClass = sidebarFlyoutOpen ? 'z-[100]' : 'z-[200]';

  if (mode.minimized) {
    return (
      <button
        type="button"
        onClick={() => persistState({ minimized: false })}
        className={`fixed ${containerZIndexClass} flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 text-slate-700 shadow-xl backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900`}
        style={baseStyle}
        aria-label={`Expandir acesso rápido (${items.length} favoritos)`}
        title="Expandir acesso rápido"
      >
        <Pin className="h-4 w-4" />
        <span className="text-xs font-semibold leading-none">{items.length}</span>
      </button>
    );
  }

  const isHorizontal = mode.orientacao === 'horizontal';
  const isCompact = mode.densidade === 'compact';

  return (
    <div
      ref={containerRef}
      className={`fixed ${containerZIndexClass} cursor-default rounded-xl border border-slate-200 bg-white shadow-xl`}
      style={baseStyle}
    >
      <div
        className="flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-2 py-1.5"
      >
        <div
          data-drag-handle
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onClick={preventGhostClick}
          className={`flex items-center gap-2 text-slate-700 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-semibold">Acesso rápido</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); persistState({ orientacao: isHorizontal ? 'vertical' : 'horizontal' }); }} className="rounded p-1 text-slate-500 hover:bg-slate-200" title="Alternar orientação" aria-label="Alternar orientação">
            {isHorizontal ? <Rows3 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); persistState({ densidade: isCompact ? 'expanded' : 'compact' }); }} className="rounded p-1 text-slate-500 hover:bg-slate-200" title="Alternar densidade" aria-label="Alternar densidade">
            {isCompact ? <Text className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); resetPosition(); }} className="rounded p-1 text-slate-500 hover:bg-slate-200" title="Resetar posição" aria-label="Resetar posição">
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); persistState({ minimized: true }); }} className="rounded p-1 text-slate-500 hover:bg-slate-200" title="Minimizar" aria-label="Minimizar acesso rápido">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={`p-2 ${isHorizontal ? 'flex max-w-[70vw] flex-row gap-1 overflow-x-auto' : 'flex max-h-[55vh] min-w-52 flex-col gap-1 overflow-y-auto'}`}>
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <Link
              key={getPinKey(item)}
              to={createHref(item)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 ${isCompact ? 'justify-center' : ''}`}
              title={item.name}
              aria-label={item.name}
            >
              {ItemIcon ? <ItemIcon className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 rounded-full bg-slate-400" />}
              {!isCompact && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
