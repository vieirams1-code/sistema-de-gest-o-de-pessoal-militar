// Parse textual de notas independente de PDF.js para testes sintéticos.
export function extrairNotasDasPaginas(paginas) {
  const trechos = [];
  let offset = 0;
  for (const pg of paginas) {
    const texto = String(pg.texto || '');
    trechos.push({ inicio: offset, fim: offset + texto.length, pagina: pg.pagina });
    offset += texto.length + 2;
  }
  const textoTotal = paginas.map(p => p.texto || '').join('\n\n');
  const rx = /\bNOTA\s+N(?:\.|º|°)?\s*[:\-]?\s*(\d{4,9})\b/gi;
  const matches = [...textoTotal.matchAll(rx)];
  const notas = [];
  const vistos = new Set();
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nota = match[1].replace(/^0+/, '');
    if (!/^[1-9]\d{3,7}$/.test(nota)) continue;
    const start = match.index;
    const end = matches[i + 1]?.index ?? textoTotal.length;
    const pagina = trechos.find(p => start >= p.inicio && start <= p.fim)?.pagina || 1;
    const key = nota + ':' + pagina;
    if (vistos.has(key)) continue;
    vistos.add(key);
    const textoCompleto = textoTotal.slice(start, end).trim();
    notas.push({
      id: key, nota, nota_normalizada: nota, pagina,
      contexto: textoCompleto.slice(0, 20000),
      textoTruncado: textoCompleto.length > 20000,
      paginas: trechos.filter(p => p.fim > start && p.inicio < end).map(p => p.pagina),
    });
  }
  return {
    notas,
    totalPaginas: paginas.length,
    paginasSemTexto: paginas.filter(p => (p.texto || '').trim().length < 15).map(p => p.pagina),
  };
}
