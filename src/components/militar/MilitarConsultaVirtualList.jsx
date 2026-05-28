import React, { useCallback, useEffect, useRef, useState } from 'react';
import { List } from './reactWindowCompat';
import MilitarConsultaRow from './MilitarConsultaRow';

// =====================================================================
// MilitarConsultaVirtualList
// ---------------------------------------------------------------------
// Virtualiza a tabela de militares usando react-window. Renderiza apenas
// as linhas visíveis em vez de todas, reduzindo o custo de DOM em listas
// longas (centenas/milhares).
//
// IMPORTANTE (correção do duplo scroll horizontal):
// - A List do react-window usa internamente `overflow:auto`, o que cria
//   um scrollbar horizontal próprio quando a linha interna excede o
//   `width` informado.
// - Para evitar dois scrollbars empilhados (um da List interna + outro
//   do container pai), passamos `style={{ overflowX: 'hidden' }}` para
//   suprimir o scroll horizontal interno da List. O scroll horizontal
//   passa a ser controlado APENAS pelo wrapper externo (overflow-x-auto
//   em pages/Militares.jsx), que envolve header + List + footer juntos.
// =====================================================================

const ROW_HEIGHT = 64; // altura fixa por linha (nome em 2 linhas + paddings)
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 720;

export default function MilitarConsultaVirtualList({
  items,
  itemData,
  rowHeight = ROW_HEIGHT,
}) {
  const containerRef = useRef(null);
  const [listHeight, setListHeight] = useState(MIN_HEIGHT);

  const updateHeight = useCallback(() => {
    if (typeof window === 'undefined') return;
    const containerTop = containerRef.current?.getBoundingClientRect()?.top ?? 0;
    const available = window.innerHeight - containerTop - 200; // espaço para footer/header
    const ideal = Math.min(items.length * rowHeight, MAX_HEIGHT);
    const next = Math.max(MIN_HEIGHT, Math.min(ideal, Math.max(MIN_HEIGHT, available)));
    setListHeight(next);
  }, [items.length, rowHeight]);

  useEffect(() => {
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [updateHeight]);

  const renderRow = useCallback(({ index, style, data }) => {
    const militar = data.items[index];
    if (!militar) return null;
    return (
      <MilitarConsultaRow
        style={style}
        militar={militar}
        militaresGridTemplate={data.militaresGridTemplate}
        sanitizedVisibleColumnKeys={data.sanitizedVisibleColumnKeys}
        columnMetaByKey={data.columnMetaByKey}
        getColumnClassName={data.getColumnClassName}
        emojisEfetivoByMilitar={data.emojisEfetivoByMilitar}
        isSelected={data.selectedMilitarIds.has(String(militar.id))}
        onToggleSelection={data.onToggleSelection}
        isAdmin={data.isAdmin}
        canAccessAction={data.canAccessAction}
        onPromocaoAtual={data.onPromocaoAtual}
        onAskDelete={data.onAskDelete}
      />
    );
  }, []);

  return (
    <div ref={containerRef}>
      <List
        height={listHeight}
        width="100%"
        itemCount={items.length}
        itemSize={rowHeight}
        itemData={{ items, ...itemData }}
        overscanCount={6}
        style={{ overflowX: 'hidden' }}
      >
        {renderRow}
      </List>
    </div>
  );
}