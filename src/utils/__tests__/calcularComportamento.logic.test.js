import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularComportamento } from '../calcularComportamento.js';

const HOJE = new Date('2024-05-20T12:00:00Z');

test('C1.1: Praça com mais de 8 anos de serviço e sem punições válidas nos últimos 8 anos deve retornar Excepcional', () => {
  const dataInclusao = '2010-01-01';
  const punicoes = [];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Excepcional');
});

test('C1.2: Praça com mais de 8 anos de serviço e uma repreensão há 7 anos e 11 meses deve retornar Ótimo', () => {
  const dataInclusao = '2010-01-01';
  // 2024-05 - 7 anos 11 meses = 2016-06 approx
  const punicoes = [{ tipo: 'REPREENSAO', data_punicao: '2016-06-20', status: 'Ativa' }];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Ótimo');
});

test('C1.3: Praça com mais de 8 anos de serviço e uma repreensão há 4 anos e 1 dia deve retornar Ótimo', () => {
  const dataInclusao = '2010-01-01';
  // HOJE é 2024-05-20. 4 anos e 1 dia atrás é 2020-05-19
  const punicoes = [{ tipo: 'REPREENSAO', data_punicao: '2020-05-19', status: 'Ativa' }];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Ótimo');
});

test('C1.4: Praça com mais de 4 anos de serviço e uma repreensão recente deve retornar Ótimo, se a equivalência permanecer até 1 detenção', () => {
  const dataInclusao = '2018-01-01';
  // Repreensão recente
  const punicoes = [{ tipo: 'REPREENSAO', data_punicao: '2024-01-01', status: 'Ativa' }];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Ótimo');
});

test('C1.5: Praça com mais de 4 anos (ex: 5 anos) de serviço e SEM punição deve retornar Ótimo (atualmente retorna Bom - BUG)', () => {
  const dataInclusao = '2019-01-01';
  const punicoes = [];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  // Este teste deve falhar antes da correção (vai retornar 'Bom')
  assert.strictEqual(resultado.comportamento, 'Ótimo');
});

test('C1.5.1: Praça com menos de 4 anos de serviço e sem punição não deve retornar Ótimo', () => {
  const dataInclusao = '2022-01-01'; // 2 anos de serviço
  const punicoes = [];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Bom');
});

test('C1.6: Exatamente 2 prisões equivalentes em 1 ano deve retornar Insuficiente', () => {
  const dataInclusao = '2010-01-01';
  // 1 PRISAO = 1 prisao equivalente. 2 PRISOES = 2.
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'Ativa' }
  ];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Insuficiente');
});

test('C1.7: Mais de 2 prisões equivalentes em 1 ano deve retornar Mau', () => {
  const dataInclusao = '2010-01-01';
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-03-01', status: 'Ativa' }
  ];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Mau');
});

test('C1.8: Punições anuladas não devem ser consideradas', () => {
  const dataInclusao = '2010-01-01';
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'ANULADA' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'ANULADA' },
    { tipo: 'PRISAO', data_punicao: '2024-03-01', status: 'ANULADA' }
  ];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Excepcional');
});

test('C1.9: Punições reabilitadas devem continuar respeitando o comportamento atual da função', () => {
  const dataInclusao = '2010-01-01';
  const punicoes = [
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'REABILITADA' }
  ];
  // Por padrão incluirReabilitadas é false
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Excepcional');

  const resultadoComReab = calcularComportamento(punicoes, 'Soldado', HOJE, {
    dataInclusaoMilitar: dataInclusao,
    incluirReabilitadas: true
  });
  // 1 PRISAO em 1 ano.
  // resolveComportamentoPorJanelas:
  // if (j1.prisao_equivalente > 2) return Mau
  // if (j1.prisao_equivalente === 2) return Insuficiente
  // if (j8.quantidade === 0) return Excepcional
  // if Ótimo (detencao_equivalente <= 1 em 4 anos)
  // 1 PRISAO = 2 detencoes equivalentes. Então Ótimo falha.
  // So with 1 PRISAO, it should be Bom (if > 2 years service)
  assert.strictEqual(resultadoComReab.comportamento, 'Bom');
});

