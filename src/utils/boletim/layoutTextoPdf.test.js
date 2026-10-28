import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstituirTextoPagina } from './layoutTextoPdf.js';
import { extrairNotasDasPaginas } from './extrairNotasTexto.js';

function item(texto, x, y, width) {
  return { str: texto, transform: [1,0,0,1,x,y], width };
}

test('ordena duas colunas inteiras, em vez de alternar linhas à mesma altura', () => {
  const itens = [
    item('BOLETIM GERAL DO CBMMS', 160, 810, 270),
    item('NOTA N. 1244458', 40, 750, 180),
    item('NOTA N. 1244460', 312, 750, 180),
    ...Array.from({length: 12}, (_, i) => item('ESQUERDA dispensa recompensa Christian linha ' + i, 40, 732-i*14, 228)),
    ...Array.from({length: 12}, (_, i) => item('DIREITA assunto independente militar Adair linha ' + i, 312, 732-i*14, 230)),
  ];
  const saida = reconstituirTextoPagina(itens, 595, 842);
  assert.equal(saida.colunas, 2);
  const posL = saida.texto.indexOf('ESQUERDA dispensa');
  const posR = saida.texto.indexOf('DIREITA assunto');
  assert.ok(posR > saida.texto.lastIndexOf('ESQUERDA dispensa'));
  assert.ok(posL >= 0);
  const extraido = extrairNotasDasPaginas([{ pagina: 1, texto: saida.texto }]);
  assert.equal(extraido.notas.length, 2);
  assert.match(extraido.notas[0].contexto, /Christian/);
  assert.doesNotMatch(extraido.notas[0].contexto, /DIREITA assunto/);
  assert.doesNotMatch(extraido.notas[1].contexto, /ESQUERDA dispensa/);
});

test('mantém a ordem vertical em página de uma só coluna', () => {
  const itens = [
    item('NOTA N. 10001', 45, 790, 155),
    item('Primeiro parágrafo completo da matéria', 45, 770, 360),
    item('Segundo parágrafo completo da matéria', 45, 750, 350),
    item('NOTA N. 10002', 45, 710, 165),
  ];
  const saida = reconstituirTextoPagina(itens, 595, 842);
  assert.equal(saida.colunas, 1);
  assert.ok(saida.texto.indexOf('Primeiro') < saida.texto.indexOf('Segundo'));
});

test('sem itens textuais não inventa conteúdo', () => {
  const saida = reconstituirTextoPagina([], 595, 842);
  assert.equal(saida.colunas, 0);
  assert.equal(saida.texto, '');
});
