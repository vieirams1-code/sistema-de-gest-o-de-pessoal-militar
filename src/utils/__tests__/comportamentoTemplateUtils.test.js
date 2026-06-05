import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizarHistoricoComportamentoParaTemplate,
  resolverMarcoComportamento,
  marcoEhValidoParaGeracaoRP,
  montarVariaveisComportamentoTemplate,
  gerarTextoRPComportamento,
  TIPO_TEMPLATE_COMPORTAMENTO
} from '../comportamentoTemplateUtils.js';

test('sanitizarHistoricoComportamentoParaTemplate lida com entradas vazias ou nulas', () => {
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate([]), []);
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate(null), []);
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate(undefined), []);
});

test('sanitizarHistoricoComportamentoParaTemplate filtra datas inválidas e comportamentos N/D', () => {
  const eventos = [
    { data_alteracao: 'invalida', comportamento_novo: 'BOM' },
    { data_alteracao: '2023-01-01', comportamento_novo: 'N/D' },
    { data_alteracao: '2023-01-01', comportamento_novo: '  n/d  ' },
    { data_alteracao: '2023-05-01', comportamento_novo: 'ÓTIMO' },
  ];
  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].comportamento_novo, 'ÓTIMO');
});

test('sanitizarHistoricoComportamentoParaTemplate filtra registros automáticos/intermediários', () => {
  const eventos = [
    { data_alteracao: '2023-01-01', comportamento_novo: 'BOM', origem_tipo: 'AUTOMATICO' },
    { data_alteracao: '2023-01-02', comportamento_novo: 'BOM', origem_tipo: 'CALCULO_SISTEMA' },
    { data_alteracao: '2023-01-03', comportamento_novo: 'BOM', motivo_mudanca: 'RECALCULO AUTOMÁTICO' },
    { data_alteracao: '2023-01-04', comportamento_novo: 'ÓTIMO', origem_tipo: 'MANUAL' },
  ];
  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].comportamento_novo, 'ÓTIMO');
});

test('sanitizarHistoricoComportamentoParaTemplate ordena corretamente e mantém o último do dia', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-01', comportamento_novo: 'BOM', created_date: '2023-01-01T10:00:00Z' },
    { id: 2, data_alteracao: '2023-01-01', comportamento_novo: 'ÓTIMO', created_date: '2023-01-01T11:00:00Z' },
    { id: 3, data_alteracao: '2022-12-31', comportamento_novo: 'BOM', created_date: '2022-12-31T10:00:00Z' },
  ];
  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);
  // Ordenado: 2022-12-31 (BOM), 2023-01-01 (ÓTIMO - o id 2 subscreve id 1 por ser mais recente no mesmo dia)
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].id, 3);
  assert.equal(resultado[1].id, 2);
});

test('sanitizarHistoricoComportamentoParaTemplate identifica apenas marcos reais (mudança de comportamento)', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-01', comportamento_novo: 'BOM' },
    { id: 2, data_alteracao: '2023-02-01', comportamento_novo: 'BOM' }, // Não deve ser marco (comportamento igual ao anterior)
    { id: 3, data_alteracao: '2023-03-01', comportamento_novo: 'ÓTIMO' }, // Marco!
  ];
  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].id, 1);
  assert.equal(resultado[1].id, 3);
});

test('resolverMarcoComportamento encontra o marco correto', () => {
  const eventos = [
    { id: 'm1', data_alteracao: '2023-01-01', comportamento_novo: 'BOM' },
    { id: 'm2', data_alteracao: '2023-03-01', comportamento_novo: 'ÓTIMO' },
  ];

  // Sem seleção explicita, pega o último
  assert.equal(resolverMarcoComportamento(eventos).id, 'm2');

  // Com seleção explicita
  assert.equal(resolverMarcoComportamento(eventos, 'm1').id, 'm1');

  // ID inexistente, volta pro último
  assert.equal(resolverMarcoComportamento(eventos, 'inexistente').id, 'm2');
});

test('marcoEhValidoParaGeracaoRP valida campos essenciais', () => {
  const marcoValido = {
    comportamento_novo: 'ÓTIMO',
    data_alteracao: '2023-01-01',
    motivo_mudanca: 'Decurso de tempo',
    fundamento_legal: 'Art. 123'
  };

  assert.strictEqual(marcoEhValidoParaGeracaoRP(marcoValido), true);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, comportamento_novo: null }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, fundamento_legal: '' }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP(null), false);
});

test('montarVariaveisComportamentoTemplate mapeia campos corretamente', () => {
  const militar = {
    nome_completo: 'JOSE DA SILVA',
    posto_graduacao: 'CB',
    matricula: '123456',
    quadro: 'QPBM',
    lotacao: '1º GBM'
  };
  const marco = {
    comportamento_anterior: 'BOM',
    comportamento_novo: 'ÓTIMO',
    data_alteracao: '2023-01-01',
    motivo_mudanca: 'PROMOÇÃO',
    fundamento_legal: 'LEI 001'
  };

  const vars = montarVariaveisComportamentoTemplate(militar, marco, { _formatDateBR: (d) => d });
  assert.equal(vars.militar_nome, 'JOSE DA SILVA');
  assert.equal(vars.posto_graduacao, 'CB');
  assert.equal(vars.comportamento_novo, 'ÓTIMO');
  assert.equal(vars.data_alteracao, '2023-01-01');
});

test('gerarTextoRPComportamento gera texto ou retorna erro de campos ausentes', () => {
  const militar = { nome_completo: 'JOSE' };
  const marco = { comportamento_novo: 'BOM', data_alteracao: '2023-01-01' };
  const template = 'Militar {{militar_nome}} passou para {{comportamento_novo}}';

  // Incompleto (faltam motivo e fundamento)
  const resultErro = gerarTextoRPComportamento({ template, militar, marco });
  assert.equal(resultErro.ok, false);
  assert.match(resultErro.erro, /Campos essenciais ausentes/);

  // Completo
  const marcoCompleto = {
    ...marco,
    motivo_mudanca: 'Tempo',
    fundamento_legal: 'Art 1',
    posto_graduacao: 'SD',
    comportamento_anterior: 'NENHUM',
    matricula: '001'
  };
  const militarCompleto = { ...militar, posto_graduacao: 'SD', matricula: '001' };

  const resultOk = gerarTextoRPComportamento({
    template,
    militar: militarCompleto,
    marco: marcoCompleto,
    tipoTemplate: TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO,
    utils: {
        formatDateBR: (d) => d,
        aplicarTemplate: (t, v) => t.replace('{{militar_nome}}', v.militar_nome).replace('{{comportamento_novo}}', v.comportamento_novo)
    }
  });

  assert.equal(resultOk.ok, true);
  assert.equal(resultOk.texto, 'Militar JOSE passou para BOM');
});
