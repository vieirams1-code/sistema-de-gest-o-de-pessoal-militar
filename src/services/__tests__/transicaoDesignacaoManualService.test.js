import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACOES_TRANSICAO_DESIGNACAO,
  RISCOS_TRANSICAO_DESIGNACAO,
  SITUACOES_TRANSICAO_DESIGNACAO,
  analisarPeriodoTransicaoDesignacao,
  analisarTransicaoDesignacaoManual,
  calcularPreviewHashTransicaoDesignacao,
} from '../transicaoDesignacaoManualService.js';

const contrato = { id: 'c1', militar_id: 'm1', data_inclusao_para_ferias: '2025-01-01' };
const militar = { id: 'm1' };
const basePeriodo = (overrides = {}) => ({
  id: overrides.id || 'p1',
  militar_id: 'm1',
  contrato_designacao_id: 'c1',
  inicio_aquisitivo: '2024-01-01',
  fim_aquisitivo: '2024-12-31',
  ano_referencia: '2024/2024',
  periodo_aquisitivo_ref: '2024/2024',
  status: 'Gozado',
  dias_saldo: 0,
  inativo: false,
  origem_periodo: 'gerado',
  legado_ativa: false,
  excluido_da_cadeia_designacao: false,
  updated_date: '2025-01-02T00:00:00Z',
  ...overrides,
});

const analisarPeriodo = (periodo, feriasVinculadas = []) => analisarPeriodoTransicaoDesignacao({
  periodo,
  feriasVinculadas,
  contrato,
  dataBase: '2025-01-01',
});

test('período anterior à data-base sugere marcar_legado_ativa', () => {
  const result = analisarPeriodo(basePeriodo());
  assert.equal(result.situacaoAtual, SITUACOES_TRANSICAO_DESIGNACAO.ANTERIOR_DATA_BASE);
  assert.equal(result.acaoSugerida, ACOES_TRANSICAO_DESIGNACAO.MARCAR_LEGADO_ATIVA);
});

test('período futuro sem férias sugere cancelar_periodo_futuro_indevido', () => {
  const result = analisarPeriodo(basePeriodo({ fim_aquisitivo: '2025-12-31' }));
  assert.equal(result.situacaoAtual, SITUACOES_TRANSICAO_DESIGNACAO.FUTURO_POS_DATA_BASE);
  assert.equal(result.acaoSugerida, ACOES_TRANSICAO_DESIGNACAO.CANCELAR_PERIODO_FUTURO_INDEVIDO);
  assert.ok(result.riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.FUTURO_INDEVIDO));
});

test('período já legado sugere manter', () => {
  const result = analisarPeriodo(basePeriodo({ legado_ativa: true }));
  assert.equal(result.situacaoAtual, SITUACOES_TRANSICAO_DESIGNACAO.JA_LEGADO);
  assert.equal(result.acaoSugerida, ACOES_TRANSICAO_DESIGNACAO.MANTER);
});

test('período sem fim aquisitivo gera bloqueante', () => {
  const result = analisarPeriodo(basePeriodo({ fim_aquisitivo: null }));
  assert.ok(result.bloqueantes.includes(RISCOS_TRANSICAO_DESIGNACAO.PERIODO_SEM_FIM_AQUISITIVO));
  assert.equal(result.acaoSugerida, ACOES_TRANSICAO_DESIGNACAO.MANTER);
});

