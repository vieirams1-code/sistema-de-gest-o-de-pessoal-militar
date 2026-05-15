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

import fs from 'node:fs';

import {
  prepararRegistroPromocaoColetiva,
  validarLinhaPromocaoColetiva,
} from './promocaoHistoricaUtils.js';

const militarAtivo = {
  id: 'mil-1',
  status_cadastro: 'Ativo',
  posto_graduacao: 'Subtenente',
  quadro: 'QPTBM',
  nome_completo: 'Militar Teste',
};

const formColetiva = {
  posto_graduacao_anterior: 'Subtenente',
  posto_graduacao_novo: '2º Tenente',
  quadro_novo: 'QAOBM',
  data_promocao: '2026-05-01',
  data_publicacao: '2026-05-02',
  boletim_referencia: 'BG 1',
  ato_referencia: 'Ato 1',
  observacoes: 'Prevista em lote',
};

test('promoção coletiva prepara somente registro previsto com origem coletiva', () => {
  const registro = prepararRegistroPromocaoColetiva({
    militar: militarAtivo,
    form: formColetiva,
    historicos: [],
    ordem: '7',
  });

  assert.equal(registro.status_registro, 'previsto');
  assert.equal(registro.origem_dado, 'coletiva');
  assert.equal(registro.antiguidade_referencia_ordem, 7);
  assert.equal(registro.antiguidade_referencia_id, '');
});

test('promoção coletiva bloqueia QBMPT em campos informados', () => {
  const validacao = validarLinhaPromocaoColetiva({
    militar: { ...militarAtivo, quadro: 'QBMPT' },
    form: { ...formColetiva, quadro_novo: 'QBMPT' },
    historicos: [],
  });

  assert.equal(validacao.apto, false);
  assert.ok(validacao.bloqueios.some((bloqueio) => bloqueio.includes('QBMPT')));
});

test('promoção coletiva QAOBM não grava QAOBM como quadro_anterior', () => {
  const registro = prepararRegistroPromocaoColetiva({
    militar: { ...militarAtivo, quadro: 'QAOBM' },
    form: formColetiva,
    historicos: [],
  });

  assert.equal(registro.quadro_anterior, '');
});

test('promoção coletiva bloqueia duplicidade prevista e ativa igual', () => {
  const historicosBase = [{
    militar_id: militarAtivo.id,
    posto_graduacao_novo: formColetiva.posto_graduacao_novo,
    quadro_novo: formColetiva.quadro_novo,
    data_promocao: formColetiva.data_promocao,
  }];
  const prevista = validarLinhaPromocaoColetiva({
    militar: militarAtivo,
    form: formColetiva,
    historicos: [{ ...historicosBase[0], status_registro: 'previsto' }],
  });
  const ativa = validarLinhaPromocaoColetiva({
    militar: militarAtivo,
    form: formColetiva,
    historicos: [{ ...historicosBase[0], status_registro: 'ativo' }],
  });

  assert.equal(prevista.apto, false);
  assert.ok(prevista.bloqueios.some((bloqueio) => bloqueio.includes('previsto igual')));
  assert.equal(ativa.apto, false);
  assert.ok(ativa.bloqueios.some((bloqueio) => bloqueio.includes('ativo igual')));
});

test('promoção coletiva não chama Militar.update nem altera Prévia Geral', () => {
  const page = fs.readFileSync(new URL('../../pages/AntiguidadeImportarPromocoes.jsx', import.meta.url), 'utf8');
  assert.equal(page.includes('base44.entities.Militar.update'), false);
  assert.equal(page.includes('calcularPreviaAntiguidadeGeral'), false);
});
