import test from 'node:test';
import assert from 'node:assert/strict';
import { comporTextoNotaColetiva } from '../notaColetivaTextoService.js';
const militares = [
  { id: 'm2', nome_completo: 'Fulano de Tal', matricula: '2', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' },
  { id: 'm1', nome_completo: 'Beltrano da Silva', matricula: '1', posto_graduacao: 'Capitão', quadro: 'QOBM' },
];
test('cabeçalho único seguido de relação numerada por antiguidade e com quadro', () => {
  const res = comporTextoNotaColetiva('A Comandante torna público:', militares);
  assert.equal(res.texto, 'A Comandante torna público:\n\n(1) CAP QOBM Beltrano da Silva, matrícula 1; (2) SD QBMP-1.a Fulano de Tal, matrícula 2.');
  assert.deepEqual(res.ids, ['m1', 'm2']); assert.equal(militares[0].id, 'm2');
});
test('usa o motor de antiguidade, não a ordem de seleção nem a ordem alfabética', () => {
  const ms = militares.map((m, i) => ({ ...m, posto_graduacao: 'Soldado', quadro: 'QBMP-1.a', nome_completo: i ? 'Zeca' : 'Ana' }));
  const hs = ms.map((m, i) => ({ id: `h${i}`, militar_id: m.id, posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.a', data_promocao: '2025-01-01', antiguidade_referencia_ordem: i ? 1 : 2, status_registro: 'ATIVO' }));
  assert.deepEqual(comporTextoNotaColetiva('Texto', ms, hs).ids, ['m1', 'm2']);
});
test('cabeçalho sem militares não cria lista fictícia', () => {
  assert.equal(comporTextoNotaColetiva('Texto', []).texto, 'Texto');
});