test('férias em curso gera bloqueante', () => {
  const result = analisarPeriodo(basePeriodo({ id: 'p-ferias' }), [{ id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p-ferias', status: 'Em Curso' }]);
  assert.ok(result.bloqueantes.includes(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_EM_CURSO));
  assert.equal(result.situacaoAtual, SITUACOES_TRANSICAO_DESIGNACAO.COM_FERIAS_EM_CURSO);
});

test('férias prevista/autorizada gera bloqueante', () => {
  const result = analisarPeriodo(basePeriodo({ id: 'p-ferias' }), [{ id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p-ferias', status: 'Autorizada' }]);
  assert.ok(result.bloqueantes.includes(RISCOS_TRANSICAO_DESIGNACAO.FERIAS_PREVISTA_OU_AUTORIZADA));
  assert.equal(result.situacaoAtual, SITUACOES_TRANSICAO_DESIGNACAO.COM_FERIAS_PREVISTA_OU_AUTORIZADA);
});

test('saldo aberto gera risco não bloqueante', () => {
  const result = analisarPeriodo(basePeriodo({ dias_saldo: 7 }));
  assert.ok(result.riscos.includes(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO));
  assert.ok(!result.bloqueantes.includes(RISCOS_TRANSICAO_DESIGNACAO.SALDO_ABERTO));
  assert.equal(result.overridePermitido, true);
});

test('status Pago gera bloqueante', () => {
  const result = analisarPeriodo(basePeriodo({ status: 'Pago' }));
  assert.ok(result.bloqueantes.includes(RISCOS_TRANSICAO_DESIGNACAO.STATUS_PAGO_NAO_PREVISTO));
  assert.equal(result.acaoSugerida, ACOES_TRANSICAO_DESIGNACAO.MANTER);
});

test('ações permitidas por cenário', () => {
  const anterior = analisarPeriodo(basePeriodo());
  const futuro = analisarPeriodo(basePeriodo({ id: 'p2', fim_aquisitivo: '2025-02-01' }));
  const bloqueado = analisarPeriodo(basePeriodo({ id: 'p3', fim_aquisitivo: null }));

  assert.deepEqual(anterior.acoesPermitidas, [
    ACOES_TRANSICAO_DESIGNACAO.MANTER,
    ACOES_TRANSICAO_DESIGNACAO.MARCAR_LEGADO_ATIVA,
    ACOES_TRANSICAO_DESIGNACAO.MARCAR_INDENIZADO,
    ACOES_TRANSICAO_DESIGNACAO.EXCLUIR_CADEIA_OPERACIONAL,
  ]);
  assert.ok(futuro.acoesPermitidas.includes(ACOES_TRANSICAO_DESIGNACAO.CANCELAR_PERIODO_FUTURO_INDEVIDO));
  assert.deepEqual(bloqueado.acoesPermitidas, [ACOES_TRANSICAO_DESIGNACAO.MANTER]);
});

test('hash muda quando período muda', () => {
  const hashA = calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase: '2025-01-01', periodos: [basePeriodo()] });
  const hashB = calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase: '2025-01-01', periodos: [basePeriodo({ dias_saldo: 1 })] });
  assert.notEqual(hashA, hashB);
});

test('hash muda quando férias vinculadas mudam', () => {
  const periodo = basePeriodo({ id: 'p-ferias' });
  const hashA = calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase: '2025-01-01', periodos: [periodo], ferias: [{ id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p-ferias', status: 'Gozada' }] });
  const hashB = calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase: '2025-01-01', periodos: [periodo], ferias: [{ id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p-ferias', status: 'Autorizada' }] });
  assert.notEqual(hashA, hashB);
});

test('hash é estável para mesma entrada em ordem diferente', () => {
  const periodoA = basePeriodo({ id: 'p-a', periodo_aquisitivo_ref: '2023/2023', fim_aquisitivo: '2023-12-31' });
  const periodoB = basePeriodo({ id: 'p-b', periodo_aquisitivo_ref: '2024/2024', fim_aquisitivo: '2024-12-31' });
  const feriasA = { id: 'f-a', militar_id: 'm1', periodo_aquisitivo_id: 'p-a', status: 'Gozada' };
  const feriasB = { id: 'f-b', militar_id: 'm1', periodo_aquisitivo_id: 'p-b', status: 'Gozada' };
  const hashA = calcularPreviewHashTransicaoDesignacao({ militar, contrato, dataBase: '2025-01-01', periodos: [periodoA, periodoB], ferias: [feriasA, feriasB] });
  const hashB = calcularPreviewHashTransicaoDesignacao({ contrato, militar, ferias: [feriasB, feriasA], periodos: [periodoB, periodoA], dataBase: '2025-01-01' });
  assert.equal(hashA, hashB);
});

test('retorno possui shape completo', () => {
  const result = analisarTransicaoDesignacaoManual({ militar, contrato, periodos: [basePeriodo()], ferias: [], dataBase: '2025-01-01' });
  assert.ok(Array.isArray(result.periodos));
  assert.ok(Array.isArray(result.riscos));
  assert.ok(Array.isArray(result.alertas));
  assert.ok(Array.isArray(result.conflitos));
  assert.ok(Array.isArray(result.bloqueantes));
  assert.equal(typeof result.totais, 'object');
  assert.equal(typeof result.previewHash, 'string');

  const periodo = result.periodos[0];
  assert.deepEqual(Object.keys(periodo).sort(), [
    'acaoSugerida',
    'acoesPermitidas',
    'alertas',
    'bloqueantes',
    'conflitos',
    'exigeDocumento',
    'exigeMotivo',
    'feriasVinculadas',
    'motivosSugestao',
    'overridePermitido',
    'periodo',
    'periodoId',
    'riscos',
    'situacaoAtual',
  ].sort());
});
