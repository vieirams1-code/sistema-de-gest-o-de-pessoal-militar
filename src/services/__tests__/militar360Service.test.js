import test from 'node:test';
import assert from 'node:assert/strict';
import { montarMilitar360Bundle } from '../militar360Service.js';

test('montarMilitar360Bundle - militar ativo sem pendências', () => {
  const militar = {
    id: '1',
    nome_completo: 'João Silva',
    nome_guerra: 'João',
    matricula: '123456789', // 9 dígitos para passar na auditoria
    posto_graduacao: 'Soldado',
    quadro: 'QPM-1',
    comportamento: 'Bom',
    lotacao: '1º BPM',
    funcao: 'Motorista',
    data_inclusao: '2020-01-01',
    cpf: '12345678909', // CPF válido ou ao menos formatado
    data_nascimento: '1990-01-01'
  };

  const bundle = montarMilitar360Bundle({ militar });

  assert.equal(bundle.identidade.nomeCompleto, 'João Silva');
  assert.equal(bundle.statusOperacional.status, 'DISPONIVEL');
  assert.equal(bundle.resumoExecutivo.comportamento, 'Bom');
  assert.ok(bundle.pendencias.quantidadeTotal >= 0);
});

test('montarMilitar360Bundle - militar com atestado ativo', () => {
  const militar = { id: '1', nome_completo: 'João Silva' };
  const hoje = new Date('2024-05-20');
  const atestados = [{ id: 'a1', status: 'Ativo', tipo_afastamento: 'LTS', data_inicio: '2024-05-20', data_termino: '2024-05-21' }];

  const bundle = montarMilitar360Bundle({ militar, atestados, hoje });

  assert.equal(bundle.statusOperacional.status, 'AFASTADO');
  assert.equal(bundle.saude.afastamentoAtivo, true);
  assert.equal(bundle.resumoExecutivo.situacaoSaude, 'Com afastamento');
});

test('montarMilitar360Bundle - militar em férias', () => {
  const militar = { id: '1', nome_completo: 'João Silva' };
  const hoje = new Date('2024-05-20');
  const ferias = [{ id: 'f1', status: 'Em Curso', data_inicio: '2024-05-20', data_fim: '2024-05-21' }];

  const bundle = montarMilitar360Bundle({ militar, ferias, hoje });

  assert.equal(bundle.statusOperacional.status, 'FERIAS');
  assert.equal(bundle.ferias.situacaoAtual.emGozo, true);
  assert.equal(bundle.resumoExecutivo.situacaoFerias, 'Em gozo');
});

test('montarMilitar360Bundle - militar com dados cadastrais ausentes', () => {
  const militar = { id: '1' }; // Faltando nome, posto, etc.

  const bundle = montarMilitar360Bundle({ militar });

  assert.equal(bundle.identidade.nomeCompleto, 'Não informado');
  assert.ok(bundle.pendencias.quantidadeTotal > 0);
  assert.equal(bundle.pendencias.cadastrais.some(p => p.campo === 'data_inclusao'), true);
});

test('montarMilitar360Bundle - ausência de arrays opcionais', () => {
  const militar = { id: '1', nome_completo: 'João' };

  // Chamada sem passar os outros argumentos
  const bundle = montarMilitar360Bundle({ militar });

  assert.equal(bundle.identidade.nomeCompleto, 'João');
  assert.ok(Array.isArray(bundle.ferias.historico));
  assert.ok(Array.isArray(bundle.carreira.historicoPromocoes));
});

test('montarMilitar360Bundle - datas inválidas sem quebrar', () => {
  const militar = { id: '1', created_date: 'data-invalida' };
  const ferias = [{ id: 'f1', data_inicio: 'invalida' }];

  const bundle = montarMilitar360Bundle({ militar, ferias });

  assert.equal(bundle.auditoria.dataCriacao, 'data-invalida');
  assert.equal(bundle.ferias.situacaoAtual.emGozo, false);
});
