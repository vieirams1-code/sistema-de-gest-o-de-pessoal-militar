import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllScopedMilitaresPages } from '../../services/getScopedMilitaresPagination.js';

test('fetchAllScopedMilitaresPages continua após 100 registros até carregar todo o escopo', async () => {
  const militares = Array.from({ length: 225 }, (_, index) => ({ id: `militar-${index + 1}` }));
  const payloads = [];

  const result = await fetchAllScopedMilitaresPages({ fetchAll: true }, async (payload) => {
    payloads.push(payload);
    const page = militares.slice(payload.offset, payload.offset + payload.limit);
    return {
      militares: page,
      meta: { hasMore: payload.offset + page.length < militares.length },
    };
  });

  assert.equal(result.militares.length, 225);
  assert.deepEqual(payloads.map(({ limit, offset }) => ({ limit, offset })), [
    { limit: 100, offset: 0 },
    { limit: 100, offset: 100 },
    { limit: 100, offset: 200 },
  ]);
  assert.ok(payloads.every((payload) => !Object.hasOwn(payload, 'fetchAll')));
  assert.equal(result.meta.returned, 225);
  assert.equal(result.meta.pagesFetched, 3);
  assert.equal(result.meta.hasMore, false);
});

test('fetchAllScopedMilitaresPages remove duplicados entre páginas sem interromper a paginação', async () => {
  const pages = [
    { militares: [{ id: '1' }, { id: '2' }], meta: { hasMore: true } },
    { militares: [{ id: '2' }, { id: '3' }], meta: { hasMore: false } },
  ];

  const result = await fetchAllScopedMilitaresPages({ fetchAll: true, limit: 2 }, async () => pages.shift());

  assert.deepEqual(result.militares.map(({ id }) => id), ['1', '2', '3']);
  assert.equal(result.meta.returned, 3);
  assert.equal(result.meta.pagesFetched, 2);
});
