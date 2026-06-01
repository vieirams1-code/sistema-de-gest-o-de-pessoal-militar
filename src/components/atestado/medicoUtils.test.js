import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compactCrm, findDuplicateCrm, isSameCrm, matchesMedicoSearch, medicoDisplayName, normalizeCrm, normalizeMedicoForm, validateMedicoForm } from './medicoUtils.js';

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

  it('normaliza o formulário e impede nome ou CRM vazio', () => {
    assert.deepEqual(normalizeMedicoForm({ nome: '  Dra.   Ana  ', crm: ' crm/sp   123 ', observacoes: '  Clínica   central  ' }), {
      nome: 'Dra. Ana', crm: 'CRM/SP 123', observacoes: 'Clínica central', ativo: true,
    });
    assert.equal(validateMedicoForm({ nome: '   ', crm: 'CRM/SP 123' }), 'Informe o nome do médico.');
    assert.equal(validateMedicoForm({ nome: 'Dra. Ana', crm: '   ' }), 'Informe o CRM do médico.');
  });

  it('localiza CRM duplicado e permite ignorar o registro editado', () => {
    const medicos = [{ id: '1', nome: 'Dra. Ana', crm: 'CRM/SP 123' }];
    assert.equal(findDuplicateCrm(medicos, 'crm-sp 123')?.id, '1');
    assert.equal(findDuplicateCrm(medicos, 'crm-sp 123', '1'), null);
  });

  it('pesquisa médico por nome ou CRM', () => {
    const medico = { nome: 'Dra. Ana Souza', crm: 'CRM/SP 123' };
    assert.equal(matchesMedicoSearch(medico, 'ana'), true);
    assert.equal(matchesMedicoSearch(medico, 'sp 123'), true);
    assert.equal(matchesMedicoSearch(medico, 'rio'), false);
  });
});
