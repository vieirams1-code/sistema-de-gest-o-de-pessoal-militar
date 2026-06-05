import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __resetComportamentoRPServiceForTests,
  __setComportamentoRPServiceClientForTests,
  __setComportamentoRPServiceDepsForTests,
  gerarPublicacaoRPAutomaticaPorHistoricoComportamento,
} from '../comportamentoRPService.js';

function createEntity(initial = []) {
  const rows = [...initial];
  return {
    async filter(criteria = {}) {
      return rows.filter((row) =>
        Object.entries(criteria).every(([chave, valor]) => row[chave] === valor)
      );
    },
    async create(payload) {
      const newRow = { id: `id-${Math.random()}`, ...payload };
      rows.push(newRow);
      return newRow;
    },
    _rows: rows,
  };
}

test('gera publicação com sucesso', async () => {
  const entities = {
    PublicacaoExOfficio: createEntity([]),
    TemplateTexto: createEntity([
      { id: 't1', ativo: true, template: 'Template {militar_nome}', tipo_registro: 'COMPORTAMENTO_OTIMO' },
    ]),
    MatriculaMilitar: createEntity([]),
  };

  __resetComportamentoRPServiceForTests();
  __setComportamentoRPServiceClientForTests({ entities });
  __setComportamentoRPServiceDepsForTests({
    criarEscopado: async (entity, payload) => entities[entity].create(payload),
  });

  const militar = { id: 'm1', nome_completo: 'Militar Teste', matricula: '123', posto_graduacao: 'Soldado' };
  const marco = {
    id: 'h1',
    comportamento_anterior: 'Bom',
    comportamento_novo: 'Ótimo',
    data_alteracao: '2025-01-01',
    motivo_mudanca: 'Motivo teste',
    fundamento_legal: 'Artigo teste',
  };

  const resultado = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
    militar,
    marco,
  });

  assert.strictEqual(resultado.ok, true);
  assert.strictEqual(resultado.publicado, true);
  assert.strictEqual(resultado.etapa, 'create');
  assert.ok(resultado.publicacao.id);
});

test('falha se campos obrigatórios ausentes', async () => {
  __resetComportamentoRPServiceForTests();
  const resultado = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
    militar: null,
    marco: null,
  });

  assert.strictEqual(resultado.ok, false);
  assert.strictEqual(resultado.etapa, 'validacao');
  assert.ok(resultado.motivo.includes('Campos obrigatórios ausentes'));
});

test('ignora se não houver mudança real de comportamento', async () => {
  __resetComportamentoRPServiceForTests();
  const militar = { id: 'm1' };
  const marco = {
    id: 'h1',
    comportamento_anterior: 'Ótimo',
    comportamento_novo: 'Ótimo',
  };

  const resultado = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
    militar,
    marco,
  });

  assert.strictEqual(resultado.ok, true);
  assert.strictEqual(resultado.publicado, false);
  assert.strictEqual(resultado.motivo, 'sem_mudanca_real');
});

test('detecta publicação já existente', async () => {
  const entities = {
    PublicacaoExOfficio: createEntity([
      { id: 'p1', historico_comportamento_id: 'h1' }
    ]),
  };

  __resetComportamentoRPServiceForTests();
  __setComportamentoRPServiceClientForTests({ entities });

  const militar = { id: 'm1' };
  const marco = {
    id: 'h1',
    comportamento_anterior: 'Bom',
    comportamento_novo: 'Ótimo',
    data_alteracao: '2025-01-01',
    motivo_mudanca: 'Motivo teste',
    fundamento_legal: 'Artigo teste',
  };

  const resultado = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
    militar,
    marco,
  });

  assert.strictEqual(resultado.ok, true);
  assert.strictEqual(resultado.publicado, false);
  assert.strictEqual(resultado.motivo, 'publicacao_ja_existente');
});