test('C1.10: Art 53: Soldado punido com prisão em separado superior a 20 dias deve retornar Mau', () => {
  const dataInclusao = '2010-01-01';
  const punicoes = [
    {
      tipo: 'PRISAO EM SEPARADO',
      data_punicao: '2015-01-01',
      status: 'Ativa',
      dias: 21,
      em_separado: true
    }
  ];
  const resultado = calcularComportamento(punicoes, 'Soldado', HOJE, { dataInclusaoMilitar: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Mau');
  assert.match(resultado.fundamento, /Art. 53/);
});

test('C5.1: mais de 8 anos e apenas Advertência deve ser Excepcional sem punição considerada', () => {
  const resultado = calcularComportamento(
    [{ tipo: 'ADVERTENCIA', data_punicao: '2024-01-01', status: 'Ativa' }],
    'Soldado',
    HOJE,
    { dataInclusaoMilitar: '2010-01-01' }
  );

  assert.strictEqual(resultado.comportamento, 'Excepcional');
  assert.strictEqual(resultado.detalhes.total_punicoes_consideradas, 0);
  assert.strictEqual(resultado.detalhes.janela_8_anos.quantidade, 0);
});

test('C5.1: mais de 8 anos e apenas Advertência verbal deve ser Excepcional', () => {
  const resultado = calcularComportamento(
    [{ tipo: 'ADVERTENCIA VERBAL', data_punicao: '2024-01-01', status: 'Ativa' }],
    'Soldado',
    HOJE,
    { dataInclusaoMilitar: '2010-01-01' }
  );

  assert.strictEqual(resultado.comportamento, 'Excepcional');
  assert.strictEqual(resultado.detalhes.janela_8_anos.quantidade, 0);
});

test('C5.1: Advertência não impede Ótimo quando Repreensão está dentro de 8 anos e fora de 4 anos', () => {
  const resultado = calcularComportamento(
    [
      { tipo: 'ADVERTENCIA', data_punicao: '2024-01-01', status: 'Ativa' },
      { tipo: 'REPREENSAO', data_punicao: '2019-05-01', status: 'Ativa' }
    ],
    'Soldado',
    HOJE,
    { dataInclusaoMilitar: '2010-01-01' }
  );

  assert.strictEqual(resultado.comportamento, 'Ótimo');
  assert.strictEqual(resultado.detalhes.janela_8_anos.quantidade, 1);
  assert.strictEqual(resultado.detalhes.janela_4_anos.quantidade, 0);
});

test('C5.1: Repreensão, Detenção, Prisão e Prisão em separado continuam impactando', () => {
  const dataInclusaoMilitar = '2010-01-01';

  const repreensao = calcularComportamento([{ tipo: 'REPREENSAO', data_punicao: '2024-01-01', status: 'Ativa' }], 'Soldado', HOJE, { dataInclusaoMilitar });
  assert.strictEqual(repreensao.detalhes.janela_8_anos.quantidade, 1);
  assert.strictEqual(repreensao.comportamento, 'Ótimo');

  const detencoes = calcularComportamento([
    { tipo: 'DETENCAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'DETENCAO', data_punicao: '2024-02-01', status: 'Ativa' }
  ], 'Soldado', HOJE, { dataInclusaoMilitar });
  assert.strictEqual(detencoes.comportamento, 'Bom');

  const prisoes = calcularComportamento([
    { tipo: 'PRISAO', data_punicao: '2024-01-01', status: 'Ativa' },
    { tipo: 'PRISAO', data_punicao: '2024-02-01', status: 'Ativa' }
  ], 'Soldado', HOJE, { dataInclusaoMilitar });
  assert.strictEqual(prisoes.comportamento, 'Insuficiente');

  const prisaoEmSeparado = calcularComportamento([{ tipo: 'PRISAO EM SEPARADO', data_punicao: '2015-01-01', status: 'Ativa', dias: 21, em_separado: true }], 'Soldado', HOJE, { dataInclusaoMilitar });
  assert.strictEqual(prisaoEmSeparado.comportamento, 'Mau');
});
