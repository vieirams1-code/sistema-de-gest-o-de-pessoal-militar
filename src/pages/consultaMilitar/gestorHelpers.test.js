import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePostoGraduacao, classificarMilitar, ordenarMilitaresAntiguidade } from '../../utils/efetivo/gestorClassificacao.js';
import { filtrarUnidadesCartoes } from '../../utils/efetivo/visualizacaoGestor.js';
import montarArvoreLotacaoMilitares from '../../utils/efetivo/montarArvoreLotacaoMilitares.js';

test('resolve posto_graduacao com precedência', () => {
  assert.equal(resolvePostoGraduacao({ posto_graduacao: 'Capitão', posto_grad: 'Soldado' }), 'CAPITÃO');
});

test('classificação institucional', () => {
  assert.equal(classificarMilitar({ quadro: 'QOBM', posto_graduacao: 'Capitão' }), 'oficial');
  assert.equal(classificarMilitar({ quadro: 'QBMP-1', posto_graduacao: '3º Sargento' }), 'praca');
  assert.equal(classificarMilitar({ quadro: 'QPTBM', posto_graduacao: 'Soldado' }), 'temporario');
});

test('ordenação por antiguidade com fallback estável', () => {
  const map = new Map([['2', 1]]);
  const itens = [{ id: '1', nome: 'Bruno', matricula: '20' }, { id: '2', nome: 'Carlos', matricula: '10' }, { id: '3', nome: 'Ana', matricula: '30' }];
  assert.deepEqual(ordenarMilitaresAntiguidade(itens, map).map((m) => m.id), ['2', '3', '1']);
});

test('busca local de cartões filtra por unidade/sigla/setor/subsetor', () => {
  const unidades = [
    { unidadeNome: '1º GBM', unidadeSigla: '1GBM', setorNome: 'Operacional', subsetorNome: 'Área Norte' },
    { unidadeNome: '2º GBM', unidadeSigla: '2GBM', setorNome: 'Administrativo', subsetorNome: 'Área Sul' },
  ];

  assert.equal(filtrarUnidadesCartoes(unidades, 'norte').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, '2gbm')[0].unidadeNome, '2º GBM');
  assert.equal(filtrarUnidadesCartoes(unidades, 'operacional')[0].unidadeSigla, '1GBM');
});

test('árvore do gestor agrupa unidades irmãs sem repetir setor e subsetor', () => {
  const setor = { nome: 'Operacional', sigla: 'OP' };
  const subsetor = { nome: 'Área Metropolitana', sigla: 'AM', parent: setor };
  const lotacoes = [
    { id: 'cg', nome: 'Campo Grande', descricao: 'Sede regional', parent: subsetor },
    { id: 'nas', nome: 'Nova Alvorada do Sul', parent: subsetor },
    { id: 'sid', nome: 'Sidrolândia', parent: subsetor },
  ];
  const militares = [
    { id: '1', estrutura_id: 'cg' },
    { id: '2', estrutura_id: 'nas' },
    { id: '3', estrutura_id: 'sid' },
  ];

  const arvore = montarArvoreLotacaoMilitares(militares, lotacoes);

  assert.equal(arvore.length, 1);
  assert.equal(arvore[0].setorNome, 'Operacional');
  assert.equal(arvore[0].subsetores.length, 1);
  assert.deepEqual(arvore[0].subsetores[0].unidades.map((unidade) => unidade.unidadeNome), [
    'Campo Grande',
    'Nova Alvorada do Sul',
    'Sidrolândia',
  ]);
  assert.equal(arvore[0].subsetores[0].unidades[0].unidadeDescricao, 'Sede regional');
});

test('árvore do gestor usa raiz institucional consolidada para lotações planas sem setor ou subsetor', () => {
  const lotacoes = [
    { id: 'cg', nome: 'Campo Grande' },
    { id: 'nas', nome: 'Nova Alvorada do Sul' },
    { id: 'sid', nome: 'Sidrolândia' },
  ];
  const militares = [
    { id: '1', estrutura_id: 'cg' },
    { id: '2', estrutura_id: 'nas' },
    { id: '3', estrutura_id: 'sid' },
  ];

  const arvore = montarArvoreLotacaoMilitares(militares, lotacoes);

  assert.equal(arvore.length, 1);
  assert.equal(arvore[0].setorNome, 'CMB');
  assert.equal(arvore[0].subsetores.length, 1);
  assert.equal(arvore[0].subsetores[0].subsetorNome, '1º GBM');
  assert.deepEqual(arvore[0].subsetores[0].unidades.map((unidade) => unidade.unidadeNome), [
    'Campo Grande',
    'Nova Alvorada do Sul',
    'Sidrolândia',
  ]);
});

test('árvore do gestor incorpora marcadores não informados à única raiz real disponível', () => {
  const lotacoes = [
    { id: 'cg', nome: 'Campo Grande', setor_nome: 'CMB', subsetor_nome: '1º GBM' },
    { id: 'nas', nome: 'Nova Alvorada do Sul', setor_nome: 'Setor não informado', subsetor_nome: 'Subsetor não informado' },
    { id: 'sid', nome: 'Sidrolândia', setor_nome: 'CMB', subsetor_nome: '1º GBM' },
  ];
  const militares = [
    { id: '1', estrutura_id: 'cg' },
    { id: '2', estrutura_id: 'nas' },
    { id: '3', estrutura_id: 'sid' },
  ];

  const arvore = montarArvoreLotacaoMilitares(militares, lotacoes);

  assert.equal(arvore.length, 1);
  assert.equal(arvore[0].setorNome, 'CMB');
  assert.equal(arvore[0].subsetores.length, 1);
  assert.equal(arvore[0].subsetores[0].subsetorNome, '1º GBM');
  assert.deepEqual(arvore[0].subsetores[0].unidades.map((unidade) => unidade.unidadeNome), [
    'Campo Grande',
    'Nova Alvorada do Sul',
    'Sidrolândia',
  ]);
});
