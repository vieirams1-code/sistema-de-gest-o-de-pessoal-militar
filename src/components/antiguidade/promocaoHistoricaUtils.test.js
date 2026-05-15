import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PROMOCAO_COLETIVA_TIPO_HISTORICO,
  PROMOCAO_COLETIVA_TIPO_PREVISTO,
  prepararRegistroPromocaoColetiva,
  resolverCopiaOrdemPromocaoAnterior,
  resolverQuadroAnteriorPromocao,
  selecionarCandidatosPromocaoColetiva,
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
  tipo_lancamento: PROMOCAO_COLETIVA_TIPO_PREVISTO,
  posto_graduacao_anterior: 'Subtenente',
  posto_graduacao_novo: '2º Tenente',
  quadro_novo: 'QAOBM',
  data_promocao: '2026-05-01',
  data_publicacao: '2026-05-02',
  boletim_referencia: 'BG 1',
  ato_referencia: 'Ato 1',
  observacoes: 'Prevista em lote',
};

const formHistorico = {
  ...formColetiva,
  tipo_lancamento: PROMOCAO_COLETIVA_TIPO_HISTORICO,
  data_promocao: '2024-05-01',
  observacoes: 'Histórica em lote',
};

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

test('tipo previsto cria status_registro previsto com origem coletiva', () => {
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

test('tipo histórico cria status_registro ativo com origem coletiva', () => {
  const registro = prepararRegistroPromocaoColetiva({
    militar: militarAtivo,
    form: formHistorico,
    historicos: [],
    ordem: '',
  });

  assert.equal(registro.status_registro, 'ativo');
  assert.equal(registro.origem_dado, 'coletiva');
  assert.equal(registro.antiguidade_referencia_ordem, null);
  assert.equal(registro.antiguidade_referencia_id, '');
});

test('histórico não chama Militar.update nem altera Prévia Geral', () => {
  const page = fs.readFileSync(new URL('../../pages/AntiguidadeImportarPromocoes.jsx', import.meta.url), 'utf8');
  assert.equal(page.includes('base44.entities.Militar.update'), false);
  assert.equal(page.includes('calcularPreviaAntiguidadeGeral'), false);
});

test('histórico bloqueia ativo existente mesmo com data diferente', () => {
  const validacao = validarLinhaPromocaoColetiva({
    militar: militarAtivo,
    form: formHistorico,
    historicos: [{
      militar_id: militarAtivo.id,
      status_registro: 'ativo',
      posto_graduacao_novo: formHistorico.posto_graduacao_novo,
      quadro_novo: formHistorico.quadro_novo,
      data_promocao: '2024-04-01',
    }],
  });

  assert.equal(validacao.apto, false);
  assert.ok(validacao.bloqueios.some((bloqueio) => bloqueio.includes('mesmo com data diferente')));
});

test('histórico permite militar atual em posto superior ao posto novo histórico', () => {
  const militarSuperior = {
    ...militarAtivo,
    id: 'mil-superior',
    posto_graduacao: '1º Sargento',
    quadro: 'QPTBM',
  };
  const formHistoricoPraca = {
    ...formHistorico,
    posto_graduacao_anterior: '3º Sargento',
    posto_graduacao_novo: '2º Sargento',
    quadro_novo: 'QPTBM',
  };

  const candidatos = selecionarCandidatosPromocaoColetiva({
    militares: [militarSuperior],
    postoOrigem: formHistoricoPraca.posto_graduacao_anterior,
    tipoLancamento: PROMOCAO_COLETIVA_TIPO_HISTORICO,
  });
  const validacao = validarLinhaPromocaoColetiva({
    militar: militarSuperior,
    form: formHistoricoPraca,
    historicos: [],
  });

  assert.deepEqual(candidatos.map((militar) => militar.id), [militarSuperior.id]);
  assert.equal(validacao.apto, true);
  assert.ok(validacao.alertas.some((alerta) => alerta.includes('posto superior')));
});

test('QBMPT continua bloqueado em campos informados', () => {
  const validacao = validarLinhaPromocaoColetiva({
    militar: { ...militarAtivo, quadro: 'QBMPT' },
    form: { ...formHistorico, quadro_novo: 'QBMPT' },
    historicos: [],
  });

  assert.equal(validacao.apto, false);
  assert.ok(validacao.bloqueios.some((bloqueio) => bloqueio.includes('QBMPT')));
});

test('QAOBM não grava QAOBM como quadro_anterior', () => {
  const registro = prepararRegistroPromocaoColetiva({
    militar: { ...militarAtivo, quadro: 'QAOBM' },
    form: formHistorico,
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


test('copia ordem anterior segura para promoção coletiva histórica de 3º para 2º Sargento', () => {
  const militar = { ...militarAtivo, id: 'sgt-1', posto_graduacao: '1º Sargento', quadro: 'QPTBM' };
  const form = {
    ...formHistorico,
    posto_graduacao_anterior: '3º Sargento',
    posto_graduacao_novo: '2º Sargento',
    quadro_novo: 'QPTBM',
    data_promocao: '2020-01-01',
  };

  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar,
    form,
    historicos: [{
      militar_id: militar.id,
      status_registro: 'ativo',
      posto_graduacao_novo: '3º Sargento',
      quadro_novo: 'QPTBM',
      data_promocao: '2018-01-01',
      antiguidade_referencia_ordem: 1,
    }],
  });

  assert.equal(copia.ordem, 1);
  assert.equal(copia.alerta, '');
});

test('copia ordem anterior segura para promoção coletiva histórica de 2º para 1º Sargento', () => {
  const militar = { ...militarAtivo, id: 'sgt-2', posto_graduacao: '1º Sargento', quadro: 'QPTBM' };
  const form = {
    ...formHistorico,
    posto_graduacao_anterior: '2º Sargento',
    posto_graduacao_novo: '1º Sargento',
    quadro_novo: 'QPTBM',
    data_promocao: '2022-01-01',
  };

  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar,
    form,
    historicos: [
      {
        militar_id: militar.id,
        status_registro: 'ativo',
        posto_graduacao_novo: '3º Sargento',
        quadro_novo: 'QPTBM',
        data_promocao: '2018-01-01',
        antiguidade_referencia_ordem: 9,
      },
      {
        militar_id: militar.id,
        status_registro: 'ativo',
        posto_graduacao_novo: '2º Sargento',
        quadro_novo: 'QPTBM',
        data_promocao: '2020-01-01',
        antiguidade_referencia_ordem: 3,
      },
    ],
  });

  assert.equal(copia.ordem, 3);
  assert.equal(copia.alerta, '');
});

test('não copia ordem para QAOBM ambíguo', () => {
  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar: militarAtivo,
    form: formHistorico,
    historicos: [{
      militar_id: militarAtivo.id,
      status_registro: 'ativo',
      posto_graduacao_novo: 'Subtenente',
      quadro_novo: 'QPTBM',
      data_promocao: '2020-01-01',
      antiguidade_referencia_ordem: 2,
    }],
  });

  assert.equal(copia.ordem, '');
  assert.equal(copia.alerta, 'Ordem anterior não pôde ser copiada');
  assert.equal(copia.motivo, 'qaobm_ambiguo');
});

