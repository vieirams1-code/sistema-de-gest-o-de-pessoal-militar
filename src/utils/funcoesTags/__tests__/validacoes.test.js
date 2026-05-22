import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTexto } from '../normalizacao.js';
import { validarFuncao, validarTag, validarTagGrupo } from '../validacoes.js';

test('normaliza removendo acentos e espaços', () => {
  assert.equal(normalizarTexto('  ComandântE  '), 'comandante');
});

test('valida prioridade institucional', () => {
  const erro = validarFuncao({ nome: 'Comandante', institucional_chave: 'comandante', prioridade_lista: 10 }, [], null);
  assert.equal(erro, 'Comandante deve ter prioridade 1.');
});

test('bloqueia duplicidade de grupo ativo', () => {
  const erro = validarTagGrupo({ nome: 'Restrição' }, [{ id: '1', nome: 'Restricao', ativo: true }], null);
  assert.equal(erro, 'Já existe um grupo ativo com esse nome.');
});

test('bloqueia duplicidade de tag no mesmo grupo', () => {
  const erro = validarTag({ nome: 'Destaque', grupo_id: 'g1' }, [{ id: '1', nome: 'destaqué', grupo_id: 'g1', ativo: true }], null);
  assert.equal(erro, 'Já existe uma tag ativa com esse nome neste grupo.');
});
