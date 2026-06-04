import test from 'node:test';
import assert from 'node:assert/strict';

// Helper puro copiado de useScopedMilitarIds.js para teste isolado,
// já que o hook tem muitas dependências de módulos (@tanstack/react-query, aliases @/...)
// que não são facilmente resolvidas em um teste node simples sem configuração extra.
function filtrarPorMilitarIdsPermitidos(lista = [], scopedIds) {
  if (scopedIds === null) return lista; // admin
  if (!Array.isArray(scopedIds) || scopedIds.length === 0) return [];
  const set = new Set(scopedIds.map(String));
  return (lista || []).filter((item) => {
    const mid = item?.militar_id;
    if (!mid) return false;
    return set.has(String(mid));
  });
}

// Lógica de busca paralelizada extraída do hook para teste de correção
async function fetchScopedIdsProprio(userEmail, linkedMilitarEmail, linkedMilitarId, base44) {
  const ids = new Set();
  if (linkedMilitarId) ids.add(linkedMilitarId);
  const knownEmails = [...new Set([userEmail, linkedMilitarEmail].filter(Boolean))];

  const allConsultas = await Promise.all(
    knownEmails.flatMap((email) => [
      base44.entities.Militar.filter({ email }),
      base44.entities.Militar.filter({ email_particular: email }),
      base44.entities.Militar.filter({ email_funcional: email }),
    ])
  );

  allConsultas.flat().forEach((m) => {
    if (m?.id) ids.add(m.id);
  });

  return Array.from(ids);
}

test('filtrarPorMilitarIdsPermitidos: admin (scopedIds === null)', () => {
  const lista = [{ militar_id: '1' }, { militar_id: '2' }];
  const result = filtrarPorMilitarIdsPermitidos(lista, null);
  assert.deepEqual(result, lista);
});

test('filtrarPorMilitarIdsPermitidos: empty list or no IDs', () => {
  assert.deepEqual(filtrarPorMilitarIdsPermitidos([], []), []);
  assert.deepEqual(filtrarPorMilitarIdsPermitidos([{ militar_id: '1' }], []), []);
  assert.deepEqual(filtrarPorMilitarIdsPermitidos(null, ['1']), []);
});

test('filtrarPorMilitarIdsPermitidos: filters correctly', () => {
  const lista = [
    { militar_id: '1' },
    { militar_id: '2' },
    { militar_id: '3' },
    { id: 'no-militar-id' }
  ];
  const scopedIds = ['1', '3'];
  const result = filtrarPorMilitarIdsPermitidos(lista, scopedIds);
  assert.deepEqual(result, [{ militar_id: '1' }, { militar_id: '3' }]);
});

test('fetchScopedIdsProprio: correctly collects IDs and deduplicates', async () => {
  const mockBase44 = {
    entities: {
      Militar: {
        filter: async ({ email, email_particular, email_funcional }) => {
          if (email === 'user@example.com') return [{ id: 'm1' }];
          if (email_particular === 'user@example.com') return [{ id: 'm1' }]; // Mesma ID
          if (email === 'other@example.com') return [{ id: 'm2' }];
          return [];
        }
      }
    }
  };

  const ids = await fetchScopedIdsProprio('user@example.com', 'other@example.com', 'm0', mockBase44);
  assert.ok(ids.includes('m0'));
  assert.ok(ids.includes('m1'));
  assert.ok(ids.includes('m2'));
  assert.equal(ids.length, 3);
});

test('fetchScopedIdsProprio: handles duplicate emails', async () => {
  let callCount = 0;
  const mockBase44 = {
    entities: {
      Militar: {
        filter: async () => {
          callCount++;
          return [];
        }
      }
    }
  };

  // 2 emails iguais -> deve chamar 3 vezes (para as 3 variantes de um único email único)
  await fetchScopedIdsProprio('user@example.com', 'user@example.com', 'm0', mockBase44);
  assert.equal(callCount, 3);
});
