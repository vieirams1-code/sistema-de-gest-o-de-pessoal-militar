import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setResetOperacionalClientForTests,
  __resetResetOperacionalClientForTests,
  executarLimpezaPrePublicacao,
  previewLimpezaPrePublicacao,
  resetOperacionalConstants,
} from '../resetOperacionalService.js';

function createEntity(initial = []) {
  const rows = [...initial];
  return {
    async list() {
      return [...rows];
    },
    async delete(id) {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
      return { id };
    },
    async create(payload) {
      const novo = { id: `log-${rows.length + 1}`, ...payload };
      rows.push(novo);
      return novo;
    },
    _rows: rows,
  };
}

function buildClient() {
  return {
    entities: {
      Militar: createEntity([{ id: 'm1' }, { id: 'm2' }]),
      MatriculaMilitar: createEntity([{ id: 'mat1', militar_id: 'm1' }]),
      Ferias: createEntity([{ id: 'f1', militar_id: 'm1' }, { id: 'f2', militar_id: 'ghost' }]),
      PeriodoAquisitivo: createEntity([{ id: 'p1', militar_id: 'm2' }]),
      CreditoExtraFerias: createEntity([{ id: 'c1', militar_id: 'm1' }]),
      RegistroLivro: createEntity([{ id: 'r1', militar_id: 'm1' }]),
      PublicacaoExOfficio: createEntity([{ id: 'pub1', militar_id: 'm2' }]),
      Atestado: createEntity([{ id: 'a1', militar_id: 'm1' }]),
      JISO: createEntity([{ id: 'j1', militar_id: 'm1', atestado_id: 'a1' }]),
      Medalha: createEntity([{ id: 'med1', militar_id: 'm2' }, { id: 'med2', militar_id: 'ghost' }]),
      ImpedimentoMedalha: createEntity([{ id: 'imp1', militar_id: 'm2' }]),
      PunicaoDisciplinar: createEntity([{ id: 'pd1', militar_id: 'm1' }]),
      PendenciaComportamento: createEntity([{ id: 'pc1', militar_id: 'm2' }]),
      MergeMilitarLog: createEntity([{ id: 'merge1' }]),
      PossivelDuplicidadeMilitar: createEntity([{ id: 'dup1' }]),
      ImportacaoAlteracoesLegado: createEntity([{ id: 'ial1' }]),
      ImportacaoMilitares: createEntity([{ id: 'im1' }]),
      Armamento: createEntity([{ id: 'arm1', militar_id: 'm1' }]),
      UsuarioAcesso: createEntity([{ id: 'u1' }]),
      PerfilPermissao: createEntity([{ id: 'pp1' }]),
      Subgrupamento: createEntity([{ id: 's1' }]),
      TemplateTexto: createEntity([{ id: 't1' }]),
      TipoPublicacaoCustom: createEntity([{ id: 'tp1' }]),
      Lotacao: createEntity([{ id: 'l1' }]),
      Funcao: createEntity([{ id: 'fn1' }]),
      ResetOperacionalLog: createEntity([]),
    },
  };
}

test('preview retorna contagens, órfãos e preservação estrutural', async () => {
  const client = buildClient();
  __setResetOperacionalClientForTests(client);

  const preview = await previewLimpezaPrePublicacao({ executadoPor: 'admin@sgp.mil' });

  assert.equal(preview.totalOperacional, 21);
  assert.equal(preview.totalOrfaos, 2);
  assert.ok(preview.preservar.includes('UsuarioAcesso'));
  assert.ok(preview.modulos.some((m) => m.chave === 'militares' && m.subtotal === 2));
  assert.equal(client.entities.ResetOperacionalLog._rows.length, 1);
  assert.equal(client.entities.ResetOperacionalLog._rows[0].tipo, 'preview');

  __resetResetOperacionalClientForTests();
});

test('execução remove dados operacionais, limpa órfãos e registra auditoria preservando estruturas', async () => {
  const client = buildClient();
  __setResetOperacionalClientForTests(client);

  const resultado = await executarLimpezaPrePublicacao({
    confirmacao: resetOperacionalConstants.CONFIRMACAO_FORTE,
    executadoPor: 'admin@sgp.mil',
  });

  assert.equal(resultado.modo, 'execucao');
  assert.ok(resultado.removidos >= 21);
  assert.equal(client.entities.Militar._rows.length, 0);
  assert.equal(client.entities.Ferias._rows.length, 0);
  assert.equal(client.entities.Medalha._rows.length, 0);

  assert.equal(client.entities.UsuarioAcesso._rows.length, 1);
  assert.equal(client.entities.PerfilPermissao._rows.length, 1);
  assert.equal(client.entities.Subgrupamento._rows.length, 1);
  assert.equal(client.entities.TemplateTexto._rows.length, 1);

  assert.equal(client.entities.ResetOperacionalLog._rows.length, 1);
  assert.equal(client.entities.ResetOperacionalLog._rows[0].tipo, 'execucao');

  __resetResetOperacionalClientForTests();
});

test('execução exige confirmação forte explícita', async () => {
  const client = buildClient();
  __setResetOperacionalClientForTests(client);

  await assert.rejects(
    () => executarLimpezaPrePublicacao({ confirmacao: 'ok' }),
    /Confirmação inválida/
  );

  __resetResetOperacionalClientForTests();
});
