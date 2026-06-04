import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularStatusPublicacaoLegado,
  STATUS_PUBLICACAO_LEGADO,
} from '../migracaoAlteracoesLegadoStatusPublicacao.js';

test('calcularStatusPublicacaoLegado: retorna PUBLICADO quando todos os campos obrigatórios estão preenchidos', () => {
  const dados = {
    numero_nota: '123/2023',
    numero_bg_br: '100',
    data_bg_br: '2023-10-27',
  };

  const status = calcularStatusPublicacaoLegado(dados);

  assert.equal(status, STATUS_PUBLICACAO_LEGADO.PUBLICADO);
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO quando numero_nota está ausente', () => {
  const dados = {
    numero_bg_br: '100',
    data_bg_br: '2023-10-27',
  };

  const status = calcularStatusPublicacaoLegado(dados);

  assert.equal(status, STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO);
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO quando numero_bg_br está ausente', () => {
  const dados = {
    numero_nota: '123/2023',
    data_bg_br: '2023-10-27',
  };

  const status = calcularStatusPublicacaoLegado(dados);

  assert.equal(status, STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO);
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO quando data_bg_br está ausente', () => {
  const dados = {
    numero_nota: '123/2023',
    numero_bg_br: '100',
  };

  const status = calcularStatusPublicacaoLegado(dados);

  assert.equal(status, STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO);
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO quando os campos estão vazios ou apenas com espaços', () => {
  assert.equal(
    calcularStatusPublicacaoLegado({ numero_nota: '', numero_bg_br: '100', data_bg_br: '2023-10-27' }),
    STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO
  );
  assert.equal(
    calcularStatusPublicacaoLegado({ numero_nota: '123', numero_bg_br: '  ', data_bg_br: '2023-10-27' }),
    STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO
  );
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO quando os campos são null ou undefined', () => {
  assert.equal(
    calcularStatusPublicacaoLegado({ numero_nota: null, numero_bg_br: '100', data_bg_br: '2023-10-27' }),
    STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO
  );
  assert.equal(
    calcularStatusPublicacaoLegado({ numero_nota: '123', numero_bg_br: undefined, data_bg_br: '2023-10-27' }),
    STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO
  );
});

test('calcularStatusPublicacaoLegado: retorna AGUARDANDO_PUBLICACAO para objeto vazio ou sem argumentos', () => {
  assert.equal(calcularStatusPublicacaoLegado({}), STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO);
  assert.equal(calcularStatusPublicacaoLegado(), STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO);
});
