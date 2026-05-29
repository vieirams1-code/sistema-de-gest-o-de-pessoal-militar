import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compactCrm, isSameCrm, medicoDisplayName, normalizeCrm } from './medicoUtils.js';

describe('medicoUtils', () => {
  it('normaliza espaços e caixa do CRM', () => {
    assert.equal(normalizeCrm('  crm/sp   123456  '), 'CRM/SP 123456');
  });

  it('compara CRM ignorando pontuação para evitar duplicidade simples', () => {
    assert.equal(compactCrm('CRM/SP 123456'), 'CRMSP123456');
    assert.equal(isSameCrm('CRM/SP 123456', 'crm-sp 123456'), true);
    assert.equal(isSameCrm('CRM/SP 123456', 'CRM/RJ 123456'), false);
  });

  it('monta rótulo com snapshot ou legado de médico', () => {
    assert.equal(
      medicoDisplayName({ medico_nome_snapshot: 'Dra. Ana', medico_crm_snapshot: 'crm/sp 123456' }),
      'Dra. Ana — CRM CRM/SP 123456',
    );
  });
});
