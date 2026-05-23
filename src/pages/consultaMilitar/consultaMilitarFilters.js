const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const toSafeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export function getColumnFilterableValue(militar, column) {
  if (!column || typeof column.accessor !== 'function') return '';
  return toSafeValue(column.accessor(militar));
}

export function buildColumnFilterOptions(militares, column) {
  if (!column || column.futureFilterType !== 'multiselect') return [];
  const unique = new Set();
  (militares || []).forEach((militar) => {
    const value = getColumnFilterableValue(militar, column);
    if (value) unique.add(value);
  });
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function normalizeColumnFilters(filters, allowedColumns) {
  const byKey = new Map((allowedColumns || []).map((column) => [column.key, column]));
  const source = filters && typeof filters === 'object' ? filters : {};
  const normalized = {};

  Object.entries(source).forEach(([key, rawFilter]) => {
    const column = byKey.get(key);
    if (!column || !column.futureFilterType || !rawFilter || typeof rawFilter !== 'object') return;

    if (column.futureFilterType === 'text') {
      const text = String(rawFilter.text ?? '').trim();
      if (text) normalized[key] = { type: 'text', text };
      return;
    }

    if (column.futureFilterType === 'multiselect') {
      const selected = Array.isArray(rawFilter.selected)
        ? rawFilter.selected.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
      const deduped = selected.filter((value, index) => selected.indexOf(value) === index);
      if (deduped.length > 0) normalized[key] = { type: 'multiselect', selected: deduped };
    }
  });

  return normalized;
}

export function applyColumnFilters(militares, columns, filters) {
  const activeFilters = normalizeColumnFilters(filters, columns);
  const byKey = new Map((columns || []).map((column) => [column.key, column]));

  return (militares || []).filter((militar) => {
    return Object.entries(activeFilters).every(([key, filter]) => {
      const column = byKey.get(key);
      if (!column) return true;

      const value = getColumnFilterableValue(militar, column);
      if (filter.type === 'text') {
        const search = normalizeText(filter.text);
        if (!search) return true;
        return normalizeText(value).includes(search);
      }

      if (filter.type === 'multiselect') {
        if (!Array.isArray(filter.selected) || filter.selected.length === 0) return true;
        return filter.selected.includes(toSafeValue(value));
      }

      return true;
    });
  });
}
