import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function load(file) {
  return readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
}

test('entidade CreditoExtraFerias está exportada em src/api/entities.js', () => {
  const content = load('api/entities.js');
  assert.match(content, /export const CreditoExtraFerias = base44\.entities\.CreditoExtraFerias;/);
});

test('main mantém referência à entidade CreditoExtraFerias para runtime', () => {
  const content = load('main.jsx');
  assert.match(content, /void CreditoExtraFerias;/);
  assert.match(content, /void base44\.entities\.CreditoExtraFerias;/);
});

test('página invalida query após salvar para atualizar listagem', () => {
  const content = load('pages/CreditosExtraordinariosFerias.jsx');
  assert.match(content, /await queryClient\.invalidateQueries\(\{ queryKey: \['creditos-extra-ferias'\] \}\);/);
  assert.match(content, /description: 'Listagem atualizada automaticamente\.'/);
});
