import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePostoGraduacao, classificarMilitar, ordenarMilitaresAntiguidade } from '../../utils/efetivo/gestorClassificacao.js';
import { filtrarMilitaresGestor, filtrarUnidadesCartoes, listarTagsDisponiveisGestor } from '../../utils/efetivo/visualizacaoGestor.js';
import montarArvoreLotacaoMilitares, { normalizarTagsMilitar } from '../../utils/efetivo/montarArvoreLotacaoMilitares.js';
import { getTagsCompactasMilitar } from '../../utils/funcoesTags/tagsCompactasEfetivo.js';

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

test('calcula resumo do efetivo por unidade separando oficiais, praças, homens e mulheres', () => {
  const arvore = montarArvoreLotacaoMilitares([
    { id: '1', nome_guerra: 'Oficial M', posto_graduacao: 'Capitão', sexo: 'M', lotacao: 'Campo Grande', grupamento_nome: 'CMB', subgrupamento_nome: '1º GBM' },
    { id: '2', nome_guerra: 'Oficial F', posto_graduacao: '1º Tenente', sexo: 'F', lotacao: 'Campo Grande', grupamento_nome: 'CMB', subgrupamento_nome: '1º GBM' },
    { id: '3', nome_guerra: 'Subtenente', posto_graduacao: 'Subtenente', sexo: 'M', lotacao: 'Campo Grande', grupamento_nome: 'CMB', subgrupamento_nome: '1º GBM' },
    { id: '4', nome_guerra: 'Cabo F', posto_graduacao: 'Cabo', sexo: 'F', lotacao: 'Campo Grande', grupamento_nome: 'CMB', subgrupamento_nome: '1º GBM' },
  ]);

  const unidade = arvore[0].subsetores[0].unidades[0];

  assert.equal(unidade.resumoEfetivo.oficiais, 2);
  assert.equal(unidade.resumoEfetivo.pracas, 2);
  assert.equal(unidade.resumoEfetivo.homens, 2);
  assert.equal(unidade.resumoEfetivo.mulheres, 2);
  assert.deepEqual(unidade.oficiais.map((militar) => militar.nome_guerra), ['Oficial M', 'Oficial F']);
  assert.deepEqual(unidade.pracas.map((militar) => militar.nome_guerra), ['Subtenente', 'Cabo F']);
});

test('não descarta militares ao montar a árvore mesmo com lotação incompleta', () => {
  const militares = [
    { id: '1', nome_guerra: 'A', lotacao: 'Campo Grande', posto_graduacao: 'Cabo' },
    { id: '2', nome_guerra: 'B', estrutura_nome: 'Campo Grande', posto_graduacao: 'Soldado' },
    { id: '3', nome_guerra: 'C', lotacao: '', posto_graduacao: 'Soldado' },
  ];

  const arvore = montarArvoreLotacaoMilitares({ militares, lotacoes: [] });
  const total = arvore.reduce((setores, setor) => setores + setor.subsetores.reduce((subsetores, subsetor) => subsetores + subsetor.unidades.reduce((unidades, unidade) => unidades + unidade.militares.length, 0), 0), 0);

  assert.equal(total, militares.length);
});

test('soma resumoEfetivo no setor e subsetor a partir das unidades subordinadas', () => {
  const arvore = montarArvoreLotacaoMilitares({
    militares: [
      { id: '1', nome_guerra: 'A', posto_graduacao: 'Capitão', sexo: 'M', lotacao: 'Campo Grande' },
      { id: '2', nome_guerra: 'B', posto_graduacao: 'Cabo', sexo: 'F', lotacao: 'Campo Grande' },
      { id: '3', nome_guerra: 'C', posto_graduacao: 'Soldado', sexo: 'M', lotacao: 'Sidrolândia' },
    ],
  });

  const setor = arvore[0];
  const subsetor = setor.subsetores[0];
  assert.equal(setor.total, 3);
  assert.equal(subsetor.total, 3);
  assert.equal(setor.resumoEfetivo.oficiais, 1);
  assert.equal(setor.resumoEfetivo.pracas, 2);
  assert.equal(setor.resumoEfetivo.homens, 2);
  assert.equal(setor.resumoEfetivo.mulheres, 1);
  assert.deepEqual(subsetor.resumoEfetivo, setor.resumoEfetivo);
});

