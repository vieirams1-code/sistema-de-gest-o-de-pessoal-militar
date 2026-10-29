import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
const source = await readFile(new URL('../../../base44/shared/publicacoesColetivas.ts', import.meta.url), 'utf8');
const { operarPublicacaoColetiva } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const dados = () => ({ coletiva: true, tipo: 'Geral', data_publicacao: '2026-10-29', texto_publicacao: 'Ata integral de TAF', militares_ids: ['m1', 'm2'], coletiva_token: '12345678-1234-1234-1234-123456789012' });
function setup(overrides = {}) {
  const writes = [];
  const militares = ['m1', 'm2'].map(id => ({ id, nome_completo: 'Militar ' + id, posto_graduacao: 'Cabo', matricula: id }));
  const entity = { filter: async () => [], create: async data => { writes.push(data); return { id: 'p1', ...data }; }, update: async (id, data) => { writes.push(data); return { id, ...data }; }, delete: async id => { writes.push({ deleted: id }); } };
  const base44 = { asServiceRole: { entities: { PublicacaoExOfficio: entity, Militar: { filter: async () => militares } } } };
  return { writes, entity, args: { base44, operation: 'create', data: dados(), registro: null, authz: { modules: { rp: true }, actions: { adicionar_publicacoes: true, editar_publicacoes: true, publicar_bg: true, excluir_publicacoes: true } }, admin: false, email: 'operador@example.test', userId: 'u1', listarEscopo: async () => ['m1', 'm2'], ...overrides } };
}
test('salva uma ata e todos os vínculos em uma única gravação, sem usar snapshots enviados', async () => {
  const s = setup(); s.args.data.militares_vinculados = [{ militar_nome: 'Forjado' }];
  const res = await operarPublicacaoColetiva(s.args); const body = await res.json();
  assert.equal(res.status, 200); assert.equal(s.writes.length, 1);
  assert.deepEqual(body.data.militares_ids, ['m1', 'm2']); assert.equal(body.data.militar_id, '');
  assert.equal(body.data.militares_vinculados[0].militar_nome, 'Militar m1');
});
test('recusa o lote inteiro se qualquer militar está fora do escopo', async () => {
  const s = setup({ listarEscopo: async () => ['m1'] });
  const res = await operarPublicacaoColetiva(s.args); assert.equal(res.status, 403); assert.equal(s.writes.length, 0);
});
test('valida também os vínculos antigos para impedir retirada fora do escopo', async () => {
  const s = setup({ operation: 'update', registro: { ...dados(), id: 'p1', militares_ids: ['m1', 'm2', 'm3'] } });
  const res = await operarPublicacaoColetiva(s.args); assert.equal(res.status, 403); assert.equal(s.writes.length, 0);
});
test('deduplica militar na mesma nota e repete operação com token sem criar outra publicação', async () => {
  const s = setup(); s.args.data.militares_ids.push('m1'); s.entity.filter = async () => [{ id: 'existente', ...dados() }];
  const res = await operarPublicacaoColetiva(s.args); assert.equal((await res.json()).data.id, 'existente'); assert.equal(s.writes.length, 0);
});
test('aceita os tipos como classificação documental sem executar alterações nos militares', async () => {
  for (const tipo of ['Punição', 'Melhoria de Comportamento', 'Saída Férias', 'Ata JISO', 'Tipo personalizado']) {
    const s = setup(); s.args.data.tipo = tipo; s.args.data.comportamento_ingressou = 'Bom';
    const res = await operarPublicacaoColetiva(s.args);
    assert.equal(res.status, 200); assert.equal(s.writes.length, 1);
    assert.equal(s.writes[0].tipo, tipo); assert.equal(s.writes[0].comportamento_ingressou, undefined);
    assert.equal(s.writes[0].militar_id, '');
  }
});
test('não permite ausência de militares', async () => {
  const s = setup(); s.args.data.militares_ids = [];
  assert.equal((await operarPublicacaoColetiva(s.args)).status, 400); assert.equal(s.writes.length, 0);
});
test('preserva cabeçalho e texto como snapshot, sem consultar o modelo durante a edição', async () => {
  const s = setup({ operation: 'update', registro: { ...dados(), id: 'p1', modo_texto_coletivo: 'lista', modelo_coletivo_id: 'modelo1', cabecalho_coletiva: 'Cabeçalho original' }, data: { observacoes: 'Conferido' } });
  assert.equal((await operarPublicacaoColetiva(s.args)).status, 200);
  assert.equal(s.writes[0].texto_publicacao, undefined); assert.equal(s.writes[0].cabecalho_coletiva, undefined);
  assert.equal(s.writes[0].historico_coletiva.at(-1).depois.cabecalho_coletiva, 'Cabeçalho original');
});
test('publicação de BG exige permissão própria e não aceita BG parcial', async () => {
  const s = setup(); s.args.data.numero_bg = '999'; s.args.authz.actions.publicar_bg = false;
  assert.equal((await operarPublicacaoColetiva(s.args)).status, 403);
  s.args.authz.actions.publicar_bg = true; assert.equal((await operarPublicacaoColetiva(s.args)).status, 400); assert.equal(s.writes.length, 0);
});
test('exclusão de nota publicada é bloqueada e exclui rascunho numa operação', async () => {
  const s = setup({ operation: 'delete', registro: { ...dados(), id: 'p1', numero_bg: '999', data_bg: '2026-10-29' }, data: {} });
  assert.equal((await operarPublicacaoColetiva(s.args)).status, 409); assert.equal(s.writes.length, 0);
  delete s.args.registro.numero_bg; delete s.args.registro.data_bg;
  assert.equal((await operarPublicacaoColetiva(s.args)).status, 200); assert.equal(s.writes.length, 1);
});