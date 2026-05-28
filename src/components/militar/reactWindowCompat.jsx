import React, { useMemo, useState } from 'react';

function parseHeight(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function List({
  height,
  width = '100%',
  itemCount = 0,
  itemSize,
  itemData,
  overscanCount = 1,
  style,
  children,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = parseHeight(height);
  const totalHeight = itemCount * itemSize;

  const { startIndex, endIndex } = useMemo(() => {
    if (itemCount <= 0 || viewportHeight <= 0) {
      return { startIndex: 0, endIndex: -1 };
    }
    const rawStart = Math.floor(scrollTop / itemSize);
    const visibleItems = Math.ceil(viewportHeight / itemSize);
    const start = Math.max(0, rawStart - overscanCount);
    const end = Math.min(itemCount - 1, rawStart + visibleItems + overscanCount);
    return { startIndex: start, endIndex: end };
  }, [itemCount, itemSize, overscanCount, scrollTop, viewportHeight]);

  const items = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    items.push(
      children({
        index,
        data: itemData,
        style: {
          position: 'absolute',
          top: index * itemSize,
          left: 0,
          width: '100%',
          height: itemSize,
        },
      })
    );
  }

  return (
    <div
      style={{ ...style, width, height: viewportHeight, overflowY: 'auto' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>{items}</div>
    </div>
  );
}
