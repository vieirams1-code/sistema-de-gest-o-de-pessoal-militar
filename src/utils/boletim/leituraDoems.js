import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { reconstituirTextoPagina } from './layoutTextoPdf.js';

/**
 * Leitura local do Diário Oficial (DOEMS). O texto é extraído no navegador
 * e dividido em trechos para revisão. Nada é enviado a serviços externos
 * nesta etapa; o envio para IA só ocorre por ação explícita do usuário.
 */

const LIMITE_TRECHO = 1600;
const MAX_TRECHOS = 120;
const MINIMO_TRECHO = 60;

function dividirEmTrechos(pagina, texto) {
  const linhas = String(texto || '').split('\n');
  const trechos = [];
  let acumulado = '';

  const fechar = () => {
    const conteudo = acumulado.replace(/\s+/g, ' ').trim();
    if (conteudo.length >= MINIMO_TRECHO) {
      trechos.push(conteudo);
    }
    acumulado = '';
  };

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    if (!linha) {
      if (acumulado.length >= LIMITE_TRECHO * 0.6) fechar();
      continue;
    }
    acumulado = acumulado ? acumulado + ' ' + linha : linha;
    if (acumulado.length >= LIMITE_TRECHO) fechar();
  }
  fechar();

  return trechos.map((contexto, indice) => ({
    id: `p${pagina}-${indice + 1}`,
    pagina,
    contexto,
  }));
}

export async function lerDiarioOficialPdf(file) {
  if (!file || !String(file.name || '').toLowerCase().endsWith('.pdf') ||
      file.size > 30 * 1024 * 1024 || file.size === 0) {
    throw new Error('Selecione um PDF válido de até 30 MB.');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false });
  let pdf;
  try {
    pdf = await task.promise;
    const trechos = [];
    const paginasSemTexto = [];
    let truncado = false;

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const pagina = await pdf.getPage(i);
      const itens = (await pagina.getTextContent()).items || [];
      const { texto } = reconstituirTextoPagina(
        itens, pagina.view[2] - pagina.view[0], pagina.view[3] - pagina.view[1],
      );
      if (String(texto || '').trim().length < 15) {
        paginasSemTexto.push(i);
        continue;
      }
      const doPagina = dividirEmTrechos(i, texto);
      for (const trecho of doPagina) {
        if (trechos.length >= MAX_TRECHOS) { truncado = true; break; }
        trechos.push(trecho);
      }
      if (truncado) break;
    }

    return { trechos, totalPaginas: pdf.numPages, paginasSemTexto, truncado };
  } finally {
    await pdf?.destroy?.().catch(() => {});
    await task.destroy().catch(() => {});
  }
}