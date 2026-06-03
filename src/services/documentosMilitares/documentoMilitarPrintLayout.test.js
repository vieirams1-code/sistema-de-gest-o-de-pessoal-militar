import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../../components/documentosMilitares/GerarDocumentoMilitarModal.jsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../../components/documentosMilitares/DocumentoMilitarPreview.jsx', import.meta.url), 'utf8');

function blocoPrint(cssText = css) {
  const inicio = cssText.indexOf('@media print');
  assert.notEqual(inicio, -1, 'CSS deve possuir bloco @media print');
  return cssText.slice(inicio);
}

test('Documentos Militares renderiza versões separadas para tela e impressão', () => {
  assert.match(modal, /documento-militar-screen-only/);
  assert.match(modal, /documento-militar-print-only-document/);
  assert.match(modal, /variant="screen"/);
  assert.match(modal, /variant="print"/);
  assert.match(preview, /documento-militar-screen-document/);
  assert.match(preview, /documento-militar-print-document/);
});

test('versão exclusiva de impressão fica oculta em screen', () => {
  assert.match(css, /@media screen[\s\S]*\.documento-militar-print-only-document\s*{[\s\S]*display:\s*none !important;/);
});

test('prévia visual não participa da impressão', () => {
  const print = blocoPrint();
  assert.match(print, /\.documento-militar-screen-only[\s\S]*display:\s*none !important;/);
  assert.match(print, /\.documento-militar-screen-document[\s\S]*display:\s*none !important;/);
  assert.match(print, /\.documento-militar-modal-print-root[\s\S]*display:\s*none !important;/);
});

test('no print apenas documento-militar-print-only-document fica visível', () => {
  const print = blocoPrint();
  assert.match(print, /body \*\s*{[\s\S]*visibility:\s*hidden !important;/);
  assert.match(print, /\.documento-militar-print-only-document,\s*\.documento-militar-print-only-document \*\s*{[\s\S]*visibility:\s*visible !important;/);
  assert.match(print, /\.documento-militar-print-only-document\s*{[\s\S]*position:\s*absolute !important;[\s\S]*inset:\s*0 !important;[\s\S]*width:\s*100% !important;/);
});

test('CSS segue padrão A4 da Folha de Alterações para impressão', () => {
  const print = blocoPrint();
  assert.match(print, /@page\s*{[\s\S]*size:\s*A4 portrait;[\s\S]*margin:\s*12mm 16mm;/);
  assert.match(print, /body \*\s*{[\s\S]*visibility:\s*hidden !important;/);
  assert.match(print, /\.documento-militar-print-only-document[\s\S]*padding:\s*0 !important;/);
});

test('print não usa dimensões A4 fixas nem quebras estruturais forçadas', () => {
  const print = blocoPrint();
  assert.doesNotMatch(print, /width:\s*210mm/i);
  assert.doesNotMatch(print, /min-height:\s*297mm/i);
  assert.doesNotMatch(print, /page-break-(before|after):\s*(always|left|right|page)/i);
  assert.doesNotMatch(print, /break-(before|after):\s*(page|always|left|right)/i);
});

test('documento curto não possui regra estrutural que empurre corpo para página 2', () => {
  const print = blocoPrint();
  assert.doesNotMatch(print, /\.documento-militar-corpo[\s\S]*break-before:\s*page/i);
  assert.doesNotMatch(print, /\.documento-militar-corpo[\s\S]*page-break-before:\s*always/i);
  assert.doesNotMatch(print, /\.documento-militar-print-only-document[\s\S]*display:\s*(grid|flex) !important;/i);
});

test('botão de impressão continua acionando window.print sem janela isolada', () => {
  assert.match(modal, /function imprimirDocumentoMilitar\(\)\s*{\s*window\.print\(\);\s*}/);
  assert.doesNotMatch(modal, /window\.open\(/);
  assert.doesNotMatch(modal, /jsPDF|html2canvas/);
});
