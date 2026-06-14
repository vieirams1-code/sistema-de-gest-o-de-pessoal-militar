import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  __setCursoFormacaoClientForTests,
  __resetCursoFormacaoClientForTests,
  criarCursoFormacao,
  adicionarParticipantesCurso,
  alterarStatusParticipanteCurso,
  gerarPromocaoDosAprovados,
  sincronizarParticipantesPromovidos,
  listarParticipantesCurso,
  encerrarCursoFormacao,
} from '../cursoFormacaoService.js';

// ---------------------------------------------------------------------------
// Fake in-memory base44.entities (mesmo contrato usado pelo cursoFormacaoService
// e pela edge function reverterPublicacaoPromocaoMilitarTx).
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
    async filter(query = {}) {
      return tabela(name).filter((r) => Object.entries(query).every(([k, v]) => r[k] === v));
    },
    async list({ query = {} } = {}) {
      return tabela(name).filter((r) => Object.entries(query).every(([k, v]) => r[k] === v));
    },
  });
  return {
    __stores: stores,
    entities: new Proxy({}, { get: (_t, name) => entity(name) }),
  };
}

const texto = (v) => String(v ?? '').trim();
const normalizar = (v) => texto(v).toLowerCase();
const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
const STATUS_PARTICIPANTE_PENDENTE_REANALISE = 'pendente_reanalise';

/**
 * Replica fielmente a lógica autoritativa da edge function
 * reverterPublicacaoPromocaoMilitarTx (re-leitura do banco + reversão segura +
 * desfazer vínculo com ParticipanteCursoFormacao). Mantida em sincronia com a
 * function para garantir o critério de aceite.
 */
async function reverterPublicacaoPromocaoMilitarTxSimulado(client, { promocao, item, motivo }) {
  const Historico = client.entities.HistoricoPromocaoMilitarV2;
  const PromocaoMilitar = client.entities.PromocaoMilitar;
  const Promocao = client.entities.Promocao;
  const Militar = client.entities.Militar;
  const ParticipanteCurso = client.entities.ParticipanteCursoFormacao;

  const promocaoId = texto(promocao?.id);
  const itemId = texto(item?.id);
  if (!promocaoId) return { status: 400, motivo: 'promocao_nao_carregada' };
  if (!itemId) return { status: 400, motivo: 'item_nao_carregado' };
  if (!texto(motivo)) return { status: 400, motivo: 'motivo_obrigatorio' };

  const itemAtual = await PromocaoMilitar.get(itemId);
  if (!itemAtual?.id) return { status: 404, motivo: 'promocao_militar_nao_encontrado' };

  const militarId = texto(itemAtual?.militar_id);
  const historicoId = texto(itemAtual?.historico_promocao_v2_id);

  const itemPublicado = Boolean(itemAtual?.publicado) || STATUS_PROMOCAO_PUBLICADA.has(normalizar(itemAtual?.status));
  if (!itemPublicado) return { status: 400, motivo: 'item_nao_publicado' };
  if (!historicoId) return { status: 400, motivo: 'historico_ausente' };

  const historicoAtual = await Historico.get(historicoId);
  if (!historicoAtual?.id) return { status: 404, motivo: 'historico_nao_encontrado' };

  const precisaRollbackCadastro = Boolean(itemAtual?.atualizar_cadastro_militar) || normalizar(itemAtual?.resultado_aplicacao_cadastro) === 'imediatamente_superior';

  // Vínculo com curso de formação
  const vinculos = await ParticipanteCurso.filter({ promocao_id: promocaoId, militar_id: militarId });
  const participante = (vinculos || []).find((p) => normalizar(p?.status) === 'promovido') || (vinculos || [])[0] || null;
  // Regra de produção: promovido -> pendente_reanalise (NÃO restaura automaticamente).
  const participanteEstaPromovido = participante ? normalizar(participante?.status) === 'promovido' : false;
  const statusPosReversao = STATUS_PARTICIPANTE_PENDENTE_REANALISE;

  await Historico.update(historicoId, { status_registro: 'cancelado', motivo_retificacao: motivo });
  if (precisaRollbackCadastro) {
    await Militar.update(militarId, {
      posto_graduacao: texto(historicoAtual?.posto_graduacao_anterior),
      quadro: texto(historicoAtual?.quadro_anterior),
    });
  }
  await PromocaoMilitar.update(itemId, { status: 'cancelado', publicado: false });
  if (participante?.id && participanteEstaPromovido) {
    await ParticipanteCurso.update(participante.id, { status: statusPosReversao, status_pre_publicacao: null });
    await client.entities.AuditCursoFormacao.create({
      participante_id: participante.id,
      acao: 'promocao_revertida_pendente_reanalise',
      status_anterior: 'promovido',
      status_novo: statusPosReversao,
      dados_novos: { promocao_id: promocaoId, promocao_militar_id: itemId },
    });
  }
  await Promocao.update(promocaoId, { status: 'rascunho' });

  return {
    status: 200,
    success: true,
    promocao_id: promocaoId,
    militar_id: militarId,
    promocao_militar_id: itemId,
    historico_promocao_v2_id: historicoId,
    participante_curso_id: participante?.id || null,
    cadastroRestaurado: precisaRollbackCadastro,
    participante_status_novo: (participante?.id && participanteEstaPromovido) ? statusPosReversao : null,
    participante_pendente_reanalise: Boolean(participante?.id && participanteEstaPromovido),
  };
}

