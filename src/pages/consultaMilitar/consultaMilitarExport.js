import { exportarRegistrosParaExcel } from '@/utils/indicadosExcelExport';
import jsPDF from 'jspdf';

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

function resolveExportColumns(visibleColumns, columnsCatalog) {
  const catalogMap = new Map(columnsCatalog.map((col) => [col.key, col]));
  const visibleAllowedKeys = (visibleColumns || []).filter((key, index) => (
    catalogMap.has(key) && visibleColumns.indexOf(key) === index
  ));

  return visibleAllowedKeys
    .map((key) => catalogMap.get(key))
    .filter(Boolean);
}

function truncateForPdf(value, maxLength = 72) {
  const text = toExportText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function exportConsultaMilitarToPdf({ militares, visibleColumns, columnsCatalog, fileName, subtitle }) {
  const exportColumns = resolveExportColumns(visibleColumns, columnsCatalog);
  const columnLabels = exportColumns.map((column) => column.label);
  const rows = militares.map((militar) => exportColumns.map((column) => {
    const accessorValue = typeof column.accessor === 'function'
      ? column.accessor(militar)
      : militar?.[column.key];
    return truncateForPdf(accessorValue);
  }));

  const isLandscape = exportColumns.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const maxTableWidth = pageWidth - (margin * 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Consulta Militar', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle || 'Filtrados', margin, 18);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 23);
  doc.text(`Registros: ${militares.length}`, margin, 28);

  const startY = 34;
  const headerHeight = 8;
  const lineHeight = 5;
  const colWidth = Math.max(20, maxTableWidth / Math.max(1, columnLabels.length));

  let cursorY = startY;

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    columnLabels.forEach((label) => {
      doc.rect(x, cursorY, colWidth, headerHeight);
      const headerText = truncateForPdf(label, 26);
      doc.text(headerText, x + 1, cursorY + 5);
      x += colWidth;
    });
    cursorY += headerHeight;
  };

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  rows.forEach((row) => {
    const wrappedByCell = row.map((cell) => doc.splitTextToSize(String(cell || ''), colWidth - 2).slice(0, 3));
    const rowHeight = Math.max(...wrappedByCell.map((lines) => Math.max(1, lines.length))) * lineHeight;

    if (cursorY + rowHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    let x = margin;
    wrappedByCell.forEach((lines) => {
      doc.rect(x, cursorY, colWidth, rowHeight);
      lines.forEach((line, idx) => {
        doc.text(line, x + 1, cursorY + 4 + (idx * lineHeight));
      });
      x += colWidth;
    });

    cursorY += rowHeight;
  });

  doc.save(fileName);
}
