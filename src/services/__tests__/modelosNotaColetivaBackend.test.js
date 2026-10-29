import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
const source = await readFile(new URL('../../../base44/shared/modelosNotaColetiva.ts', import.meta.url), 'utf8');
const { operarModeloNotaColetiva } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
function setup(permitido = true) {
  const writes = [];
  const data = { nome: 'Cabeçalho de comportamento', tipo: 'Melhoria de Comportamento', cabecalho: 'A Comandante torna público:', ativo: true };
  const entity = { create: async d => { writes.push(d); return { id: 'novo', ...d }; }, get: async id => ({ id, ...data }), update: async (id, d) => { writes.push(d); return { id, ...d }; }, delete: async id => writes.push({ deleted: id }) };
  return { writes, args: { base44: { asServiceRole: { entities: { ModeloNotaColetiva: entity } } }, operation: 'create', data, permitido } };
}
test('bloqueia gestão sem permissão antes de acessar o cadastro', async () => {
  const s = setup(false); assert.equal((await operarModeloNotaColetiva(s.args)).status, 403); assert.equal(s.writes.length, 0);
});
test('cria vários modelos do mesmo tipo sem usar o cadastro individual', async () => {
  const s = setup(); assert.equal((await operarModeloNotaColetiva(s.args)).status, 200);
  assert.equal((await operarModeloNotaColetiva(s.args)).status, 200); assert.equal(s.writes.length, 2);
});
test('recusa cabeçalho vazio e variáveis', async () => {
  const s = setup(); s.args.data.cabecalho = '{{nome}}'; assert.equal((await operarModeloNotaColetiva(s.args)).status, 400);
  s.args.data.cabecalho = ' '; assert.equal((await operarModeloNotaColetiva(s.args)).status, 400); assert.equal(s.writes.length, 0);
});
test('edita e exclui somente o modelo, sem regravar notas existentes', async () => {
  const s = setup(); s.args.operation = 'update'; s.args.registroId = 'modelo'; s.args.data = { ativo: false };
  assert.equal((await operarModeloNotaColetiva(s.args)).status, 200); assert.equal(s.writes[0].ativo, false);
  s.args.operation = 'delete'; assert.equal((await operarModeloNotaColetiva(s.args)).status, 200); assert.deepEqual(s.writes[1], { deleted: 'modelo' });
});