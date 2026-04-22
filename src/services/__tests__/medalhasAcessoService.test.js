import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACOES_APURACAO,
  ACOES_MEDALHAS,
  adicionarAuditoriaMedalha,
  temAlgumaPermissaoMedalhas,
  validarMilitarDentroEscopo,
  validarPermissaoAcaoMedalhas,
} from '../medalhasAcessoService.js';

test('temAlgumaPermissaoMedalhas valida acesso funcional à apuração', () => {
  const permitidas = new Set([ACOES_MEDALHAS.EXPORTAR]);
  const canAccessAction = (acao) => permitidas.has(acao);

  assert.equal(temAlgumaPermissaoMedalhas(canAccessAction, ACOES_APURACAO), true);
  assert.equal(temAlgumaPermissaoMedalhas(() => false, ACOES_APURACAO), false);
});

test('validarPermissaoAcaoMedalhas bloqueia usuário sem permissão', () => {
  assert.throws(
    () => validarPermissaoAcaoMedalhas({ canAccessAction: () => false, acao: ACOES_MEDALHAS.INDICAR }),
    /não possui permissão/i,
  );

  assert.doesNotThrow(() => validarPermissaoAcaoMedalhas({
    canAccessAction: (acao) => acao === ACOES_MEDALHAS.INDICAR,
    acao: ACOES_MEDALHAS.INDICAR,
  }));
});

test('validarMilitarDentroEscopo impede atuação fora do escopo local', () => {
  const escopo = new Set(['militar-1', 'militar-2']);

  assert.doesNotThrow(() => validarMilitarDentroEscopo({ isAdmin: false, militarId: 'militar-1', militarIdsEscopo: escopo }));

  assert.throws(
    () => validarMilitarDentroEscopo({ isAdmin: false, militarId: 'militar-9', militarIdsEscopo: escopo }),
    /fora do escopo organizacional/i,
  );

  assert.doesNotThrow(() => validarMilitarDentroEscopo({ isAdmin: true, militarId: 'militar-9', militarIdsEscopo: escopo }));
});

test('adicionarAuditoriaMedalha registra metadados de rastreabilidade', () => {
  const indicacao = adicionarAuditoriaMedalha({ status: 'INDICADA' }, { userEmail: 'gestor@sgp.mil', acao: 'indicacao' });
  assert.equal(indicacao.indicado_por, 'gestor@sgp.mil');
  assert.equal(indicacao.updated_by, 'gestor@sgp.mil');
  assert.ok(indicacao.updated_at);

  const concessao = adicionarAuditoriaMedalha({ status: 'CONCEDIDA' }, { userEmail: 'admin@sgp.mil', acao: 'concessao' });
  assert.equal(concessao.concedido_por, 'admin@sgp.mil');

  const reset = adicionarAuditoriaMedalha({ status: 'CANCELADA' }, { userEmail: 'admin@sgp.mil', acao: 'reset' });
  assert.equal(reset.resetado_por, 'admin@sgp.mil');
});
