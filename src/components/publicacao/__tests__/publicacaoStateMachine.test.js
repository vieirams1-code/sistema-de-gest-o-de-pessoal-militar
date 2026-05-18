import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS_PUBLICACAO,
  calcularStatusPublicacaoRegistro,
  obterStatusCanonicoPublicacao,
} from '../publicacaoStateMachine.js';

test('obterStatusCanonicoPublicacao reutiliza status operacional normalizado antes do cálculo por campos', () => {
  assert.equal(
    obterStatusCanonicoPublicacao({
      status_calculado: 'aguardando_publicacao',
      numero_bg: '123',
      data_bg: '2026-05-18',
    }),
    STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO,
  );
});

test('obterStatusCanonicoPublicacao respeita a precedência do estado canônico usada pelo painel principal', () => {
  assert.equal(
    obterStatusCanonicoPublicacao({
      status_canonico: 'Publicado',
      status_calculado: 'Aguardando Nota',
      status_publicacao: 'Aguardando Publicação',
    }),
    STATUS_PUBLICACAO.PUBLICADO,
  );
});

test('obterStatusCanonicoPublicacao usa o cálculo por campos como fallback canônico', () => {
  const registro = { nota_para_bg: 'Nota nº 10' };

  assert.equal(
    obterStatusCanonicoPublicacao(registro),
    calcularStatusPublicacaoRegistro(registro),
  );
  assert.equal(
    obterStatusCanonicoPublicacao(registro),
    STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO,
  );
});
