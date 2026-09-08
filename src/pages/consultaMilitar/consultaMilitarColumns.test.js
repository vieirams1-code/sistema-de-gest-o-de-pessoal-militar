import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONSULTA_MILITAR_COLUNAS_ALLOWLIST,
  getAllowedConsultaMilitarColumns,
} from './consultaMilitarColumns.js';

const SENSITIVE_KEYS = ['telefone', 'email', 'tipo_sanguineo'];

const byKey = (key) => CONSULTA_MILITAR_COLUNAS_ALLOWLIST.find((column) => column.key === key);
const getAllowedKeys = (userContext) => getAllowedConsultaMilitarColumns({ userContext }).map((column) => column.key);

test('admin vê todas as colunas sensíveis (telefone, email, tipo_sanguineo)', () => {
  const allowedKeys = getAllowedKeys({
    isAdmin: true,
    canAccessAction: () => false,
  });

  for (const key of SENSITIVE_KEYS) {
    assert.equal(allowedKeys.includes(key), true, `${key} deve ser permitido para admin`);
  }
});

test('usuário comum com ver_dados_sensiveis_militar vê colunas sensíveis', () => {
  const allowedKeys = getAllowedKeys({
    isAdmin: false,
    canAccessAction: (action) => action === 'ver_dados_sensiveis_militar',
  });

  for (const key of SENSITIVE_KEYS) {
    assert.equal(allowedKeys.includes(key), true, `${key} deve ser permitido quando há permissão explícita`);
  }
});

test('usuário comum sem permissão não vê colunas sensíveis', () => {
  const allowedKeys = getAllowedKeys({
    isAdmin: false,
    canAccessAction: () => false,
    roles: ['gestor_operacional'],
    modoAcesso: 'gestor_operacional',
  });

  for (const key of SENSITIVE_KEYS) {
    assert.equal(allowedKeys.includes(key), false, `${key} não deve ser permitido sem permissão`);
  }
});

test('colunas não sensíveis sempre aparecem para usuário comum', () => {
  const allowedKeys = getAllowedKeys({
    isAdmin: false,
    canAccessAction: () => false,
  });

  const nonSensitiveKeys = CONSULTA_MILITAR_COLUNAS_ALLOWLIST
    .filter((column) => column.sensitive !== true)
    .map((column) => column.key);

  for (const key of nonSensitiveKeys) {
    assert.equal(allowedKeys.includes(key), true, `${key} não sensível deve sempre aparecer`);
  }
});

test('role ou modo de acesso não substituem a permissão explícita de dados sensíveis', () => {
  const column = byKey('telefone');
  assert.ok(column, 'coluna sensível de referência deve existir');
  assert.deepEqual(column.visibleFor, ['admin'], 'metadado visual legado pode permanecer sem conceder acesso');

  const allowedKeys = getAllowedKeys({
    isAdmin: false,
    canAccessAction: () => false,
    roles: ['admin'],
    modoAcesso: 'gestor',
  });

  assert.equal(
    allowedKeys.includes('telefone'),
    false,
    'role/mode não deve liberar coluna sensível sem ver_dados_sensiveis_militar',
  );
});

test('lista retornada não contém colunas duplicadas', () => {
  const allowedKeys = getAllowedKeys({
    isAdmin: true,
    canAccessAction: () => true,
  });

  assert.equal(new Set(allowedKeys).size, allowedKeys.length, 'lista de colunas permitidas não deve ter duplicidade');
});

test('localStorage legado: coluna sensível salva é descartada quando usuário perde permissão', () => {
  const visibleColumnsFromLegacyStorage = ['telefone', 'nome'];

  const allowedKeys = getAllowedKeys({
    isAdmin: false,
    canAccessAction: () => false,
    roles: [],
    modoAcesso: 'gestor',
  });

  const sanitizedVisibleColumns = visibleColumnsFromLegacyStorage.filter((key) => allowedKeys.includes(key));

  assert.deepEqual(sanitizedVisibleColumns, ['nome']);
});
