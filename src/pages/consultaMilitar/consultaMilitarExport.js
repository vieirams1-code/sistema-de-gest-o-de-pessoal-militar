import { exportarRegistrosParaExcel } from '@/utils/indicadosExcelExport';
import { jsPDF } from 'jspdf';

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
  const exportColumns = buildConsultaMilitarExportColumns(visibleColumns, columnsCatalog);

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

export function buildConsultaMilitarExportColumns(visibleColumns, columnsCatalog) {
  const catalogMap = new Map(columnsCatalog.map((col) => [col.key, col]));
  const visibleAllowedKeys = (visibleColumns || []).filter((key, index) => (
    catalogMap.has(key) && visibleColumns.indexOf(key) === index
  ));
  return visibleAllowedKeys
    .map((key) => catalogMap.get(key))
    .filter(Boolean);
}

export function exportConsultaMilitarToXlsx({ militares, visibleColumns, columnsCatalog, fileName }) {
  const exportColumns = buildConsultaMilitarExportColumns(visibleColumns, columnsCatalog)
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

export function exportConsultaMilitarToPdf({ militares, visibleColumns, columnsCatalog, fileName, modeLabel }) {
  const exportColumns = buildConsultaMilitarExportColumns(visibleColumns, columnsCatalog);
  const rows = militares.map((militar) => exportColumns.map((column) => {
    const accessorValue = typeof column.accessor === 'function'
      ? column.accessor(militar)
      : militar?.[column.key];
    return toExportText(accessorValue);
  }));

  const isLandscape = exportColumns.length > 7;
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR');
  const lineHeight = 14;

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Consulta Militar', margin, margin);
    doc.setFontSize(11);
    doc.text(modeLabel, margin, margin + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Gerado em: ${generatedAt}`, margin, margin + 32);
    doc.text(`Quantidade de registros: ${militares.length}`, margin, margin + 44);
  };

  drawHeader();
  let y = margin + 64;
  const tableWidth = pageWidth - (margin * 2);
  const colWidth = Math.max(70, tableWidth / Math.max(exportColumns.length, 1));

  const drawTableHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    exportColumns.forEach((column, colIndex) => {
      const x = margin + (colIndex * colWidth);
      const labelLines = doc.splitTextToSize(column.label, colWidth - 6).slice(0, 2);
      doc.text(labelLines, x + 3, y);
    });
    y += lineHeight * 2;
    doc.setDrawColor(180);
    doc.line(margin, y - 8, pageWidth - margin, y - 8);
    doc.setFont('helvetica', 'normal');
  };

  drawTableHeader();

  rows.forEach((row) => {
    const maxLines = row.reduce((acc, cell) => {
      const lines = doc.splitTextToSize(cell, colWidth - 6).slice(0, 3);
      return Math.max(acc, lines.length || 1);
    }, 1);
    const rowHeight = Math.max(lineHeight, maxLines * lineHeight);

    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      drawHeader();
      y = margin + 64;
      drawTableHeader();
    }

    row.forEach((cell, colIndex) => {
      const x = margin + (colIndex * colWidth);
      const lines = doc.splitTextToSize(cell, colWidth - 6).slice(0, 3);
      const clipped = lines.length === 3 && String(cell).length > lines.join('').length;
      const cellLines = [...lines];
      if (clipped) {
        const lastLine = cellLines[cellLines.length - 1] || '';
        cellLines[cellLines.length - 1] = `${lastLine.slice(0, Math.max(0, lastLine.length - 1))}…`;
      }
      doc.text(cellLines, x + 3, y);
    });
    y += rowHeight;
    doc.setDrawColor(230);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
  });

  doc.save(fileName);
}
