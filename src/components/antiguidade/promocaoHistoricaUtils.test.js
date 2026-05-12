import test from 'node:test';
import assert from 'node:assert/strict';

import { resolverQuadroAnteriorPromocao } from './promocaoHistoricaUtils.js';

test('mantém QPTBM como quadro de praça histórico confiável para Subtenente → QAOBM', () => {
  const quadroAnterior = resolverQuadroAnteriorPromocao({
    postoAnterior: 'Subtenente',
    postoNovo: '2º Tenente',
    quadroNovo: 'QAOBM',
    dataPromocao: '2026-04-21',
    registrosHistoricos: [
      {
        status_registro: 'ativo',
        posto_graduacao_novo: 'Subtenente',
        quadro_novo: 'QPTBM',
        data_promocao: '2025-04-21',
      },
    ],
  });

  assert.equal(quadroAnterior, 'QPTBM');
});

test('não preserva QBMPT como quadro histórico confiável para Subtenente → QAOBM', () => {
  const quadroAnterior = resolverQuadroAnteriorPromocao({
    postoAnterior: 'Subtenente',
    postoNovo: '2º Tenente',
    quadroNovo: 'QAOBM',
    dataPromocao: '2026-04-21',
    registrosHistoricos: [
      {
        status_registro: 'ativo',
        posto_graduacao_novo: 'Subtenente',
        quadro_novo: 'QBMPT',
        data_promocao: '2025-04-21',
      },
      {
        status_registro: 'ativo',
        posto_graduacao_anterior: 'Subtenente',
        quadro_anterior: 'QBMPT',
        data_promocao: '2025-04-22',
      },
    ],
  });

  assert.equal(quadroAnterior, '');
});
