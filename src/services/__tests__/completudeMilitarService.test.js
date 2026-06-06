import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calcularCompletudeMilitar } from '../completudeMilitarService.js';

describe('completudeMilitarService', () => {
  test('deve retornar score 0 para militar vazio', () => {
    const resultado = calcularCompletudeMilitar({});
    assert.strictEqual(resultado.percentual, 0);
    assert.strictEqual(resultado.preenchidos.length, 0);
    assert.ok(resultado.faltantes.length > 0);
    assert.ok(resultado.criticos.length > 0);
  });

  test('deve calcular corretamente para militar com campos críticos preenchidos', () => {
    const militar = {
      nome_completo: 'JOÃO SILVA',
      matricula: '1234567',
      cpf: '123.456.789-00',
      data_inclusao: '01/01/2020',
      posto_graduacao: 'Soldado',
      quadro: 'QOBM',
      lotacao: '1º BBM',
    };

    const resultado = calcularCompletudeMilitar(militar);

    // 7 campos preenchidos de 32 totais = ~22%
    assert.strictEqual(resultado.percentual, 22);
    assert.strictEqual(resultado.preenchidos.length, 7);
    assert.strictEqual(resultado.criticos.length, 0);
    assert.ok(resultado.preenchidos.includes('nome_completo'));
    assert.ok(resultado.preenchidos.includes('lotacao'));
  });

  test('deve retornar score 100 para militar totalmente preenchido', () => {
    const militar = {
      nome_completo: 'JOÃO SILVA',
      matricula: '1234567',
      cpf: '123.456.789-00',
      data_inclusao: '01/01/2020',
      posto_graduacao: 'Soldado',
      quadro: 'QOBM',
      lotacao: '1º BBM',
      nome_guerra: 'SILVA',
      data_nascimento: '01/01/1990',
      sexo: 'Masculino',
      estado_civil: 'Casado',
      tipo_sanguineo: 'O+',
      religiao: 'Católica',
      escolaridade: 'Superior',
      naturalidade: 'Cidade',
      naturalidade_uf: 'UF',
      nome_pai: 'Pai',
      nome_mae: 'Mãe',
      rg: '12345',
      orgao_expedidor_rg: 'SSP',
      uf_rg: 'UF',
      cnh_numero: '123456',
      etnia: 'Parda',
      email_particular: 'teste@teste.com',
      telefone: '123456789',
      email_funcional: 'funcional@teste.com',
      logradouro: 'Rua A',
      numero_endereco: '10',
      cep: '12345-678',
      bairro: 'Centro',
      cidade: 'Cidade',
      uf: 'UF',
    };

    const resultado = calcularCompletudeMilitar(militar);
    assert.strictEqual(resultado.percentual, 100);
    assert.strictEqual(resultado.faltantes.length, 0);
    assert.strictEqual(resultado.criticos.length, 0);
  });

  test('deve tratar campos com strings vazias como não preenchidos', () => {
    const militar = {
      nome_completo: '  ',
      matricula: '',
    };

    const resultado = calcularCompletudeMilitar(militar);
    assert.strictEqual(resultado.percentual, 0);
    assert.ok(resultado.faltantes.includes('nome_completo'));
    assert.ok(resultado.faltantes.includes('matricula'));
  });

  test('deve identificar críticos faltantes corretamente', () => {
    const militar = {
      nome_completo: 'JOÃO',
      // matricula faltante (crítico)
      // cpf faltante (crítico)
      nome_guerra: 'JOÃO', // não crítico
    };

    const resultado = calcularCompletudeMilitar(militar);
    assert.ok(resultado.criticos.includes('matricula'));
    assert.ok(resultado.criticos.includes('cpf'));
    assert.ok(!resultado.criticos.includes('nome_guerra'));
  });
});
