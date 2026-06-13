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
  gerarPromocaoDosAprovados,
  sincronizarParticipantesPromovidos,
  destinoPromocaoDoCurso,
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
  await assert.rejects(() => encerrarCursoFormacao(curso.id, usuario), /sem status final/);

  await alterarStatusParticipanteCurso(p.id, 'aguardando_nova_etapa', 'Aguardando', usuario);
  await assert.rejects(() => encerrarCursoFormacao(curso.id, usuario), /sem status final/);

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

// ===========================================================================
// FASE 3 — Geração de promoção via módulo oficial
// ===========================================================================

test('destino da promoção: CFC → Cabo, CFS → 3º Sargento', () => {
  assert.equal(destinoPromocaoDoCurso('CFC'), 'Cabo');
  assert.equal(destinoPromocaoDoCurso('CFS'), '3º Sargento');
  assert.throws(() => destinoPromocaoDoCurso('CFX'), /não possui destino/);
});

test('gera Promocao como rascunho e PromocaoMilitar (CFC → Cabo), vinculando promocao_id ao participante', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC 2026', tipo: 'CFC' }, usuario);
  const [p1, p2] = await adicionarParticipantesCurso(curso.id, [
    { id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' },
    { id: 'm2', nome_completo: 'Pedro', matricula: '2', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' },
  ], usuario);
  await alterarStatusParticipanteCurso(p1.id, 'aprovado', '', usuario);
  await alterarStatusParticipanteCurso(p2.id, 'aprovado', '', usuario);

  const { promocao, total } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13', doems_edicao_numero: 'DOEMS 11.111' }, usuario);

  // Promocao criada como rascunho/pendente
  assert.equal(promocao.status, 'rascunho');
  assert.equal(promocao.posto_graduacao, 'Cabo');
  assert.equal(promocao.origem, 'curso_formacao');
  assert.equal(total, 2);

  // PromocaoMilitar criados corretamente (não publicados)
  const pm = client.__stores.PromocaoMilitar;
  assert.equal(pm.length, 2);
  assert.ok(pm.every((x) => x.promocao_id === promocao.id));
  assert.ok(pm.every((x) => x.publicado === false && x.status === 'elegivel'));

  // promocao_id vinculado no participante
  const participantes = await listarParticipantesCurso(curso.id);
  assert.ok(participantes.every((x) => x.promocao_id === promocao.id));

  // NÃO virou promovido só por gerar a promoção
  assert.ok(participantes.every((x) => x.status === 'aprovado'));

  // Integridade: não cria/altera Militar nem Histórico
  assert.equal(client.__stores.Militar, undefined);
  assert.equal(client.__stores.HistoricoPromocaoMilitarV2, undefined);
});

test('CFS gera promoção destino 3º Sargento', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFS 2026', tipo: 'CFS' }, usuario);
  const [p1] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Cabo', quadro: 'QBMP-1.a' }], usuario);
  await alterarStatusParticipanteCurso(p1.id, 'aprovado', '', usuario);
  const { promocao } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  assert.equal(promocao.posto_graduacao, '3º Sargento');
});

test('reprovado/desligado NÃO entram na promoção; aprovado e aguardando entram', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [pAprovado, pAguardando, pReprovado, pDesligado] = await adicionarParticipantesCurso(curso.id, [
    { id: 'm1', nome_completo: 'A', matricula: '1', posto_graduacao: 'Soldado' },
    { id: 'm2', nome_completo: 'B', matricula: '2', posto_graduacao: 'Soldado' },
    { id: 'm3', nome_completo: 'C', matricula: '3', posto_graduacao: 'Soldado' },
    { id: 'm4', nome_completo: 'D', matricula: '4', posto_graduacao: 'Soldado' },
  ], usuario);
  await alterarStatusParticipanteCurso(pAprovado.id, 'aprovado', '', usuario);
  await alterarStatusParticipanteCurso(pAguardando.id, 'aguardando_nova_etapa', 'Aguardando', usuario);
  await alterarStatusParticipanteCurso(pReprovado.id, 'reprovado', 'Faltas', usuario);
  await alterarStatusParticipanteCurso(pDesligado.id, 'desligado', 'Pedido', usuario);

  const { total } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  assert.equal(total, 2); // só aprovado + aguardando

  const pm = client.__stores.PromocaoMilitar;
  const militaresNaPromocao = pm.map((x) => x.militar_id).sort();
  assert.deepEqual(militaresNaPromocao, ['m1', 'm2']);
});

test('gerar promoção exige pelo menos um elegível', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'A', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  await alterarStatusParticipanteCurso(p.id, 'reprovado', 'Faltas', usuario);
  await assert.rejects(() => gerarPromocaoDosAprovados(curso.id, { quadro: 'X', data_promocao: '2026-06-13' }, usuario), /aprovados ou aguardando/);
});

test('participante só vira promovido após publicação oficial da promoção', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p1] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'A', matricula: '1', posto_graduacao: 'Soldado' }], usuario);
  await alterarStatusParticipanteCurso(p1.id, 'aprovado', '', usuario);
  await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);

  // Antes da publicação: sincronizar não promove
  let r = await sincronizarParticipantesPromovidos(curso.id, usuario);
  assert.equal(r.promovidos, 0);
  let participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'aprovado');

  // Simula publicação oficial (módulo de Promoções marca PromocaoMilitar como publicado)
  const pm = client.__stores.PromocaoMilitar[0];
  await client.entities.PromocaoMilitar.update(pm.id, { status: 'publicado', publicado: true });

  r = await sincronizarParticipantesPromovidos(curso.id, usuario);
  assert.equal(r.promovidos, 1);
  participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'promovido');
});

test('curso com aprovado SEM promoção publicada NÃO encerra; encerra só com todos em status final', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p1, p2] = await adicionarParticipantesCurso(curso.id, [
    { id: 'm1', nome_completo: 'A', matricula: '1', posto_graduacao: 'Soldado' },
    { id: 'm2', nome_completo: 'B', matricula: '2', posto_graduacao: 'Soldado' },
  ], usuario);
  await alterarStatusParticipanteCurso(p1.id, 'aprovado', '', usuario);
  await alterarStatusParticipanteCurso(p2.id, 'reprovado', 'Faltas', usuario);

  // Aprovado ainda não promovido → bloqueia encerramento
  await assert.rejects(() => encerrarCursoFormacao(curso.id, usuario), /sem status final/);

  // Gera e publica a promoção do aprovado
  await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  const pm = client.__stores.PromocaoMilitar[0];
  await client.entities.PromocaoMilitar.update(pm.id, { status: 'publicado', publicado: true });
  await sincronizarParticipantesPromovidos(curso.id, usuario);

  // Agora: promovido + reprovado = todos finais → encerra
  const encerrado = await encerrarCursoFormacao(curso.id, usuario);
  assert.equal(encerrado.status, 'encerrado');
});

test('gerar promoção NÃO altera cadastro Militar nem Histórico de Promoções', async () => {
  const client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p1] = await adicionarParticipantesCurso(curso.id, [{ id: 'm1', nome_completo: 'A', matricula: '1', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }], usuario);
  await alterarStatusParticipanteCurso(p1.id, 'aprovado', '', usuario);
  await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);

  // Nenhuma escrita em Militar ou Histórico (stores nem existem)
  assert.equal(client.__stores.Militar, undefined);
  assert.equal(client.__stores.HistoricoPromocaoMilitarV2, undefined);
  assert.equal(client.__stores.HistoricoPromocaoMilitar, undefined);
});

__resetCursoFormacaoClientForTests();