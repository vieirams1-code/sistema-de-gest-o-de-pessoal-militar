import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarHistoricoComportamentoParaTemplate,
  resolverMarcoComportamento,
  resolverMarcoComportamentoValido,
  marcoEhValidoParaGeracaoRP,
  montarVariaveisComportamentoTemplate,
  gerarTextoRPComportamento,
  __setComportamentoTemplateUtilsDepsForTests
} from '../comportamentoTemplateUtils.js';

// Setup Mocks
test.beforeEach(() => {
  __setComportamentoTemplateUtilsDepsForTests({
    formatDateBR: (ds) => {
      if (!ds) return '';
      const [y, m, d] = ds.split('-');
      return `${d}/${m}/${y}`;
    },
    aplicarTemplate: (template, vars) => {
      if (!template) return '';
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
    }
  });
});

test.afterEach(() => {
  __setComportamentoTemplateUtilsDepsForTests(null);
});

test('sanitizarHistoricoComportamentoParaTemplate - filtragem básica', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-01', comportamento_novo: 'BOM' },
    { id: 2, data_alteracao: 'INVALIDO', comportamento_novo: 'BOM' },
    { id: 3, data_alteracao: '2023-01-02', comportamento_novo: 'N/D' },
    { id: 4, data_alteracao: '2023-01-02', comportamento_novo: ' n/d ' },
    { id: 5, data_alteracao: null, comportamento_novo: 'BOM' },
    { id: 6, data_alteracao: '2023-01-03', comportamento_novo: null },
    { id: 7, data_alteracao: '2023-01-03', comportamento_novo: 'ÓTIMO', origem_tipo: 'AUTOMATICO' },
    { id: 8, data_alteracao: '2023-01-04', comportamento_novo: 'ÓTIMO', motivo_mudanca: 'Mudança automática' },
    { id: 9, data_alteracao: '2023-01-05', comportamento_novo: 'ÓTIMO', origem_tipo: 'VERIFICACAO_DIARIA' },
  ];

  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 1);
});

test('sanitizarHistoricoComportamentoParaTemplate - ordenação e consolidação diária', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-02', comportamento_novo: 'ÓTIMO', updatedDate: '2023-01-02T10:00:00Z' },
    { id: 2, data_alteracao: '2023-01-01', comportamento_novo: 'BOM', created_date: '2023-01-01T10:00:00Z' },
    { id: 3, data_alteracao: '2023-01-02', comportamento_novo: 'EXCEPCIONAL', createdDate: '2023-01-02T11:00:00Z' },
    { id: 4, data_alteracao: '2023-01-02', comportamento_novo: 'INSUBORDINADO', updated_date: '2023-01-02T09:00:00Z' },
  ];

  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].id, 2); // 2023-01-01
  assert.equal(resultado[1].id, 3); // 2023-01-02 (último do dia)
});

test('sanitizarHistoricoComportamentoParaTemplate - remoção de redundância consecutiva', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-01', comportamento_novo: 'BOM' },
    { id: 2, data_alteracao: '2023-01-02', comportamento_novo: 'BOM' },
    { id: 3, data_alteracao: '2023-01-03', comportamento_novo: 'ÓTIMO' },
  ];

  const resultado = sanitizarHistoricoComportamentoParaTemplate(eventos);

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].id, 1);
  assert.equal(resultado[1].id, 3);
});

test('sanitizarHistoricoComportamentoParaTemplate - entradas inválidas', () => {
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate(null), []);
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate(undefined), []);
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate({}), []);
  assert.deepEqual(sanitizarHistoricoComportamentoParaTemplate([]), []);
});

test('resolverMarcoComportamento', () => {
  const eventos = [
    { id: 'A', data_alteracao: '2023-01-01', comportamento_novo: 'BOM' },
    { id: 'B', data_alteracao: '2023-01-02', comportamento_novo: 'ÓTIMO' },
  ];

  assert.equal(resolverMarcoComportamento(eventos, 'A').id, 'A');
  assert.equal(resolverMarcoComportamento(eventos, 'NON-EXISTENT').id, 'B'); // Fallback para o último
  assert.equal(resolverMarcoComportamento(eventos).id, 'B'); // Último se não informado ID
  assert.equal(resolverMarcoComportamento([]), null);
});