test('normaliza tags dos militares e calcula resumoTags da unidade', () => {
  const arvore = montarArvoreLotacaoMilitares({
    militares: [
      { id: '1', nome_guerra: 'A', posto_graduacao: 'Cabo', lotacao: 'Campo Grande', tags: ['COV', 'MOB'] },
      { id: '2', nome_guerra: 'B', posto_graduacao: 'Soldado', lotacao: 'Campo Grande', tags: [{ nome: 'COV' }] },
    ],
  });

  const unidade = arvore[0].subsetores[0].unidades[0];
  assert.ok(unidade.militares[0].tags_resolvidas.length > 0);
  assert.equal(unidade.resumoTags.find((tag) => tag.nome === 'COV')?.total, 2);
  assert.equal(unidade.resumoTags.find((tag) => tag.nome === 'MOB')?.total, 1);
});

test('vincula militar por campos alternativos e aceita lotação embutida como objeto', () => {
  const arvore = montarArvoreLotacaoMilitares({
    lotacoes: [{ id: 'cg', unidade_id: 'unidade-cg', nome: 'Campo Grande', setor_nome: 'CMB', subsetor_nome: '1º GBM' }],
    militares: [
      { id: '1', unidade_id: 'unidade-cg' },
      { id: '2', lotacao_obj: { nome: 'Sidrolândia', setor_nome: 'CMB', subsetor_nome: '1º GBM' } },
    ],
  });

  assert.deepEqual(arvore[0].subsetores[0].unidades.map((unidade) => unidade.unidadeNome), ['Campo Grande', 'Sidrolândia']);
});


test('normaliza tags em múltiplos formatos compatíveis com o efetivo', () => {
  assert.ok(normalizarTagsMilitar({ tags: ['COV'] }).map((tag) => tag.nome).includes('COV'));
  assert.ok(normalizarTagsMilitar({ marcadores: [{ nome: 'MOB' }] }).map((tag) => tag.nome).includes('MOB'));
  assert.deepEqual(normalizarTagsMilitar({ tags_operacionais: 'APH;Motorista' }).map((tag) => tag.nome), ['APH', 'Motorista']);
  assert.ok(normalizarTagsMilitar({ tags_militar: [{ tag_id: 'cov-id', label: 'COV' }] }).map((tag) => tag.nome).includes('COV'));
});

test('lista tags disponíveis e filtra militares por todas as tags selecionadas', () => {
  const militares = [
    { id: '1', nome_guerra: 'A', tags_resolvidas: [{ id: 'cov-id', nome: 'COV' }, { id: 'mob-id', nome: 'MOB' }] },
    { id: '2', nome_guerra: 'B', tags_resolvidas: [{ id: 'cov-id', nome: 'COV' }] },
    { id: '3', nome_guerra: 'C', tags_resolvidas: [{ id: 'mob-id', nome: 'MOB' }] },
  ];

  assert.deepEqual(listarTagsDisponiveisGestor(militares), [
    { id: 'cov', nome: 'COV', total: 2 },
    { id: 'mob', nome: 'MOB', total: 2 },
  ]);
  assert.deepEqual(filtrarMilitaresGestor(militares, '', ['cov']).map((militar) => militar.id), ['1', '2']);
  assert.deepEqual(filtrarMilitaresGestor(militares, '', ['cov', 'mob']).map((militar) => militar.id), ['1']);
});


test('resolve a tag real da lista do Efetivo pelo catálogo Tag e vínculo MilitarTag', () => {
  const tags = getTagsCompactasMilitar({
    militarId: 'militar-1',
    tagsAtivas: [{ id: 'tag-cov', nome: 'COV', aplicabilidade: 'militar' }],
    vinculosTagsAtivos: [{ id: 'vinculo-1', militar_id: 'militar-1', tag_id: 'tag-cov', status: 'ativa' }],
  });

  assert.deepEqual(tags.map((tag) => tag.nome), ['COV']);
});
