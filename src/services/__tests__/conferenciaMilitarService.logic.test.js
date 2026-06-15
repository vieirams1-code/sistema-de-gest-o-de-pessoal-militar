import test from 'node:test';
import assert from 'node:assert';

const TIPO_LABELS = {
  ingresso: 'Ingresso',
  reativacao: 'Reativação',
};

const mockService = {
  gerarItensPadraoConferencia: (tipo) => {
    if (tipo === 'ingresso') return Array(10).fill({});
    if (tipo === 'reativacao') return Array(9).fill({});
    return [];
  },
  calcularProgresso: (itens) => {
    const total = itens.length;
    const concluídos = itens.filter(i => i.status !== 'pendente').length;
    return Math.round((concluídos / total) * 100);
  },
  validarConclusao: (itens) => {
    const pendentes = itens.filter(i => i.obrigatorio && (i.status === 'pendente' || i.status === 'em_andamento'));
    if (pendentes.length > 0) return { error: true };

    const comPendenciasResiduais = itens.some(i => ['revisar', 'nao_localizado', 'pendente_justificado'].includes(i.status));
    return { error: false, status: comPendenciasResiduais ? 'concluida_com_pendencias' : 'concluida' };
  },
  buscarConferenciaAberta: (conferencias, militarId) => {
    const tiposBloqueantes = ['ingresso', 'reativacao', 'retorno_transferencia'];
    return conferencias.find(c =>
      c.militar_id === militarId &&
      ['pendente', 'em_andamento'].includes(c.status) &&
      tiposBloqueantes.includes(c.tipo_conferencia)
    ) || null;
  }
};

test('Business Rule: Ingresso generates 10 items', () => {
  const itens = mockService.gerarItensPadraoConferencia('ingresso');
  assert.strictEqual(itens.length, 10);
});

test('Business Rule: Reativação generates 9 items', () => {
  const itens = mockService.gerarItensPadraoConferencia('reativacao');
  assert.strictEqual(itens.length, 9);
});

test('Business Rule: Progress calculation', () => {
  const itens = [
    { status: 'conferido' },
    { status: 'pendente' },
    { status: 'pendente' },
    { status: 'pendente' },
  ];
  assert.strictEqual(mockService.calcularProgresso(itens), 25);
});

test('Business Rule: Conclusion validation - cannot conclude if mandatory pending', () => {
  const itens = [
    { obrigatorio: true, status: 'pendente' }
  ];
  const res = mockService.validarConclusao(itens);
  assert.strictEqual(res.error, true);
});

test('Business Rule: Conclusion status - with pendencies', () => {
  const itens = [
    { obrigatorio: true, status: 'conferido' },
    { status: 'revisar' }
  ];
  const res = mockService.validarConclusao(itens);
  assert.strictEqual(res.status, 'concluida_com_pendencias');
});

test('Business Rule: Conclusion status - fully concluded', () => {
  const itens = [
    { obrigatorio: true, status: 'conferido' },
    { status: 'cadastrado' }
  ];
  const res = mockService.validarConclusao(itens);
  assert.strictEqual(res.status, 'concluida');
});

test('Business Rule: Duplicate prevention logic', () => {
  const conferencias = [
    { militar_id: '123', status: 'pendente', tipo_conferencia: 'ingresso' },
    { militar_id: '456', status: 'concluida', tipo_conferencia: 'ingresso' }
  ];

  // Encontra aberta para 123
  assert.notStrictEqual(mockService.buscarConferenciaAberta(conferencias, '123'), null);

  // Não encontra para 456 (já concluída)
  assert.strictEqual(mockService.buscarConferenciaAberta(conferencias, '456'), null);

  // Não encontra para 789 (inexistente)
  assert.strictEqual(mockService.buscarConferenciaAberta(conferencias, '789'), null);
});
