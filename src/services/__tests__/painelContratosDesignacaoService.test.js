import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aplicarFiltrosPainelContratos,
  calcularDiasParaVencimento,
  calcularSituacaoDerivadaContrato,
  classificarVencimentoContrato,
  FILTRO_LEGADO,
  FILTRO_VENCIMENTO,
  mapearLegadoPorContrato,
  SITUACAO_CONTRATO_DESIGNACAO,
} from '../painelContratosDesignacaoService.js';

const hoje = new Date('2026-05-11T00:00:00Z');

test('classifica ativo normal, vencido, vencendo 30, 60, 90 e sem data fim', () => {
  assert.equal(calcularSituacaoDerivadaContrato({ status_contrato: 'ativo', data_fim_contrato: '2026-09-01' }, hoje), SITUACAO_CONTRATO_DESIGNACAO.ATIVO);
  assert.equal(calcularSituacaoDerivadaContrato({ status_contrato: 'ativo', data_fim_contrato: '2026-05-10' }, hoje), SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCIDO);
  assert.equal(classificarVencimentoContrato({ status_contrato: 'ativo', data_fim_contrato: '2026-05-25' }, hoje), FILTRO_VENCIMENTO.ATE_30);
  assert.equal(classificarVencimentoContrato({ status_contrato: 'ativo', data_fim_contrato: '2026-06-25' }, hoje), FILTRO_VENCIMENTO.DE_31_A_60);
  assert.equal(classificarVencimentoContrato({ status_contrato: 'ativo', data_fim_contrato: '2026-08-01' }, hoje), FILTRO_VENCIMENTO.DE_61_A_90);
  assert.equal(calcularSituacaoDerivadaContrato({ status_contrato: 'ativo' }, hoje), SITUACAO_CONTRATO_DESIGNACAO.SEM_DATA_FIM);
});

test('classifica encerrado, cancelado e dias para vencimento', () => {
  assert.equal(calcularSituacaoDerivadaContrato({ status_contrato: 'encerrado' }, hoje), SITUACAO_CONTRATO_DESIGNACAO.ENCERRADO);
  assert.equal(calcularSituacaoDerivadaContrato({ status_contrato: 'cancelado' }, hoje), SITUACAO_CONTRATO_DESIGNACAO.CANCELADO);
  assert.equal(calcularDiasParaVencimento({ data_fim_contrato: '2026-05-21' }, hoje), 10);
});

test('mapeia legado aplicado por contrato e filtra pendentes/aplicados', () => {
  const legado = mapearLegadoPorContrato([
    { legado_ativa: true, legado_ativa_contrato_designacao_id: 'c1', legado_ativa_em: '2026-01-01T00:00:00Z' },
    { legado_ativa: true, legado_ativa_contrato_designacao_id: 'c1', legado_ativa_em: '2026-02-01T00:00:00Z' },
  ]);
  assert.equal(legado.c1.aplicado, true);
  assert.equal(legado.c1.totalPeriodos, 2);
  assert.equal(legado.c1.ultimaAplicacaoEm, '2026-02-01T00:00:00Z');

  const contratos = [{ id: 'c1', status_contrato: 'ativo' }, { id: 'c2', status_contrato: 'ativo' }];
  assert.deepEqual(aplicarFiltrosPainelContratos(contratos, { legadoAtivaPorContrato: legado, legado: FILTRO_LEGADO.APLICADO }).map((c) => c.id), ['c1']);
  assert.deepEqual(aplicarFiltrosPainelContratos(contratos, { legadoAtivaPorContrato: legado, legado: FILTRO_LEGADO.PENDENTE }).map((c) => c.id), ['c2']);
});

test('filtra busca por nome, matrícula, contrato e boletim/publicação', () => {
  const contratos = [{ id: 'c1', militar_id: 'm1', matricula_designacao: 'D-777', numero_contrato: 'CT-9', boletim_publicacao: 'BG-12' }];
  const ctx = { militaresPorId: { m1: { id: 'm1', nome_completo: 'João da Silva', matricula: '12345' } }, matriculasMilitar: [{ militar_id: 'm1', matricula: '999' }] };
  assert.equal(aplicarFiltrosPainelContratos(contratos, { ...ctx, busca: 'joao' }).length, 1);
  assert.equal(aplicarFiltrosPainelContratos(contratos, { ...ctx, busca: '999' }).length, 1);
  assert.equal(aplicarFiltrosPainelContratos(contratos, { ...ctx, busca: 'ct-9' }).length, 1);
  assert.equal(aplicarFiltrosPainelContratos(contratos, { ...ctx, busca: 'bg-12' }).length, 1);
});
