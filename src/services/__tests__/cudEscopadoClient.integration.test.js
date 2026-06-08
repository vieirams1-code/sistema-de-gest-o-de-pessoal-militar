import test from 'node:test';
import assert from 'node:assert/strict';

import { base44 } from '../../api/base44Client.js';
import {
  criarEscopado,
  atualizarEscopado,
  desativarEscopado,
  excluirEscopado,
} from '../cudEscopadoClient.js';

const originalInvoke = base44.functions?.invoke;

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
    () => excluirEscopado('Tag', 'tag-1'),
    (err) => {
      assert.equal(err.code, 'TAG_COM_VINCULOS');
      assert.equal(err.militar_tags, 2);
      assert.equal(err.ferias_tags, 1);
      assert.equal(err.atestado_tags, 3);
      return true;
    },
  );
});

test('excluirEscopado envia entidade Tag e operacao delete', async () => {
  let payload = null;
  base44.functions.invoke = async (_name, body) => {
    payload = body;
    return { data: { ok: true, entityName: 'Tag', operation: 'delete', registroId: 'tag-1', data: { id: 'tag-1', deleted: true } } };
  };

  const result = await excluirEscopado('Tag', 'tag-1');
  assert.deepEqual(payload, { entityName: 'Tag', operation: 'delete', registroId: 'tag-1' });
  assert.deepEqual(result, { id: 'tag-1', deleted: true });
});

test('excluirEscopado envia entidade TagGrupo e operacao delete', async () => {
  let payload = null;
  base44.functions.invoke = async (_name, body) => {
    payload = body;
    return { data: { ok: true, entityName: 'TagGrupo', operation: 'delete', registroId: 'grupo-1', data: { id: 'grupo-1', deleted: true } } };
  };

  const result = await excluirEscopado('TagGrupo', 'grupo-1');
  assert.deepEqual(payload, { entityName: 'TagGrupo', operation: 'delete', registroId: 'grupo-1' });
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
    () => excluirEscopado('TagGrupo', 'grupo-1'),
    (err) => {
      assert.equal(err.code, 'GRUPO_COM_TAGS_ATIVAS');
      assert.deepEqual(err.tags_ativas, ['Urgente', 'Disponível']);
      return true;
    },
  );
});

test('desativar Tag com ativo false e reativar com ativo true', async () => {
  const calls = [];
  base44.functions.invoke = async (_name, body) => {
    calls.push(body);
    return { data: { data: { id: body.id, ativo: body?.data?.ativo } } };
  };

  await desativarEscopado('Tag', 'tag-3', { ativo: false });
  await desativarEscopado('Tag', 'tag-3', { ativo: true });

  assert.equal(calls[0].operation, 'desativar');
  assert.equal(calls[0].data.ativo, false);
  assert.equal(calls[1].data.ativo, true);
});

test('normaliza sucesso da função CUD', async () => {
  base44.functions.invoke = async () => ({ data: { ok: true, data: { id: 'ok-1' } } });

  const result = await criarEscopado('MilitarTag', { militar_id: 'm2', tag_id: 't1' });
  assert.deepEqual(result, { id: 'ok-1' });
});

test.after(() => {
  base44.functions.invoke = originalInvoke;
});
