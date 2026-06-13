import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  decorarMilitares,
  carregarParticipantesAtivosPorMilitar,
  __setDecoradorClientForTests,
  __resetDecoradorClientForTests,
} from '../decorarMilitaresPostoVirtual.js';
import { compararPorPostoVirtual } from '../militarStatusVirtual.js';

afterEach(() => __resetDecoradorClientForTests());

const soldado = { id: 'm1', posto_graduacao: 'Soldado', quadro: 'QPTBM' };
const cabo = { id: 'm2', posto_graduacao: 'Cabo', quadro: 'QPTBM' };
const tresSgt = { id: 'm3', posto_graduacao: '3º Sargento', quadro: 'QPTBM' };

// Cenário 1 — Soldado em CFC ativo → Aluno a Cabo
test('Cenário 1: Soldado em CFC ativo exibe Aluno a Cabo sem mutar cadastro', () => {
  const mapa = new Map([['m1', { militar_id: 'm1', tipo_curso: 'CFC', status: 'em_curso', curso_id: 'c1' }]]);
  const [dec] = decorarMilitares([soldado], mapa);
  assert.equal(dec.posto_graduacao_exibicao, 'Aluno a Cabo');
  assert.equal(dec.possui_posto_virtual, true);
  assert.equal(dec.tipo_curso_formacao, 'CFC');
  // Integridade: cadastro real intacto
  assert.equal(dec.posto_graduacao, 'Soldado');
  assert.equal(soldado.posto_graduacao, 'Soldado');
});

// Cenário 2 — Cabo em CFS ativo → Aluno a Sargento
test('Cenário 2: Cabo em CFS ativo exibe Aluno a Sargento', () => {
  const mapa = new Map([['m2', { militar_id: 'm2', tipo_curso: 'CFS', status: 'aguardando_nova_etapa', curso_id: 'c2' }]]);
  const [dec] = decorarMilitares([cabo], mapa);
  assert.equal(dec.posto_graduacao_exibicao, 'Aluno a Sargento');
  assert.equal(dec.posto_graduacao, 'Cabo');
});

// Cenário 3 — reprovado/desligado volta ao posto real
test('Cenário 3: status final não gera posto virtual', () => {
  const mapa = new Map([['m1', { militar_id: 'm1', tipo_curso: 'CFC', status: 'reprovado', curso_id: 'c1' }]]);
  const [dec] = decorarMilitares([soldado], mapa);
  // status final não é carregado pelo backend (filtro), mas se vier, não aplica
  assert.equal(dec.posto_graduacao_exibicao, 'Soldado');
  assert.equal(dec.possui_posto_virtual, false);
});

// Cenário 4 — sem curso → posto real
test('Cenário 4: militar sem curso exibe posto real', () => {
  const [dec] = decorarMilitares([cabo], new Map());
  assert.equal(dec.posto_graduacao_exibicao, 'Cabo');
  assert.equal(dec.possui_posto_virtual, false);
  assert.equal(dec.tipo_curso_formacao, null);
});

// Cenário 5 — ordenação completa Soldado < Aluno a Cabo < Cabo < Aluno a Sargento < 3º Sargento
test('Cenário 5: ordenação respeita precedência com posições virtuais', () => {
  const itens = [
    { posto_exibicao: '3º Sargento' },
    { posto_exibicao: 'Aluno a Sargento' },
    { posto_exibicao: 'Cabo' },
    { posto_exibicao: 'Aluno a Cabo' },
    { posto_exibicao: 'Soldado' },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.posto_exibicao);
  assert.deepEqual(ordenado, ['Soldado', 'Aluno a Cabo', 'Cabo', 'Aluno a Sargento', '3º Sargento']);
});

// Cenário 5b — hierarquia oficial completa preservada acima de 3º Sargento
test('Cenário 5b: postos oficiais superiores mantêm ordem institucional', () => {
  const itens = [
    { posto_exibicao: 'Coronel' },
    { posto_exibicao: 'Major' },
    { posto_exibicao: 'Aluno a Cabo' },
    { posto_exibicao: 'Capitão' },
    { posto_exibicao: '1º Sargento' },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.posto_exibicao);
  assert.deepEqual(ordenado, ['Aluno a Cabo', '1º Sargento', 'Capitão', 'Major', 'Coronel']);
});

// Cenário 6 — integridade: decorar não muda os objetos originais
test('Cenário 6: decoração não muta objetos originais', () => {
  const original = { id: 'm9', posto_graduacao: 'Soldado', quadro: 'QPTBM' };
  const mapa = new Map([['m9', { militar_id: 'm9', tipo_curso: 'CFC', status: 'em_curso', curso_id: 'c1' }]]);
  decorarMilitares([original], mapa);
  assert.equal(original.posto_graduacao, 'Soldado');
  assert.equal(original.posto_graduacao_exibicao, undefined);
});

// Carregamento: ignora cursos encerrados/cancelados
test('carregarParticipantesAtivosPorMilitar ignora cursos não ativos', async () => {
  __setDecoradorClientForTests({
    entities: {
      ParticipanteCursoFormacao: {
        filter: async () => ([
          { id: 'p1', militar_id: 'm1', curso_id: 'c1', status: 'em_curso', snapshot_antiguidade: 1 },
          { id: 'p2', militar_id: 'm2', curso_id: 'c2', status: 'em_curso', snapshot_antiguidade: 2 },
        ]),
      },
      CursoFormacao: {
        filter: async () => ([
          { id: 'c1', tipo: 'CFC', status: 'em_andamento' },
          { id: 'c2', tipo: 'CFS', status: 'encerrado' },
        ]),
      },
    },
  });
  const mapa = await carregarParticipantesAtivosPorMilitar();
  assert.equal(mapa.has('m1'), true);
  assert.equal(mapa.get('m1').tipo_curso, 'CFC');
  assert.equal(mapa.has('m2'), false); // curso encerrado
});

// Filtro reconhece posto virtual: militar Soldado em CFC bate em filtro "Aluno a Cabo"
test('Filtro: posto de exibição de Soldado em CFC é Aluno a Cabo', () => {
  const mapa = new Map([['m1', { militar_id: 'm1', tipo_curso: 'CFC', status: 'em_curso', curso_id: 'c1' }]]);
  const [dec] = decorarMilitares([soldado], mapa);
  // accessor de posto usa posto_graduacao_exibicao → filtro multiselect compara com este valor
  assert.equal(dec.posto_graduacao_exibicao, 'Aluno a Cabo');
  assert.notEqual(dec.posto_graduacao_exibicao, 'Soldado');
});