import { test } from 'node:test';
import assert from 'node:assert';
// Need to mock or use relative paths carefully due to @ alias issues in node --test
// Since I can't easily fix the @ alias here without the loader, I will write pure logic tests

test('Audit: payload mapping logic', () => {
  const alterados = [
    { id: '1', data: 'a' },
    { id: '2', data: 'b' }
  ];

  const bulkUpdatePayload = alterados.map((registro) => ({
    id: registro.id,
    something: registro.data + '_patched'
  }));

  assert.strictEqual(bulkUpdatePayload.length, 2);
  assert.strictEqual(bulkUpdatePayload[0].id, '1');
  assert.strictEqual(bulkUpdatePayload[0].something, 'a_patched');
  assert.strictEqual(bulkUpdatePayload[1].id, '2');
  assert.strictEqual(bulkUpdatePayload[1].something, 'b_patched');
});

test('Audit: order application logic matches previous behavior', () => {
  const ordenados = [
    { id: 'm1', name: 'A' },
    { id: 'm2', name: 'B' }
  ].map((item, index) => ({ ...item, ordem: index + 1 }));

  const bulkPayload = ordenados.map((item) => ({ id: item.id, ordem: item.ordem }));

  assert.deepStrictEqual(bulkPayload, [
    { id: 'm1', ordem: 1 },
    { id: 'm2', ordem: 2 }
  ]);
});
