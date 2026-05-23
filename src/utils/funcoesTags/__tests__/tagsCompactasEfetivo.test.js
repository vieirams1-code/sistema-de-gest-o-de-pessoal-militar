import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmojisEfetivo } from '../tagsCompactasEfetivo.js';

const funcoes = [
  { id: 'f1', nome: 'Comandante', institucional_chave: 'comandante', prioridade_lista: 1, emoji: '⭐' },
  { id: 'f2', nome: 'Subcomandante', institucional_chave: 'subcomandante', prioridade_lista: 2, emoji: '🔰' },
];

const tags = [
  { id: 't1', nome: 'Motorista', slug: 'motorista', emoji: '🛞' },
  { id: 't2', nome: 'APH', slug: 'aph', emoji: '🚑' },
  { id: 't3', nome: 'Altura', slug: 'altura', emoji: '🧗' },
  { id: 't4', nome: 'Instrutor', slug: 'instrutor', emoji: '📘' },
  { id: 't5', nome: 'Outros', slug: 'outros', emoji: '🧰' },
];

test('militar sem tags retorna vazio', () => {
  const result = getEmojisEfetivo({ militarId: 'm0', funcoesInstitucionais: funcoes, tagsAtivas: tags, vinculosFuncoesAtivos: [], vinculosTagsAtivos: [] });
  assert.deepEqual(result.itens, []);
  assert.equal(result.textoExcesso, '');
});

test('militar com 1 tag', () => {
  const result = getEmojisEfetivo({
    militarId: 'm1',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [],
    vinculosTagsAtivos: [{ militar_id: 'm1', tag_id: 't1', status: 'ativa' }],
  });
  assert.equal(result.itens.length, 1);
  assert.equal(result.itens[0].emoji, '🛞');
});

test('militar com múltiplas tags prioriza operacionais', () => {
  const result = getEmojisEfetivo({
    militarId: 'm2',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [],
    vinculosTagsAtivos: [
      { militar_id: 'm2', tag_id: 't5', status: 'ativa' },
      { militar_id: 'm2', tag_id: 't4', status: 'ativa' },
      { militar_id: 'm2', tag_id: 't2', status: 'ativa' },
    ],
  });
  assert.deepEqual(result.itens.map((item) => item.emoji), ['🚑', '📘', '🧰']);
});

test('comandante + tags ordena função institucional primeiro', () => {
  const result = getEmojisEfetivo({
    militarId: 'm3',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [{ militar_id: 'm3', funcao_id: 'f1', status: 'ativa' }],
    vinculosTagsAtivos: [
      { militar_id: 'm3', tag_id: 't1', status: 'ativa' },
      { militar_id: 'm3', tag_id: 't2', status: 'ativa' },
    ],
  });
  assert.deepEqual(result.itens.map((item) => item.emoji), ['⭐', '🛞', '🚑']);
});

test('composição compacta resolve vínculo de função com funcao_militar_id/militarId', () => {
  const result = getEmojisEfetivo({
    militarId: 'm6',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [{ militarId: 'm6', funcao_militar_id: 'f1', status: 'ativa' }],
    vinculosTagsAtivos: [{ militar_id: 'm6', tag_id: 't2', status: 'ativa' }],
  });
  assert.deepEqual(result.itens.map((item) => item.emoji), ['⭐', '🚑']);
});

test('limite +N respeitado', () => {
  const result = getEmojisEfetivo({
    militarId: 'm4',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [{ militar_id: 'm4', funcao_id: 'f1', status: 'ativa' }],
    vinculosTagsAtivos: [
      { militar_id: 'm4', tag_id: 't1', status: 'ativa' },
      { militar_id: 'm4', tag_id: 't2', status: 'ativa' },
      { militar_id: 'm4', tag_id: 't3', status: 'ativa' },
      { militar_id: 'm4', tag_id: 't4', status: 'ativa' },
      { militar_id: 'm4', tag_id: 't5', status: 'ativa' },
    ],
  });
  assert.equal(result.itens.length, 4);
  assert.equal(result.textoExcesso, '+2');
});

test('ordenação institucional respeita prioridade (comandante antes de subcomandante)', () => {
  const result = getEmojisEfetivo({
    militarId: 'm5',
    funcoesInstitucionais: funcoes,
    tagsAtivas: tags,
    vinculosFuncoesAtivos: [
      { militar_id: 'm5', funcao_id: 'f2', status: 'ativa' },
      { militar_id: 'm5', funcao_id: 'f1', status: 'ativa' },
    ],
    vinculosTagsAtivos: [],
  });
  assert.deepEqual(result.itens.map((item) => item.emoji), ['⭐', '🔰']);
});