test('marcoEhValidoParaGeracaoRP', () => {
  const marcoValido = {
    comportamento_novo: 'BOM',
    data_alteracao: '2023-01-01',
    motivo_mudanca: 'Completou tempo',
    fundamento_legal: 'Artigo X'
  };

  assert.strictEqual(marcoEhValidoParaGeracaoRP(marcoValido), true);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, comportamento_novo: '' }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, comportamento_novo: 'NÃO INFORMADO' }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, data_alteracao: 'invalida' }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, motivo_mudanca: null }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP({ ...marcoValido, fundamento_legal: ' ' }), false);
  assert.strictEqual(marcoEhValidoParaGeracaoRP(null), false);
});

test('resolverMarcoComportamentoValido', () => {
  const eventos = [
    { id: 1, data_alteracao: '2023-01-01', comportamento_novo: 'BOM', motivo_mudanca: 'A', fundamento_legal: 'L' },
    { id: 2, data_alteracao: '2023-01-02', comportamento_novo: 'ÓTIMO' }, // Incompleto
  ];

  assert.equal(resolverMarcoComportamentoValido(eventos, 2).id, 1);
  assert.equal(resolverMarcoComportamentoValido(eventos).id, 1);
});

test('montarVariaveisComportamentoTemplate', () => {
  const militar = {
    nome_completo: 'JOÃO SILVA',
    posto_graduacao: 'CB',
    matricula: '12345',
    quadro: 'QPBM',
    lotacao: '1º GBM'
  };
  const marco = {
    comportamento_anterior: 'BOM',
    comportamento_novo: 'ÓTIMO',
    data_alteracao: '2023-01-01',
    motivo_mudanca: 'Tempo de serviço',
    fundamento_legal: 'Regulamento X'
  };

  const vars = montarVariaveisComportamentoTemplate(militar, marco);

  assert.equal(vars.militar_nome, 'JOÃO SILVA');
  assert.equal(vars.posto_graduacao, 'CB');
  assert.equal(vars.matricula, '12345');
  assert.equal(vars.quadro, 'QPBM');
  assert.equal(vars.unidade, '1º GBM');
  assert.equal(vars.comportamento_anterior, 'BOM');
  assert.equal(vars.comportamento_novo, 'ÓTIMO');
  assert.equal(vars.data_alteracao, '01/01/2023');
  assert.equal(vars.comportamento_calculado, 'ÓTIMO');
  assert.equal(vars.comportamento_cadastrado, 'BOM');
  assert.equal(vars.data_inicio_comportamento, '01/01/2023');
  assert.equal(vars.data_vigencia, '01/01/2023');
  assert.equal(vars.motivo_mudanca, 'Tempo de serviço');
  assert.equal(vars.fundamento_legal, 'Regulamento X');
});

test('gerarTextoRPComportamento - sucesso', () => {
  const template = 'Militar {{nome_completo}} / Comportamento {{comportamento}} / Vigente desde {{data_inicio_comportamento}}';
  const militar = { nome_completo: 'JOÃO', posto_graduacao: 'SD', matricula: '1', quadro: 'Q' };
  const marco = {
    comportamento_anterior: 'A',
    comportamento_novo: 'B',
    data_alteracao: '2023-05-01',
    motivo_mudanca: 'M',
    fundamento_legal: 'F'
  };

  const resultado = gerarTextoRPComportamento({ template, militar, marco });

  assert.strictEqual(resultado.ok, true);
  assert.equal(resultado.texto, 'Militar JOÃO / Comportamento B / Vigente desde 01/05/2023');
});

test('gerarTextoRPComportamento - erro por campos ausentes', () => {
  const template = '...';
  const militar = { nome_completo: 'JOÃO' };
  const marco = { comportamento_novo: 'B' };

  const resultado = gerarTextoRPComportamento({ template, militar, marco });

  assert.strictEqual(resultado.ok, false);
  assert.match(resultado.erro, /Campos essenciais ausentes/);
  assert.match(resultado.erro, /Posto\/graduação/);
});