/**
 * Simula a publicação oficial (publicarPromocaoOficial): cria Histórico V2,
 * atualiza cadastro do Militar (Soldado -> Cabo) e marca PromocaoMilitar
 * como publicado com historico_promocao_v2_id.
 */
async function publicarPromocaoSimulada(client, { promocao }) {
  const PromocaoMilitar = client.entities.PromocaoMilitar;
  const Historico = client.entities.HistoricoPromocaoMilitarV2;
  const Militar = client.entities.Militar;
  const itens = await PromocaoMilitar.filter({ promocao_id: promocao.id });
  for (const item of itens) {
    const militar = await Militar.get(item.militar_id);
    const historico = await Historico.create({
      militar_id: item.militar_id,
      promocao_id: promocao.id,
      posto_graduacao_anterior: militar?.posto_graduacao || 'Soldado',
      quadro_anterior: militar?.quadro || 'QBMP-1.a',
      posto_graduacao_novo: promocao.posto_graduacao,
      quadro_novo: promocao.quadro,
      status_registro: 'ativo',
    });
    await Militar.update(item.militar_id, { posto_graduacao: promocao.posto_graduacao, quadro: promocao.quadro });
    await PromocaoMilitar.update(item.id, {
      status: 'publicado',
      publicado: true,
      historico_promocao_v2_id: historico.id,
      atualizar_cadastro_militar: true,
      resultado_aplicacao_cadastro: 'imediatamente_superior',
    });
  }
  await client.entities.Promocao.update(promocao.id, { status: 'publicada' });
}

const usuario = { id: 'u1', full_name: 'Admin', email: 'admin@x.com' };
let client;

beforeEach(() => {
  client = criarFakeClient();
  __setCursoFormacaoClientForTests(client);
});

