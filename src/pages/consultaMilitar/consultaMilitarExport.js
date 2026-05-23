import { exportarRegistrosParaExcel } from '@/utils/indicadosExcelExport';

const toExportText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) => toExportText(item))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export function buildConsultaMilitarExportRows(militares, visibleColumns, columnsCatalog) {
  const catalogMap = new Map(columnsCatalog.map((col) => [col.key, col]));
  const visibleAllowedKeys = (visibleColumns || []).filter((key, index) => (
    catalogMap.has(key) && visibleColumns.indexOf(key) === index
  ));
  const exportColumns = visibleAllowedKeys
    .map((key) => catalogMap.get(key))
    .filter(Boolean);

  return militares.map((militar) => {
    const row = {};
    exportColumns.forEach((column) => {
      const accessorValue = typeof column.accessor === 'function'
        ? column.accessor(militar)
        : militar?.[column.key];
      row[column.label] = toExportText(accessorValue);
    });
    return row;
  });
}

export function exportConsultaMilitarToXlsx({ militares, visibleColumns, columnsCatalog, fileName }) {
  const catalogMap = new Map(columnsCatalog.map((col) => [col.key, col]));
  const visibleAllowedKeys = (visibleColumns || []).filter((key, index) => (
    catalogMap.has(key) && visibleColumns.indexOf(key) === index
  ));
  const exportColumns = visibleAllowedKeys
    .map((key) => catalogMap.get(key))
    .filter(Boolean)
    .map((column) => ({
      label: column.label,
      getValue: (militar) => {
        const accessorValue = typeof column.accessor === 'function'
          ? column.accessor(militar)
          : militar?.[column.key];
        return toExportText(accessorValue);
      },
    }));

  exportarRegistrosParaExcel({
    registros: militares,
    camposSelecionados: exportColumns,
    nomeArquivo: fileName,
    nomeAba: 'Consulta Militar',
  });
}
