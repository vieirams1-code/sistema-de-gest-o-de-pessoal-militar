import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extrairNotasDasPaginas } from './extrairNotasTexto.js';
import { reconstituirTextoPagina } from './layoutTextoPdf.js';

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
      const { texto, colunas, revisaoLayout } = reconstituirTextoPagina(
        itens, pagina.view[2] - pagina.view[0], pagina.view[3] - pagina.view[1],
      );
      paginas.push({ pagina: i, texto, colunas, revisaoLayout });
    }
    return {
      ...extrairNotasDasPaginas(paginas),
      paginasComDuasColunas: paginas.filter(p => p.colunas === 2).map(p => p.pagina),
      paginasLayoutIncertos: paginas.filter(p => p.revisaoLayout).map(p => p.pagina),
    };
  } finally {
    await pdf?.destroy?.().catch(() => {});
    await task.destroy().catch(() => {});
  }
}


