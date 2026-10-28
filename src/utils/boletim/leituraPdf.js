import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extrairNotasDasPaginas } from './extrairNotasTexto.js';

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


