import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  __setCursoFormacaoClientForTests,
  __resetCursoFormacaoClientForTests,
  criarCursoFormacao,
  adicionarParticipantesCurso,
  alterarStatusParticipanteCurso,
  encerrarCursoFormacao,
  cancelarCursoFormacao,
  listarParticipantesCurso,
} from '../cursoFormacaoService.js';

// ---------------------------------------------------------------------------
// Fake in-memory base44.entities
// ---------------------------------------------------------------------------
function criarFakeClient() {
  const stores = {};
  let seq = 0;
  const tabela = (name) => {
    if (!stores[name]) stores[name] = [];
    return stores[name];
  };
  const entity = (name) => ({
    async create(data) {
      const reg = { id: `${name}_${++seq}`, created_date: new Date().toISOString(), ...data };
      tabela(name).push(reg);
      return reg;
    },
    async update(id, data) {
      const reg = tabela(name).find((r) => r.id === id);
      Object.assign(reg, data);
      return reg;
    },
    async get(id) {
      return tabela(name).find((r) => r.id === id) || null;
    },
    async delete(id) {
      stores[name] = tabela(name).filter((r) => r.id !== id);
      return true;
    },
    async list({ query = {} } = {}) {
      return tabela(name).filter((r) =>
        Object.entries(query).every(([k, v]) => r[k] === v),
      );
    },
  });
  return {
    __stores: stores,
    entities: new Proxy({}, { get: (_t, name) => entity(name) }),
  };
}

const usuario = { id: 'u1', full_name: 'Admin', email: 'admin@x.com' };

beforeEach(() => {
  __setCursoFormacaoClientForTests(criarFakeClient());
});

test('cria curso CFC com status aberto e gera auditoria', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC 2026', tipo: 'CFC' }, usuario);
  assert.equal(curso.status, 'aberto');
  assert.equal(curso.tipo, 'CFC');
  assert.equal(client.__stores.AuditCursoFormacao.length, 1);
  assert.equal(client.__stores.AuditCursoFormacao[0].acao, 'criar_curso');
});

test('rejeita tipo de curso inválido', async () => {
  await assert.rejects(() => criarCursoFormacao({ nome: 'X', tipo: 'CFX' }, usuario), /Tipo do curso inválido/);
});

test('adiciona participante capturando snapshot e NÃO altera Militar', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const militar = { id: 'm1', nome_completo: 'João', matricula: '123', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' };

  const [p] = await adicionarParticipantesCurso(curso.id, [militar], usuario);

  assert.equal(p.nome_militar_snapshot, 'João');
  assert.equal(p.matricula_snapshot, '123');
  assert.equal(p.posto_origem, 'Soldado');
  assert.equal(p.status, 'em_curso');
  // Critério: não altera cadastro Militar (não há store Militar criado/alterado)
  assert.equal(client.__stores.Militar, undefined);
});

test('bloqueia duplicidade do mesmo militar no mesmo curso', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const militar = { id: 'm1', nome_completo: 'João', matricula: '123', posto_graduacao: 'Soldado' };
  await adicionarParticipantesCurso(curso.id, [militar], usuario);
  await assert.rejects(() => adicionarParticipantesCurso(curso.id, [militar], usuario), /já está neste curso/);
});

test('bloqueia militar em dois cursos de formação ativos', async () => {
  const cursoA = await criarCursoFormacao({ nome: 'CFC A', tipo: 'CFC' }, usuario);
  const cursoB = await criarCursoFormacao({ nome: 'CFC B', tipo: 'CFC' }, usuario);
  const militar = { id: 'm1', nome_completo: 'João', matricula: '123', posto_graduacao: 'Soldado' };
  await adicionarParticipantesCurso(cursoA.id, [militar], usuario);
  await assert.rejects(() => adicionarParticipantesCurso(cursoB.id, [militar], usuario), /outro curso de formação ativo/);
});

test('preserva ordem de antiguidade do ingresso via snapshot_antiguidade', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  await adicionarParticipantesCurso(curso.id, [
    { id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado' },
    { id: 'm2', nome_completo: 'Pedro', matricula: '2', posto_graduacao: 'Soldado' },
    { id: 'm3', nome_completo: 'Carlos', matricula: '3', posto_graduacao: 'Soldado' },
  ], usuario);
  const participantes = await listarParticipantesCurso(curso.id);
  const ordens = participantes.map((p) => `${p.nome_militar_snapshot}:${p.snapshot_antiguidade}`);
  assert.deepEqual(ordens.sort(), ['Carlos:3', 'João:1', 'Pedro:2']);
});

test('altera status para aprovado sem justificativa', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  const atualizado = await alterarStatusParticipanteCurso(p.id, 'aprovado', '', usuario);
  assert.equal(atualizado.status, 'aprovado');
});

test('exige justificativa para reprovado/desligado/aguardando_nova_etapa', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  await assert.rejects(() => alterarStatusParticipanteCurso(p.id, 'reprovado', '', usuario), /Justificativa é obrigatória/);
  await assert.rejects(() => alterarStatusParticipanteCurso(p.id, 'desligado', '  ', usuario), /Justificativa é obrigatória/);
  await assert.rejects(() => alterarStatusParticipanteCurso(p.id, 'aguardando_nova_etapa', '', usuario), /Justificativa é obrigatória/);
  const ok = await alterarStatusParticipanteCurso(p.id, 'reprovado', 'Faltas', usuario);
  assert.equal(ok.status, 'reprovado');
});

test('bloqueia encerramento com participante em_curso ou aguardando_nova_etapa', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  await assert.rejects(() => encerrarCursoFormacao(curso.id, usuario), /participante\(s\) com status pendente/);

  await alterarStatusParticipanteCurso(p.id, 'aguardando_nova_etapa', 'Aguardando', usuario);
  await assert.rejects(() => encerrarCursoFormacao(curso.id, usuario), /participante\(s\) com status pendente/);

  await alterarStatusParticipanteCurso(p.id, 'reprovado', 'Faltas', usuario);
  const encerrado = await encerrarCursoFormacao(curso.id, usuario);
  assert.equal(encerrado.status, 'encerrado');
});

test('não cancela curso com participante promovido', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  // Simula promoção definitiva (status final 'promovido')
  await client.entities.ParticipanteCursoFormacao.update(p.id, { status: 'promovido' });
  await assert.rejects(() => cancelarCursoFormacao(curso.id, 'motivo', usuario), /participantes promovidos/);
});

__resetCursoFormacaoClientForTests();