test('fluxo completo CFC: publicar promoção e reverter -> participante fica pendente_reanalise (mantendo promocao_id)', async () => {
  // Militar de teste (Soldado)
  await client.entities.Militar.create({ id: 'm1', nome_completo: 'João Teste', matricula: '999', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a', status_cadastro: 'Ativo' });
  const militarReg = client.__stores.Militar[0];
  const militarId = militarReg.id;

  // CFC + participante + aprovação
  const curso = await criarCursoFormacao({ nome: 'CFC 2026', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: militarId, nome_completo: 'João Teste', matricula: '999', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }], usuario);
  await alterarStatusParticipanteCurso(p.id, 'aprovado', '', usuario);

  // Gera promoção para Cabo
  const { promocao } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  assert.equal(promocao.posto_graduacao, 'Cabo');

  // Publica oficialmente
  await publicarPromocaoSimulada(client, { promocao });

  // Sincroniza participante como promovido (grava status_pre_publicacao = aprovado)
  const sync = await sincronizarParticipantesPromovidos(curso.id, usuario);
  assert.equal(sync.promovidos, 1);
  let participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'promovido');
  assert.equal(participantes[0].status_pre_publicacao, 'aprovado');
  assert.equal((await client.entities.Militar.get(militarId)).posto_graduacao, 'Cabo');

  // Reverte a publicação (item do banco, como a tela faz)
  const itemPublicado = client.__stores.PromocaoMilitar[0];
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, {
    promocao,
    item: { id: itemPublicado.id, militar_id: militarId },
    motivo: 'Erro material',
  });

  // Esperado: não retorna 400
  assert.equal(resultado.status, 200);
  assert.equal(resultado.success, true);
  assert.equal(resultado.participante_curso_id, p.id);

  // Militar volta para posto anterior (Soldado)
  assert.equal((await client.entities.Militar.get(militarId)).posto_graduacao, 'Soldado');
  // PromocaoMilitar deixa de estar publicado
  const pmDepois = await client.entities.PromocaoMilitar.get(itemPublicado.id);
  assert.equal(pmDepois.publicado, false);
  assert.equal(pmDepois.status, 'cancelado');
  // ParticipanteCursoFormacao deixa de estar promovido e fica pendente de reanálise
  participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'pendente_reanalise');
  assert.equal(participantes[0].promocao_id, promocao.id, 'promocao_id deve ser mantido para rastreabilidade');
  assert.ok(!participantes[0].status_pre_publicacao, 'status_pre_publicacao deve ser limpo após reversão');
  // Histórico oficial cancelado
  const hist = client.__stores.HistoricoPromocaoMilitarV2[0];
  assert.equal(hist.status_registro, 'cancelado');
  // Promoção reaberta como rascunho
  assert.equal((await client.entities.Promocao.get(promocao.id)).status, 'rascunho');
});

test('reversão usa historico_promocao_v2_id do banco mesmo se ausente no payload (sem 400)', async () => {
  await client.entities.Militar.create({ id: 'm1', nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a', status_cadastro: 'Ativo' });
  const militarId = client.__stores.Militar[0].id;
  const curso = await criarCursoFormacao({ nome: 'CFC', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: militarId, nome_completo: 'João', matricula: '1', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }], usuario);
  await alterarStatusParticipanteCurso(p.id, 'aprovado', '', usuario);
  const { promocao } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  await publicarPromocaoSimulada(client, { promocao });
  await sincronizarParticipantesPromovidos(curso.id, usuario);

  const itemPublicado = client.__stores.PromocaoMilitar[0];
  // Payload propositalmente SEM historico_promocao_v2_id (cenário do bug)
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, {
    promocao,
    item: { id: itemPublicado.id },
    motivo: 'Publicação indevida',
  });
  assert.equal(resultado.status, 200);
  assert.ok(resultado.historico_promocao_v2_id);
});

test('reversão de promoção manual (sem curso) continua funcionando e não toca participante', async () => {
  await client.entities.Militar.create({ id: 'm1', nome_completo: 'Manual', matricula: '5', posto_graduacao: 'Cabo', quadro: 'QBMP-1.a', status_cadastro: 'Ativo' });
  const militarId = client.__stores.Militar[0].id;
  const promocao = await client.entities.Promocao.create({ posto_graduacao: '3º Sargento', quadro: 'QBMP-1.a', status: 'publicada', origem: 'agrupamento' });
  await client.entities.PromocaoMilitar.create({ promocao_id: promocao.id, militar_id: militarId, status: 'elegivel', publicado: false });
  await publicarPromocaoSimulada(client, { promocao });

  const item = client.__stores.PromocaoMilitar[0];
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, {
    promocao,
    item: { id: item.id },
    motivo: 'Erro material',
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.participante_curso_id, null);
  assert.equal((await client.entities.Militar.get(militarId)).posto_graduacao, 'Cabo');
});

