import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contarContratosAtivosDesignacao,
  getContratoAtivoDesignacao,
  normalizarStatusContratoDesignacao,
  ordenarContratosDesignacao,
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
  assert.match(resultado.erros.join('\n'), /matricula_designacao/);
  assert.match(resultado.erros.join('\n'), /data_inicio_contrato/);
  assert.match(resultado.erros.join('\n'), /status_contrato/);
});

test('exige data_inclusao_para_ferias para ativo', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-01',
    status_contrato: 'ativo',
    numero_contrato: 'CT-1',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /data_inclusao_para_ferias/);
});

test('exige número de contrato ou boletim', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-01',
    status_contrato: 'ativo',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /numero_contrato ou boletim_publicacao/);
});

test('impede data fim anterior à data início', () => {
  const resultado = validarContratoDesignacaoPayload({
    militar_id: 'm1',
    matricula_designacao: '123',
    data_inicio_contrato: '2026-01-10',
    data_fim_contrato: '2026-01-01',
    data_inclusao_para_ferias: '2026-01-10',
    status_contrato: 'ativo',
    boletim_publicacao: 'BG 1',
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join('\n'), /data_fim_contrato/);
});
