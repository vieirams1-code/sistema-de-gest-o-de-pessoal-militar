import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __resetComportamentoServiceForTests,
  __setComportamentoServiceClientForTests,
  __setComportamentoServiceDepsForTests,
  aplicarPendenciasComportamentoEmLote,
} from '../comportamentoService.js';

function createEntity(initial = []) {
  const rows = [...initial];
  return {
    async filter(criteria = {}) {
      return rows.filter((row) => Object.entries(criteria).every(([chave, valor]) => row[chave] === valor));
    },
    async update(id, payload) {
      const idx = rows.findIndex((row) => row.id === id);
      if (idx < 0) throw new Error(`registro_nao_encontrado:${id}`);
      rows[idx] = { ...rows[idx], ...payload };
      return rows[idx];
    },
    async create(payload) {
      rows.push(payload);
      return payload;
    },
    _rows: rows,
  };
}

function stubDeps() {
  return {
    async garantirImplantacaoHistoricoComportamento() {
      return { id: 'implantacao' };
    },
    async registrarMarcoHistoricoComportamento() {
      return { id: 'marco-1', comportamento_novo: 'Ótimo' };
    },
    async obterHistoricoComportamentoMilitar() {
      return [{ id: 'marco-1', comportamento_novo: 'Ótimo' }];
    },
    async gerarPublicacaoRPAutomaticaPorHistoricoComportamento() {
      return { ok: true };
    },
  };
}

test('aplica pendência válida em lote', async () => {
  const entities = {
    Militar: createEntity([{ id: 'm1', nome_completo: 'Militar 1', comportamento: 'Bom' }]),
    PendenciaComportamento: createEntity([
      {
        id: 'p1',
        militar_id: 'm1',
        militar_nome: 'Militar 1',
        comportamento_sugerido: 'Ótimo',
        status_pendencia: 'Pendente',
        fundamento_legal: 'Decreto X',
      },
    ]),
  };

  __resetComportamentoServiceForTests();
  __setComportamentoServiceClientForTests({ entities });
  __setComportamentoServiceDepsForTests(stubDeps());

  const resultado = await aplicarPendenciasComportamentoEmLote({
    pendencias: ['p1'],
    usuarioAtual: { canAccessAction: (acao) => acao === 'aprovar_mudanca_comportamento' },
  });

  assert.equal(resultado.totalAplicadas, 1);
  assert.equal(resultado.totalFalhas, 0);

  const [militar] = await entities.Militar.filter({ id: 'm1' });
  assert.equal(militar.comportamento, 'Ótimo');

  const [pendencia] = await entities.PendenciaComportamento.filter({ id: 'p1' });
  assert.equal(pendencia.status_pendencia, 'Aplicada');
});

test('ignora pendência já aplicada', async () => {
  const entities = {
    Militar: createEntity([{ id: 'm2', nome_completo: 'Militar 2', comportamento: 'Bom' }]),
    PendenciaComportamento: createEntity([
      { id: 'p2', militar_id: 'm2', militar_nome: 'Militar 2', comportamento_sugerido: 'Ótimo', status_pendencia: 'Aplicada' },
    ]),
  };

  __resetComportamentoServiceForTests();
  __setComportamentoServiceClientForTests({ entities });
  __setComportamentoServiceDepsForTests(stubDeps());

  const resultado = await aplicarPendenciasComportamentoEmLote({
    pendencias: ['p2'],
    usuarioAtual: { canAccessAction: () => true },
  });

  assert.equal(resultado.totalIgnoradas, 1);
  assert.equal(resultado.ignoradas[0].motivo, 'pendencia_nao_pendente');
});

test('falha pendência sem militar_id', async () => {
  const entities = {
    Militar: createEntity([]),
    PendenciaComportamento: createEntity([
      { id: 'p3', militar_nome: 'Sem Militar', comportamento_sugerido: 'Ótimo', status_pendencia: 'Pendente' },
    ]),
  };

  __resetComportamentoServiceForTests();
  __setComportamentoServiceClientForTests({ entities });
  __setComportamentoServiceDepsForTests(stubDeps());

  const resultado = await aplicarPendenciasComportamentoEmLote({
    pendencias: ['p3'],
    usuarioAtual: { canAccessAction: () => true },
  });

  assert.equal(resultado.totalFalhas, 1);
  assert.equal(resultado.falhas[0].motivo, 'militar_id_ausente');
});

test('retorna relatório parcial com aplicadas e falhas', async () => {
  const entities = {
    Militar: createEntity([{ id: 'm4', nome_completo: 'Militar 4', comportamento: 'Bom' }]),
    PendenciaComportamento: createEntity([
      { id: 'p4-ok', militar_id: 'm4', militar_nome: 'Militar 4', comportamento_sugerido: 'Ótimo', status_pendencia: 'Pendente' },
      { id: 'p4-fail', militar_id: 'm4', militar_nome: 'Militar 4', comportamento_sugerido: 'Ótimo', status_pendencia: 'Pendente' },
    ]),
  };

  const deps = stubDeps();
  deps.registrarMarcoHistoricoComportamento = async ({ origemId }) => {
    if (origemId === 'p4-fail') throw new Error('falha_forcada');
    return { id: 'marco-ok', comportamento_novo: 'Ótimo' };
  };

  __resetComportamentoServiceForTests();
  __setComportamentoServiceClientForTests({ entities });
  __setComportamentoServiceDepsForTests(deps);

  const resultado = await aplicarPendenciasComportamentoEmLote({
    pendencias: ['p4-ok', 'p4-fail'],
    usuarioAtual: { canAccessAction: () => true },
    options: { permitirComportamentoIgual: true },
  });

  assert.equal(resultado.totalRecebidas, 2);
  assert.equal(resultado.totalAplicadas, 1);
  assert.equal(resultado.totalFalhas, 1);
});

test('não aplica sem comportamento_sugerido', async () => {
  const entities = {
    Militar: createEntity([{ id: 'm5', nome_completo: 'Militar 5', comportamento: 'Bom' }]),
    PendenciaComportamento: createEntity([
      { id: 'p5', militar_id: 'm5', militar_nome: 'Militar 5', comportamento_sugerido: '', status_pendencia: 'Pendente' },
    ]),
  };

  __resetComportamentoServiceForTests();
  __setComportamentoServiceClientForTests({ entities });
  __setComportamentoServiceDepsForTests(stubDeps());

  const resultado = await aplicarPendenciasComportamentoEmLote({
    pendencias: ['p5'],
    usuarioAtual: { canAccessAction: () => true },
  });

  assert.equal(resultado.totalAplicadas, 0);
  assert.equal(resultado.totalFalhas, 1);
  assert.equal(resultado.falhas[0].motivo, 'comportamento_sugerido_ausente');
});
