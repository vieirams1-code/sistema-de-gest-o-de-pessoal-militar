import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTagVisual } from '../tagPresenter.js';

test('resolveTagVisual deve retornar valores padrão quando o objeto for vazio ou nulo', () => {
  const result = resolveTagVisual({});
  assert.strictEqual(result.nome, '');
  assert.strictEqual(result.emoji, '🏷️');
  assert.strictEqual(result.cor, '#64748b');
  assert.strictEqual(result.grupoId, '');
  assert.strictEqual(result.aplicabilidade, '');
  assert.strictEqual(result.ativo, true);

  const resultNull = resolveTagVisual(null);
  assert.strictEqual(resultNull.nome, '');
  assert.strictEqual(resultNull.emoji, '🏷️');
  assert.strictEqual(resultNull.cor, '#64748b');
  assert.strictEqual(resultNull.ativo, true);
});

test('resolveTagVisual deve resolver nome priorizando tag.nome sobre tag.label', () => {
  assert.strictEqual(resolveTagVisual({ nome: 'Nome', label: 'Label' }).nome, 'Nome');
  assert.strictEqual(resolveTagVisual({ label: 'Label' }).nome, 'Label');
  assert.strictEqual(resolveTagVisual({ nome: '  ', label: 'Label' }).nome, 'Label');
});

test('resolveTagVisual deve resolver emoji priorizando emoji > icone > icon', () => {
  assert.strictEqual(resolveTagVisual({ emoji: '⭐', icone: '🔥', icon: '📎' }).emoji, '⭐');
  assert.strictEqual(resolveTagVisual({ icone: '🔥', icon: '📎' }).emoji, '🔥');
  assert.strictEqual(resolveTagVisual({ icon: '📎' }).emoji, '📎');
});

test('resolveTagVisual deve resolver cor ou usar fallback', () => {
  assert.strictEqual(resolveTagVisual({ cor: '#ff0000' }).cor, '#ff0000');
  assert.strictEqual(resolveTagVisual({ cor: '  ' }).cor, '#64748b');
});

test('resolveTagVisual deve resolver grupoId testando todas as variantes de chaves', () => {
  assert.strictEqual(resolveTagVisual({ grupo_id: 'g1' }).grupoId, 'g1');
  assert.strictEqual(resolveTagVisual({ tag_grupo_id: 'g2' }).grupoId, 'g2');
  assert.strictEqual(resolveTagVisual({ grupoId: 'g3' }).grupoId, 'g3');
  assert.strictEqual(resolveTagVisual({ tagGrupoId: 'g4' }).grupoId, 'g4');

  // Teste de precedência (conforme a ordem no código: grupo_id || tag_grupo_id || grupoId || tagGrupoId)
  assert.strictEqual(resolveTagVisual({ grupo_id: 'g1', tag_grupo_id: 'g2' }).grupoId, 'g1');
});

test('resolveTagVisual deve resolver aplicabilidade', () => {
  assert.strictEqual(resolveTagVisual({ aplicabilidade: 'militar' }).aplicabilidade, 'militar');
});

test('resolveTagVisual deve normalizar campo ativo corretamente', () => {
  // Casos Positivos
  assert.strictEqual(resolveTagVisual({ ativo: true }).ativo, true);
  assert.strictEqual(resolveTagVisual({ ativa: true }).ativo, true);
  assert.strictEqual(resolveTagVisual({ status: 'Ativo' }).ativo, true);
  assert.strictEqual(resolveTagVisual({}).ativo, true);

  // Casos Negativos via flags booleanas
  assert.strictEqual(resolveTagVisual({ ativo: false }).ativo, false);
  assert.strictEqual(resolveTagVisual({ ativa: false }).ativo, false);

  // Casos Negativos via status string
  assert.strictEqual(resolveTagVisual({ status: 'inativo' }).ativo, false);
  assert.strictEqual(resolveTagVisual({ status: '  INATIVO  ' }).ativo, false);
});
