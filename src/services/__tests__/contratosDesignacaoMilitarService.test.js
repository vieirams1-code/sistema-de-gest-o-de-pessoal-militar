import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contarContratosAtivosDesignacao,
  getContratoAtivoDesignacao,
  normalizarGeraDireitoFerias,
  normalizarRegraGeracaoPeriodos,
  normalizarStatusContratoDesignacao,
  normalizarTipoPrazoContrato,
  ordenarContratosDesignacao,
  resolverConfiguracaoFeriasContrato,
  validarContratoDesignacaoPayload,
} from '../contratosDesignacaoMilitarService.js';

test('normaliza status ativo, encerrado e cancelado', () => {
  assert.equal(normalizarStatusContratoDesignacao('Ativo'), 'ativo');
  assert.equal(normalizarStatusContratoDesignacao('ENCERRADA'), 'encerrado');
  assert.equal(normalizarStatusContratoDesignacao('Cancelada'), 'cancelado');
});

test('identifica contrato ativo mais recente e conta múltiplos ativos', () => {
  const contratos = [
    { id: '1', status_contrato: 'encerrado', data_inicio_contrato: '2024-01-01' },
    { id: '2', status_contrato: 'ativo', data_inicio_contrato: '2025-01-01' },
    { id: '3', status_contrato: 'ativo', data_inicio_contrato: '2026-01-01' },
  ];

  assert.equal(getContratoAtivoDesignacao(contratos).id, '3');
  assert.equal(contarContratosAtivosDesignacao(contratos), 2);
});

test('ordena por data_inicio_contrato desc', () => {
  const ordenados = ordenarContratosDesignacao([
    { id: 'antigo', data_inicio_contrato: '2023-01-01' },
    { id: 'novo', data_inicio_contrato: '2026-01-01' },
    { id: 'meio', data_inicio_contrato: '2024-01-01' },
  ]);

  assert.deepEqual(ordenados.map((item) => item.id), ['novo', 'meio', 'antigo']);
});

test('valida obrigatórios de criação', () => {
  const resultado = validarContratoDesignacaoPayload({});
  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /militar_id/);
  assert.doesNotMatch(resultado.erros.join('\n'), /matricula_militar_id/);
  assert.match(resultado.erros.join('\n'), /matricula_designacao/);
  assert.match(resultado.erros.join('\n'), /data_inicio_contrato/);
  assert.match(resultado.erros.join('\n'), /data_inclusao_para_ferias/);
  assert.match(resultado.erros.join('\n'), /tipo_prazo_contrato/);
  assert.match(resultado.erros.join('\n'), /gera_direito_ferias/);
  assert.match(resultado.erros.join('\n'), /regra_geracao_periodos/);
});

test('aceita contrato sem matricula_militar_id e com matrícula textual da ficha', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_designacao: '031.975-023',
    data_inicio_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-01',
    tipo_prazo_contrato: 'indeterminado',
    gera_direito_ferias: true,
    regra_geracao_periodos: 'normal',
  });

  assert.equal(resultado.valido, true);
});

test('rejeita matricula_militar_id contaminado', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_militar_id: 'mat-1:123',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-01',
    tipo_prazo_contrato: 'indeterminado',
    gera_direito_ferias: true,
    regra_geracao_periodos: 'normal',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /id:matricula/);
});

test('impede data fim anterior à data início', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_militar_id: 'mat-1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-10',
    data_fim_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-10',
    status_contrato: 'ativo',
    tipo_prazo_contrato: 'indeterminado',
    gera_direito_ferias: true,
    regra_geracao_periodos: 'normal',
    boletim_publicacao: 'BG 1',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /data_fim_contrato/);
});


test('contrato sem campos novos mantém compatibilidade de férias padrão', () => {
  assert.deepEqual(resolverConfiguracaoFeriasContrato({ id: 'legado-1' }), {
    tipoPrazoContrato: 'indeterminado',
    geraDireitoFerias: true,
    regraGeracaoPeriodos: 'normal',
    motivoNaoGeraFerias: '',
    isContratoLegadoSemCamposNovos: true,
  });
});