test('aguardando_nova_etapa -> promovido -> reversão -> pendente_reanalise (NÃO restaura)', async () => {
  await client.entities.Militar.create({ id: 'm1', nome_completo: 'Etapa', matricula: '7', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a', status_cadastro: 'Ativo' });
  const militarId = client.__stores.Militar[0].id;
  const curso = await criarCursoFormacao({ nome: 'CFC ETAPA', tipo: 'CFC' }, usuario);
  const [p] = await adicionarParticipantesCurso(curso.id, [{ id: militarId, nome_completo: 'Etapa', matricula: '7', posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }], usuario);
  await alterarStatusParticipanteCurso(p.id, 'aguardando_nova_etapa', 'Aguardando etapa seguinte', usuario);

  const { promocao } = await gerarPromocaoDosAprovados(curso.id, { quadro: 'QBMP-1.a', data_promocao: '2026-06-13' }, usuario);
  await publicarPromocaoSimulada(client, { promocao });
  await sincronizarParticipantesPromovidos(curso.id, usuario);

  let participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'promovido');

  const item = client.__stores.PromocaoMilitar[0];
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, { promocao, item: { id: item.id }, motivo: 'Erro' });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.participante_status_novo, 'pendente_reanalise');
  assert.equal(resultado.participante_pendente_reanalise, true);

  participantes = await listarParticipantesCurso(curso.id);
  assert.equal(participantes[0].status, 'pendente_reanalise');
  assert.ok(!participantes[0].status_pre_publicacao);
});

test('reversão registra auditoria promocao_revertida_pendente_reanalise', async () => {
  await client.entities.Militar.create({ id: 'm1', nome_completo: 'Audit', matricula: '8', posto_graduacao: 'Cabo', quadro: 'QBMP-1.a', status_cadastro: 'Ativo' });
  const militarId = client.__stores.Militar[0].id;
  const curso = await criarCursoFormacao({ nome: 'CFS AUDIT', tipo: 'CFS' }, usuario);
  const promocao = await client.entities.Promocao.create({ posto_graduacao: '3º Sargento', quadro: 'QBMP-1.a', status: 'publicada', origem: 'curso_formacao' });
  const participante = await client.entities.ParticipanteCursoFormacao.create({
    curso_id: curso.id, militar_id: militarId, status: 'promovido', promocao_id: promocao.id,
  });
  await client.entities.PromocaoMilitar.create({ promocao_id: promocao.id, militar_id: militarId, status: 'elegivel', publicado: false });
  await publicarPromocaoSimulada(client, { promocao });

  const item = client.__stores.PromocaoMilitar[0];
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, { promocao, item: { id: item.id }, motivo: 'Reversão' });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.participante_status_novo, 'pendente_reanalise');

  const part = await client.entities.ParticipanteCursoFormacao.get(participante.id);
  assert.equal(part.status, 'pendente_reanalise');
  assert.equal(part.promocao_id, promocao.id, 'promocao_id mantido');
  // Auditoria específica registrada
  const audit = client.__stores.AuditCursoFormacao.find((a) => a.acao === 'promocao_revertida_pendente_reanalise');
  assert.ok(audit, 'deve existir auditoria promocao_revertida_pendente_reanalise');
  assert.equal(audit.status_anterior, 'promovido');
  assert.equal(audit.status_novo, 'pendente_reanalise');
});

test('curso NÃO pode encerrar com participante pendente_reanalise', async () => {
  const curso = await criarCursoFormacao({ nome: 'CFC ENC', tipo: 'CFC' }, usuario);
  await client.entities.ParticipanteCursoFormacao.create({
    curso_id: curso.id, militar_id: 'm9', status: 'pendente_reanalise', promocao_id: 'promo9', snapshot_antiguidade: 1,
  });
  await assert.rejects(
    () => encerrarCursoFormacao(curso.id, usuario),
    /pendente.*reanálise|reanalise/i,
  );
});

test('reversão bloqueia quando motivo ausente', async () => {
  const resultado = await reverterPublicacaoPromocaoMilitarTxSimulado(client, {
    promocao: { id: 'x' },
    item: { id: 'y' },
    motivo: '',
  });
  assert.equal(resultado.status, 400);
  assert.equal(resultado.motivo, 'motivo_obrigatorio');
});

__resetCursoFormacaoClientForTests();