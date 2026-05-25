import test from 'node:test';
import assert from 'node:assert/strict';

import { base44 } from '@/api/base44Client';
import {
  criarMilitarTagEscopado,
  atualizarTagEscopado,
  desativarTagEscopado,
  excluirTagGrupoEscopado,
  excluirTagEscopado,
} from '../cudFuncoesTagsEscopadoClient.js';

const originalInvoke = base44.functions?.invoke;

test('preserva payload de conflito TAG_UNICA_CONFLITO', async () => {
  base44.functions.invoke = async () => {
    const error = new Error('Conflict');
    error.response = {
      status: 409,
      data: {
        code: 'TAG_UNICA_CONFLITO',
        militar_id: 'm1',
        militar_nome: 'Fulano',
        posto_grad: 'CAP',
        message: 'Esta tag já está atribuída a CAP Fulano.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () => criarMilitarTagEscopado({ militar_id: 'm2', tag_id: 't1' }),
    (err) => {
      assert.equal(err.code, 'TAG_UNICA_CONFLITO');
      assert.equal(err.militar_id, 'm1');
      assert.equal(err.militar_nome, 'Fulano');
      assert.equal(err.posto_grad, 'CAP');
      assert.match(err.message, /já está atribuída/);
      return true;
    },
  );
});

test('erro TAG_COM_VINCULOS preserva contagens', async () => {
  base44.functions.invoke = async () => {
    const error = new Error('Conflict');
    error.response = {
      status: 409,
      data: {
        code: 'TAG_COM_VINCULOS',
        militar_tags: 2,
        ferias_tags: 1,
        atestado_tags: 3,
        message: 'Esta tag possui vínculos e não pode ser excluída.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () => excluirTagEscopado('tag-1'),
    (err) => {
      assert.equal(err.code, 'TAG_COM_VINCULOS');
      assert.equal(err.militar_tags, 2);
      assert.equal(err.ferias_tags, 1);
      assert.equal(err.atestado_tags, 3);
      return true;
    },
  );
});

test('excluirTagEscopado envia entidade Tag e operacao delete', async () => {
  let payload = null;
  base44.functions.invoke = async (_name, body) => {
    payload = body;
    return { data: { data: { id: 'tag-1', deleted: true } } };
  };

  const result = await excluirTagEscopado('tag-1');
  assert.deepEqual(payload, { entidade: 'Tag', operacao: 'delete', id: 'tag-1' });
  assert.deepEqual(result, { id: 'tag-1', deleted: true });
});

test('excluirTagGrupoEscopado envia entidade TagGrupo e operacao delete', async () => {
  let payload = null;
  base44.functions.invoke = async (_name, body) => {
    payload = body;
    return { data: { data: { id: 'grupo-1', deleted: true } } };
  };

  const result = await excluirTagGrupoEscopado('grupo-1');
  assert.deepEqual(payload, { entidade: 'TagGrupo', operacao: 'delete', id: 'grupo-1' });
  assert.deepEqual(result, { id: 'grupo-1', deleted: true });
});

test('erro GRUPO_COM_TAGS_ATIVAS preserva lista de tags ativas', async () => {
  base44.functions.invoke = async () => {
    const error = new Error('Conflict');
    error.response = {
      status: 409,
      data: {
        code: 'GRUPO_COM_TAGS_ATIVAS',
        tags_ativas: ['Urgente', 'Disponível'],
        message: 'Este grupo possui tags ativas e não pode ser excluído.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () => excluirTagGrupoEscopado('grupo-1'),
    (err) => {
      assert.equal(err.code, 'GRUPO_COM_TAGS_ATIVAS');
      assert.deepEqual(err.tags_ativas, ['Urgente', 'Disponível']);
      return true;
    },
  );
});

test('update Tag preserva tipo_uso', async () => {
  let payload = null;
  base44.functions.invoke = async (_name, body) => {
    payload = body;
    return { data: { data: { id: 'tag-2' } } };
  };

  await atualizarTagEscopado('tag-2', { nome: 'Teste', tipo_uso: 'unica' });
  assert.equal(payload?.data?.tipo_uso, 'unica');
});

test('desativar Tag com ativo false e reativar com ativo true', async () => {
  const calls = [];
  base44.functions.invoke = async (_name, body) => {
    calls.push(body);
    return { data: { data: { id: body.id, ativo: body?.data?.ativo } } };
  };

  await desativarTagEscopado('tag-3', { ativo: false });
  await desativarTagEscopado('tag-3', { ativo: true });

  assert.equal(calls[0].operacao, 'desativar');
  assert.equal(calls[0].data.ativo, false);
  assert.equal(calls[1].data.ativo, true);
});

test('normaliza sucesso da função CUD', async () => {
  base44.functions.invoke = async () => ({ data: { data: { id: 'ok-1' } } });

  const result = await criarMilitarTagEscopado({ militar_id: 'm2', tag_id: 't1' });
  assert.deepEqual(result, { id: 'ok-1' });
});

test.after(() => {
  base44.functions.invoke = originalInvoke;
});
