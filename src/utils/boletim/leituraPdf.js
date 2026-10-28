import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// O worker e a biblioteca são publicados com a própria aplicação.
// Não envia conteúdo do PDF a uma CDN ou serviço de IA.
export async function lerBoletimPdf(file) {
  if (!file || !String(file.name || '').toLowerCase().endsWith('.pdf') ||
      file.size > 30 * 1024 * 1024 || file.size === 0) {
    throw new Error('Selecione um PDF válido de até 30 MB.');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false });
  let pdf;
  try {
    pdf = await task.promise;
    const paginas = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const pagina = await pdf.getPage(i);
      const itens = (await pagina.getTextContent()).items || [];
      const ordenados = [...itens].filter(item => 'str' in item).sort((a, b) => {
        const ya = a.transform?.[5] || 0;
        const yb = b.transform?.[5] || 0;
        if (Math.abs(yb - ya) > 2) return yb - ya;
        return (a.transform?.[4] || 0) - (b.transform?.[4] || 0);
      });
      let texto = '';
      let linhaY = null;
      for (const item of ordenados) {
        const y = item.transform?.[5] || 0;
        texto += linhaY !== null && Math.abs(y - linhaY) > 2 ? '\n' : ' ';
        texto += item.str || '';
        linhaY = y;
      }
      paginas.push({ pagina: i, texto: texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() });
    }
    return extrairNotasDasPaginas(paginas);
  } finally {
    await pdf?.destroy?.().catch(() => {});
    await task.destroy().catch(() => {});
  }
}

export function extrairNotasDasPaginas(paginas) {
  // Leitura contínua: o texto de uma nota pode atravessar várias páginas.
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