test('não copia ordem quando não há ordem anterior válida', () => {
  const militar = { ...militarAtivo, id: 'sem-ordem', posto_graduacao: '2º Sargento', quadro: 'QPTBM' };
  const form = {
    ...formHistorico,
    posto_graduacao_anterior: '3º Sargento',
    posto_graduacao_novo: '2º Sargento',
    quadro_novo: 'QPTBM',
    data_promocao: '2020-01-01',
  };

  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar,
    form,
    historicos: [{
      militar_id: militar.id,
      status_registro: 'ativo',
      posto_graduacao_novo: '3º Sargento',
      quadro_novo: 'QPTBM',
      data_promocao: '2018-01-01',
      antiguidade_referencia_ordem: 0,
    }],
  });

  assert.equal(copia.ordem, '');
  assert.equal(copia.alerta, 'Ordem anterior não pôde ser copiada');
  assert.equal(copia.motivo, 'sem_ordem_anterior');
});

test('não copia ordem quando há múltiplos candidatos anteriores na mesma data', () => {
  const militar = { ...militarAtivo, id: 'duplicado', posto_graduacao: '2º Sargento', quadro: 'QPTBM' };
  const form = {
    ...formHistorico,
    posto_graduacao_anterior: '3º Sargento',
    posto_graduacao_novo: '2º Sargento',
    quadro_novo: 'QPTBM',
    data_promocao: '2020-01-01',
  };

  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar,
    form,
    historicos: [1, 2].map((ordem) => ({
      militar_id: militar.id,
      status_registro: 'ativo',
      posto_graduacao_novo: '3º Sargento',
      quadro_novo: 'QPTBM',
      data_promocao: '2018-01-01',
      antiguidade_referencia_ordem: ordem,
    })),
  });

  assert.equal(copia.ordem, '');
  assert.equal(copia.alerta, 'Ordem anterior não pôde ser copiada');
  assert.equal(copia.motivo, 'multiplos_candidatos');
});

test('não copia ordem quando há mudança real de quadro', () => {
  const militar = { ...militarAtivo, id: 'mudanca-quadro', posto_graduacao: '2º Sargento', quadro: 'QBMP-1.a' };
  const form = {
    ...formHistorico,
    posto_graduacao_anterior: '3º Sargento',
    posto_graduacao_novo: '2º Sargento',
    quadro_novo: 'QBMP-1.a',
    data_promocao: '2020-01-01',
  };

  const copia = resolverCopiaOrdemPromocaoAnterior({
    militar,
    form,
    historicos: [{
      militar_id: militar.id,
      status_registro: 'ativo',
      posto_graduacao_novo: '3º Sargento',
      quadro_novo: 'QPTBM',
      data_promocao: '2018-01-01',
      antiguidade_referencia_ordem: 4,
    }],
  });

  assert.equal(copia.ordem, '');
  assert.equal(copia.alerta, 'Ordem anterior não pôde ser copiada');
  assert.equal(copia.motivo, 'mudanca_real_quadro');
});
