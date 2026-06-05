import assert from 'node:assert';
import test from 'node:test';
import { listarInconsistenciasCadastraisMilitar } from '../inconsistenciasCadastrais.js';

test('listarInconsistenciasCadastraisMilitar - identifica inconsistências críticas funcionais', () => {
  const militar = {
    nome_completo: 'JOÃO SILVA',
    // data_inclusao ausente
    // posto_graduacao ausente
    // quadro ausente
    // lotacao ausente
  };

  const res = listarInconsistenciasCadastraisMilitar(militar);
  const tipos = res.map(i => i.tipo);

  assert.ok(tipos.includes('sem_data_inclusao'));
  assert.ok(tipos.includes('sem_posto_graduacao'));
  assert.ok(tipos.includes('sem_quadro'));
  assert.ok(tipos.includes('sem_lotacao'));

  const criticos = res.filter(i => i.nivel === 'critico');
  assert.strictEqual(criticos.length >= 4, true);
});

test('listarInconsistenciasCadastraisMilitar - identifica inconsistências críticas de documentos', () => {
  const militar = {
    nome_completo: 'JOÃO SILVA',
    data_inclusao: '2010-01-01',
    posto_graduacao: 'Soldado',
    quadro: 'QPPM',
    lotacao: '1º BPM',
    email_funcional: 'joao@pm.gov',
    telefone: '123',
    logradouro: 'Rua A',
    cidade: 'Natal',
    tipo_sanguineo: 'O+',
    // cpf ausente
    // rg ausente
    // data_nascimento ausente
  };

  const res = listarInconsistenciasCadastraisMilitar(militar);
  const tipos = res.map(i => i.tipo);

  assert.ok(tipos.includes('sem_cpf'));
  assert.ok(tipos.includes('sem_rg'));
  assert.ok(tipos.includes('sem_data_nascimento'));

  assert.strictEqual(res.every(i => i.nivel === 'critico'), true);
});

test('listarInconsistenciasCadastraisMilitar - identifica inconsistências de atenção (contatos)', () => {
  const militar = {
    nome_completo: 'JOÃO SILVA',
    data_inclusao: '2010-01-01',
    posto_graduacao: 'Soldado',
    quadro: 'QPPM',
    lotacao: '1º BPM',
    cpf: '123',
    rg: '456',
    data_nascimento: '1990-01-01',
    logradouro: 'Rua A',
    cidade: 'Natal',
    tipo_sanguineo: 'O+',
    // email_particular e email_funcional ausentes
    // telefone ausente
  };

  const res = listarInconsistenciasCadastraisMilitar(militar);
  const tipos = res.map(i => i.tipo);

  assert.ok(tipos.includes('sem_email'));
  assert.ok(tipos.includes('sem_telefone'));

  const atencao = res.filter(i => i.nivel === 'atencao');
  assert.strictEqual(atencao.length >= 2, true);
});

test('listarInconsistenciasCadastraisMilitar - identifica inconsistências de atenção (endereço e saúde)', () => {
  const militar = {
    nome_completo: 'JOÃO SILVA',
    data_inclusao: '2010-01-01',
    posto_graduacao: 'Soldado',
    quadro: 'QPPM',
    lotacao: '1º BPM',
    cpf: '123',
    rg: '456',
    data_nascimento: '1990-01-01',
    email_funcional: 'joao@pm.gov',
    telefone: '123',
    // logradouro ausente
    // tipo_sanguineo ausente
  };

  const res = listarInconsistenciasCadastraisMilitar(militar);
  const tipos = res.map(i => i.tipo);

  assert.ok(tipos.includes('endereco_incompleto'));
  assert.ok(tipos.includes('sem_tipo_sanguineo'));
});

test('listarInconsistenciasCadastraisMilitar - retorna vazio para militar completo', () => {
  const militar = {
    data_inclusao: '2010-01-01',
    posto_graduacao: 'Soldado',
    quadro: 'QPPM',
    lotacao: '1º BPM',
    cpf: '123',
    rg: '456',
    data_nascimento: '1990-01-01',
    email_funcional: 'joao@pm.gov',
    telefone: '123',
    logradouro: 'Rua A',
    cidade: 'Natal',
    tipo_sanguineo: 'O+',
  };

  const res = listarInconsistenciasCadastraisMilitar(militar);
  assert.strictEqual(res.length, 0);
});