test('normaliza tipo_prazo_contrato determinado', () => {
  assert.equal(normalizarTipoPrazoContrato('determinado'), 'determinado');
  assert.equal(resolverConfiguracaoFeriasContrato({ tipo_prazo_contrato: 'determinado' }).tipoPrazoContrato, 'determinado');
});

test('normaliza gera_direito_ferias false', () => {
  assert.equal(normalizarGeraDireitoFerias(false), false);
  assert.equal(normalizarGeraDireitoFerias('false'), false);
  assert.equal(resolverConfiguracaoFeriasContrato({ gera_direito_ferias: false }).geraDireitoFerias, false);
});

test('normaliza regra_geracao_periodos bloqueada', () => {
  assert.equal(normalizarRegraGeracaoPeriodos('bloqueada'), 'bloqueada');
  assert.equal(resolverConfiguracaoFeriasContrato({ regra_geracao_periodos: 'bloqueada' }).regraGeracaoPeriodos, 'bloqueada');
});

test('normaliza regra_geracao_periodos manual', () => {
  assert.equal(normalizarRegraGeracaoPeriodos('manual'), 'manual');
  assert.equal(resolverConfiguracaoFeriasContrato({ regra_geracao_periodos: 'manual' }).regraGeracaoPeriodos, 'manual');
});

test('valores inválidos caem em defaults seguros', () => {
  const config = resolverConfiguracaoFeriasContrato({
    tipo_prazo_contrato: 'temporario',
    gera_direito_ferias: 'talvez',
    regra_geracao_periodos: 'automatica',
  });

  assert.equal(config.tipoPrazoContrato, 'indeterminado');
  assert.equal(config.geraDireitoFerias, true);
  assert.equal(config.regraGeracaoPeriodos, 'normal');
});

test('preserva motivo_nao_gera_ferias', () => {
  const config = resolverConfiguracaoFeriasContrato({
    gera_direito_ferias: false,
    motivo_nao_gera_ferias: 'Contrato sem previsão normativa de férias.',
  });

  assert.equal(config.motivoNaoGeraFerias, 'Contrato sem previsão normativa de férias.');
});

test('detecta contrato legado apenas quando todos os campos novos estão ausentes', () => {
  assert.equal(resolverConfiguracaoFeriasContrato({}).isContratoLegadoSemCamposNovos, true);
  assert.equal(resolverConfiguracaoFeriasContrato({ tipo_prazo_contrato: '' }).isContratoLegadoSemCamposNovos, false);
  assert.equal(resolverConfiguracaoFeriasContrato({ gera_direito_ferias: undefined }).isContratoLegadoSemCamposNovos, false);
  assert.equal(resolverConfiguracaoFeriasContrato({ regra_geracao_periodos: '' }).isContratoLegadoSemCamposNovos, false);
});

test('aplica regras automáticas para contrato indeterminado', () => {
  const payload = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_militar_id: 'mat-1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-01',
    status_contrato: 'ativo',
    numero_contrato: 'CT-1',
    tipo_prazo_contrato: 'indeterminado',
    gera_direito_ferias: true,
    regra_geracao_periodos: 'normal',
  });

  assert.equal(payload.valido, true);
});

test('valida regras de férias para contrato determinado', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_militar_id: 'mat-1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-01',
    status_contrato: 'ativo',
    numero_contrato: 'CT-1',
    tipo_prazo_contrato: 'determinado',
    gera_direito_ferias: false,
    regra_geracao_periodos: 'normal',
  });

  assert.equal(resultado.valido, false);
  assert.doesNotMatch(resultado.erros.join('\n'), /data_fim_contrato é obrigatória/);
  assert.match(resultado.erros.join('\n'), /bloqueada ou manual/);
  assert.match(resultado.erros.join('\n'), /motivo_nao_gera_ferias/);
});
