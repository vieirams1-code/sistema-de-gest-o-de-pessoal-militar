import test from 'node:test';
import assert from 'node:assert/strict';

import { sugerirClassificacaoHistoricaLegado } from '../migracaoAlteracoesLegadoClassificacaoHistoricaSugestao.js';

const catalogo = [
  { id: 'ferias', nome: 'Concessão de Férias', ativo: true, uso_migracao: true },
  { id: 'elogio', nome: 'Elogio', ativo: true, uso_migracao: true },
  { id: 'punicao', nome: 'Punição', ativo: true, uso_migracao: true },
  { id: 'designacao', nome: 'Designação', ativo: true, uso_migracao: true },
  { id: 'dispensa', nome: 'Dispensa', ativo: true, uso_migracao: true },
  { id: 'curso', nome: 'Curso', ativo: true, uso_migracao: true },
  { id: 'movimentacao', nome: 'Movimentação', ativo: true, uso_migracao: true },
  { id: 'apresentacao', nome: 'Apresentação', ativo: true, uso_migracao: true },
];

test('sugere Concessão de Férias a partir da classificação original e do texto publicado', () => {
  const sugestao = sugerirClassificacaoHistoricaLegado({
    classificacao_original_legado: 'FÉRIAS',
    texto_publicado: 'Concede férias regulamentares ao militar no período informado.',
  }, catalogo);

  assert.equal(sugestao.id, 'ferias');
  assert.equal(sugestao.nome, 'Concessão de Férias');
});

test('sugere regras iniciais de disciplina, função, curso e movimentação/apresentação', () => {
  assert.equal(sugerirClassificacaoHistoricaLegado({ materia_legado: 'elogio individual' }, catalogo).nome, 'Elogio');
  assert.equal(sugerirClassificacaoHistoricaLegado({ texto_publicado: 'aplica repreensão disciplinar' }, catalogo).nome, 'Punição');
  assert.equal(sugerirClassificacaoHistoricaLegado({ tipo_legado: 'designa militar para função' }, catalogo).nome, 'Designação');
  assert.equal(sugerirClassificacaoHistoricaLegado({ texto_publicado: 'dispensa da comissão' }, catalogo).nome, 'Dispensa');
  assert.equal(sugerirClassificacaoHistoricaLegado({ texto_publicado: 'matrícula em estágio de capacitação' }, catalogo).nome, 'Curso');
  assert.equal(sugerirClassificacaoHistoricaLegado({ texto_publicado: 'foi transferido para nova unidade' }, catalogo).nome, 'Movimentação');
  assert.equal(sugerirClassificacaoHistoricaLegado({ texto_publicado: 'apresentação do militar nesta OPM' }, catalogo).nome, 'Apresentação');
});

test('não sugere quando já existe classificação histórica escolhida pelo usuário', () => {
  const sugestao = sugerirClassificacaoHistoricaLegado({
    classificacao_historica_id: 'manual',
    classificacao_historica_nome: 'Outra classificação',
    texto_publicado: 'concessão de férias',
  }, catalogo);

  assert.equal(sugestao, null);
});

test('não sugere classificação indisponível, inativa ou fora de uso na migração', () => {
  assert.equal(sugerirClassificacaoHistoricaLegado(
    { texto_publicado: 'nomeia militar para função' },
    [{ id: 'designacao', nome: 'Designação', ativo: false, uso_migracao: true }],
  ), null);
  assert.equal(sugerirClassificacaoHistoricaLegado(
    { texto_publicado: 'nomeia militar para função' },
    [{ id: 'designacao', nome: 'Designação', ativo: true, uso_migracao: false }],
  ), null);
});
