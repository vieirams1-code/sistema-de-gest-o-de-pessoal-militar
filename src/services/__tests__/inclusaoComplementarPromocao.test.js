import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  montarPayloadAdicaoManualTurma,
  reverterPublicacaoPromocaoMilitar,
  MENSAGEM_BLOQUEIO_REVERSAO_CURSO,
} from '../promocaoService.js';

// Replica a marcação de origem aplicada na UI (DetalhePromocao) quando a
// promoção já está publicada. Mantém publicado=false e status=elegivel.
const STATUS_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado', 'publicada_parcial']);
const ehPublicada = (promocao) => STATUS_PUBLICADA.has(String(promocao?.status || '').toLowerCase());

function adicionarMilitarUI({ promocao, militar, militarId, registrosExistentes = [] }) {
  const payload = montarPayloadAdicaoManualTurma({ promocao, militar, militarId, registrosExistentes });
  if (ehPublicada(promocao)) payload.origem = 'inclusao_complementar';
  return payload;
}

test('promoção publicada + adicionar militar → origem = inclusao_complementar', () => {
  const payload = adicionarMilitarUI({
    promocao: { id: 'p1', status: 'publicada', posto_graduacao: '3º Sargento', quadro: 'QPPM' },
    militar: { id: 'm1', posto_graduacao: 'Cabo', quadro: 'QPPM' },
    militarId: 'm1',
  });
  assert.equal(payload.origem, 'inclusao_complementar');
});

test('militar novo em promoção publicada permanece publicado=false e status=elegivel', () => {
  const payload = adicionarMilitarUI({
    promocao: { id: 'p1', status: 'publicada', posto_graduacao: '3º Sargento', quadro: 'QPPM' },
    militar: { id: 'm1', posto_graduacao: 'Cabo', quadro: 'QPPM' },
    militarId: 'm1',
  });
  assert.equal(payload.publicado, false);
  assert.equal(payload.status, 'elegivel');
});

test('promoção em rascunho NÃO marca origem inclusao_complementar', () => {
  const payload = adicionarMilitarUI({
    promocao: { id: 'p1', status: 'rascunho', posto_graduacao: '3º Sargento', quadro: 'QPPM' },
    militar: { id: 'm1', posto_graduacao: 'Cabo', quadro: 'QPPM' },
    militarId: 'm1',
  });
  assert.equal(payload.origem, 'adicao_manual');
});

test('reversão comum continua funcionando após inclusão complementar', async () => {
  let historicoUpdate = 0;
  const entities = {
    HistoricoPromocaoMilitarV2: { get: async () => ({ id: 'h1' }), update: async () => { historicoUpdate += 1; } },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };
  await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1' },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Erro material',
  });
  assert.equal(historicoUpdate, 1);
});

test('promoção originada de curso continua bloqueada na UI (guarda de reversão)', async () => {
  const entities = {
    HistoricoPromocaoMilitarV2: { get: async () => ({ id: 'h1' }), update: async () => {} },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
    ParticipanteCursoFormacao: {
      filter: async () => [{ id: 'part-1', status: 'promovido', promocao_id: 'p1', militar_id: 'm1' }],
    },
  };
  await assert.rejects(
    () => reverterPublicacaoPromocaoMilitar({
      promocao: { id: 'p1' },
      item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1' },
      itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
      entities,
      motivo: 'Erro material',
    }),
    new RegExp(MENSAGEM_BLOQUEIO_REVERSAO_CURSO.slice(0, 30)),
  );
});

test('DetalhePromocao exibe banner e badge de inclusão complementar e botão "Publicar complementares"', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  assert.ok(detalhePromocao.includes('Novos militares adicionados serão tratados como inclusão complementar'));
  assert.ok(detalhePromocao.includes('Inclusão complementar'));
  assert.ok(detalhePromocao.includes('Publicar complementares'));
  assert.ok(detalhePromocao.includes("payload.origem = 'inclusao_complementar'"));
});