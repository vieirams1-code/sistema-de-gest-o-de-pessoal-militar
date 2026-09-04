import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compact = readFileSync(new URL('./AtestadoCompactItem.jsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('./AtestadoCard.jsx', import.meta.url), 'utf8');

test('ação rápida do atestado abre a Central JISO independente', () => {
  assert.match(compact, /Gerar \/ Vincular JISO/);
  assert.match(compact, /createPageUrl\('AgendarJISO'\)/);
  assert.doesNotMatch(compact, /createPageUrl\('EditarJISO'\)/);
});

test('card expandido informa que JISO não é mais gerida dentro do atestado', () => {
  assert.match(card, /const INDEPENDENT_JISO_UI = true/);
  assert.match(card, /JISO gerida na Central JISO/);
  assert.match(card, /Agendamento, convocação por WhatsApp, vínculos e decisão não são mais registrados diretamente no atestado/);
  assert.match(card, /Gerar \/ Vincular JISO/);
  assert.match(card, /Abrir Central JISO/);
});

test('controles legados permanecem somente atrás do gate desligado de compatibilidade', () => {
  assert.match(card, /!INDEPENDENT_JISO_UI && canRegisterJisoDecision/);
  assert.match(card, /!embedded && !INDEPENDENT_JISO_UI/);
  assert.match(card, /!editingJiso && !INDEPENDENT_JISO_UI/);
});
