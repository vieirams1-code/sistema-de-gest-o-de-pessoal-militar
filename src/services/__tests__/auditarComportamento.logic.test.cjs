const assert = require('node:assert');
const test = require('node:test');

// Mock do ambiente Deno e SDK Base44 para testar apenas a lógica
// Como a lógica foi colada no arquivo entry.ts, vamos replicá-la aqui para o teste unitário.

const PRACAS = new Set([
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
]);

const STATUS_EXCLUIDOS = new Set(['ANULADA']);
const STATUS_REABILITADA = 'REABILITADA';

const TIPOS_PUNICAO_VALIDOS = new Set([
  'ADVERTENCIA',
  'ADVERTENCIA VERBAL',
  'REPREENSAO',
  'DETENCAO',
  'PRISAO',
  'PRISAO EM SEPARADO',
]);

const TIPO_PESO_PRISAO = {
  'PRISAO': 1,
  'PRISAO EM SEPARADO': 1,
  'DETENCAO': 0.5,
  'REPREENSAO': 0.25,
  'ADVERTENCIA': 0,
  'ADVERTENCIA VERBAL': 0,
};

function normalizeText(texto = '') {
  return String(texto)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function toDate(dateLike) {
  if (!dateLike) return null;
  if (dateLike instanceof Date) return Number.isNaN(dateLike.getTime()) ? null : dateLike;
  const raw = String(dateLike).trim();
  if (!raw) return null;
  const matchBR = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBR) {
    const [, dd, mm, yyyy] = matchBR;
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateISO(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function addYears(baseDate, years) {
  const date = new Date(baseDate);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function subtractYears(baseDate, years) {
  return addYears(baseDate, -years);
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function getStatusPunicao(punicao = {}) {
  return String(punicao.status_punicao || punicao.status || 'Ativa').trim();
}

function getTipoPunicao(punicao = {}) {
  return String(punicao.tipo_punicao || punicao.tipo || '').trim();
}

function getDataBasePunicao(punicao = {}) {
  return (
    punicao.data_fim_cumprimento ||
    punicao.data_termino ||
    punicao.data_punicao ||
    punicao.data_aplicacao ||
    null
  );
}

function normalizePunicao(punicao = {}) {
  const tipo = getTipoPunicao(punicao);
  const tipoNormalizado = normalizeText(tipo);
  const pesoPrisao = TIPO_PESO_PRISAO[tipoNormalizado] ?? 0;
  const dataBase = toDate(getDataBasePunicao(punicao));
  return {
    ...punicao,
    status_resolvido: getStatusPunicao(punicao),
    tipo_resolvido: tipo,
    tipo_normalizado: tipoNormalizado,
    data_base: dataBase,
    data_base_iso: formatDateISO(dataBase),
    prisao_equivalente: pesoPrisao,
    detencao_equivalente: pesoPrisao * 2,
  };
}

function isPunicaoValida(punicao, config = {}) {
  const status = normalizeText(getStatusPunicao(punicao));
  const tipo = normalizeText(getTipoPunicao(punicao));
  if (!TIPOS_PUNICAO_VALIDOS.has(tipo)) return false;
  if (STATUS_EXCLUIDOS.has(status)) return false;
  if (!config.incluirReabilitadas && status === normalizeText(STATUS_REABILITADA)) return false;
  return true;
}

function isInWindow(date, start, end) {
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function summarizeWindowWithStart(punicoesNormalizadas, inicio, fim, anos) {
  const dentroJanela = punicoesNormalizadas.filter((p) => isInWindow(p.data_base, inicio, fim));
  const prisao_equivalente = dentroJanela.reduce((acc, p) => acc + p.prisao_equivalente, 0);
  const detencao_equivalente = dentroJanela.reduce((acc, p) => acc + p.detencao_equivalente, 0);
  return {
    periodo_anos: anos,
    inicio: formatDateISO(inicio),
    fim: formatDateISO(fim),
    quantidade: dentroJanela.length,
    prisao_equivalente,
    detencao_equivalente,
  };
}

function getServiceYears(dataInclusao, referencia) {
  if (!dataInclusao || !referencia) return 0;
  let anos = referencia.getFullYear() - dataInclusao.getFullYear();
  const mes = referencia.getMonth() - dataInclusao.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < dataInclusao.getDate())) {
    anos -= 1;
  }
  return Math.max(anos, 0);
}

function resolveComportamentoPorJanelas(j1, j2, j4, j8, elegibilidade = {}) {
  const podeSerOtimo = elegibilidade?.otimo ?? true;
  const podeSerExcepcional = elegibilidade?.excepcional ?? true;

  if (j1.prisao_equivalente > 2) return { comportamento: 'Mau', fundamento: 'Mau Fundamento' };
  if (j1.prisao_equivalente === 2) return { comportamento: 'Insuficiente', fundamento: 'Insuficiente Fundamento' };

  if (podeSerExcepcional && j8.quantidade === 0) {
    return { comportamento: 'Excepcional', fundamento: 'Excepcional Fundamento' };
  }

  if (podeSerOtimo && j4.detencao_equivalente <= 1) {
    return { comportamento: 'Ótimo', fundamento: 'Ótimo Fundamento' };
  }

  return { comportamento: 'Bom', fundamento: 'Bom Fundamento' };
}

function calcularComportamento(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  const referencia = toDate(hoje) || new Date();
  const dataInclusao = toDate(config.dataInclusaoMilitar || config.data_inclusao || null);
  const punicoesEntrada = Array.isArray(punicoes) ? punicoes : [];
  const punicoesValidas = punicoesEntrada
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base)
    .sort((a, b) => a.data_base - b.data_base);

  const construirJanela = (anos) => {
    const inicioLegal = subtractYears(referencia, anos);
    const inicio = dataInclusao && dataInclusao > inicioLegal ? dataInclusao : inicioLegal;
    return summarizeWindowWithStart(punicoesValidas, inicio, referencia, anos);
  };

  const janela_1_ano = construirJanela(1);
  const janela_2_anos = construirJanela(2);
  const janela_4_anos = construirJanela(4);
  const janela_8_anos = construirJanela(8);
  const tempoServicoAnos = getServiceYears(dataInclusao, referencia);
  const elegibilidade = {
    bom: !dataInclusao || tempoServicoAnos >= 2,
    otimo: !dataInclusao || tempoServicoAnos >= 4,
    excepcional: !dataInclusao || tempoServicoAnos >= 8,
  };

  return resolveComportamentoPorJanelas(janela_1_ano, janela_2_anos, janela_4_anos, janela_8_anos, elegibilidade);
}

function estimarDataInicioComportamentoAtual(punicoes, postoGraduacao, dataInclusaoMilitar, hoje, comportamentoCalculado) {
    const referencia = toDate(hoje) || new Date();
    const dataInclusao = toDate(dataInclusaoMilitar);
    if (!dataInclusao) return null;

    const punicoesValidas = (Array.isArray(punicoes) ? punicoes : [])
        .filter((p) => isPunicaoValida(p))
        .map(normalizePunicao)
        .filter((p) => p.data_base);

    const datasCandidadasSet = new Set();
    datasCandidadasSet.add(dataInclusao.getTime());
    [2, 4, 8].forEach(anos => {
        const d = addDays(addYears(dataInclusao, anos), 1);
        if (d <= referencia) datasCandidadasSet.add(d.getTime());
    });
    punicoesValidas.forEach(p => {
        if (p.data_base <= referencia) datasCandidadasSet.add(p.data_base.getTime());
        [1, 2, 4, 8].forEach(anos => {
            const d = addDays(addYears(p.data_base, anos), 1);
            if (d <= referencia) datasCandidadasSet.add(d.getTime());
        });
    });
    datasCandidadasSet.add(referencia.getTime());

    const datasOrdenadas = Array.from(datasCandidadasSet)
        .map(ts => new Date(ts))
        .sort((a, b) => a.getTime() - b.getTime());

    let dataInicioEstimada = null;
    for (let i = datasOrdenadas.length - 1; i >= 0; i--) {
        const dataTeste = datasOrdenadas[i];
        const res = calcularComportamento(punicoes, postoGraduacao, dataTeste, { data_inclusao: dataInclusaoMilitar });
        if (res && res.comportamento === comportamentoCalculado) {
            dataInicioEstimada = dataTeste;
        } else {
            break;
        }
    }
    return dataInicioEstimada ? formatDateISO(dataInicioEstimada) : null;
}

test('Regra do Ótimo corrigida: deve ser Ótimo se tiver 0 punições em 4 anos e >= 4 anos de serviço (mas < 8 anos)', () => {
  const hoje = new Date('2024-01-01T00:00:00');
  const dataInclusao = '2019-01-01'; // 5 anos de serviço
  const punicoes = []; // Nenhuma punição

  const resultado = calcularComportamento(punicoes, 'Cabo', hoje, { data_inclusao: dataInclusao });
  assert.strictEqual(resultado.comportamento, 'Ótimo');
});

test('Estimativa de data de início: deve identificar a data de inclusão se nenhum comportamento anterior mudou', () => {
    const hoje = new Date('2024-01-01T00:00:00');
    const dataInclusao = '2023-01-01';
    const punicoes = []; // Bom
    const compCalculado = 'Bom';

    const dataInicio = estimarDataInicioComportamentoAtual(punicoes, 'Cabo', dataInclusao, hoje, compCalculado);
    assert.strictEqual(dataInicio, '2023-01-01');
});

test('Estimativa de data de início: deve identificar marco de tempo de serviço (Ótimo aos 4 anos)', () => {
    const hoje = new Date('2024-01-01T00:00:00');
    const dataInclusao = '2019-01-01'; // Completa 4 anos em 2023-01-01
    const punicoes = []; // Ótimo
    const compCalculado = 'Ótimo';

    const dataInicio = estimarDataInicioComportamentoAtual(punicoes, 'Cabo', dataInclusao, hoje, compCalculado);
    assert.strictEqual(dataInicio, '2023-01-02'); // inclusao + 4 anos + 1 dia
});

test('Estimativa de data de início: deve identificar expiração de punição (Bom -> Ótimo após 4 anos)', () => {
    const hoje = new Date('2024-01-01T00:00:00');
    const dataInclusao = '2010-01-01';
    const punicoes = [
        { tipo: 'DETENCAO', data_punicao: '2015-01-01' }, // Expira para janela de 4 anos em 2019-01-01
        { tipo: 'DETENCAO', data_punicao: '2018-01-01' }  // Permanece na janela de 8 anos até 2026
    ];
    const compCalculado = 'Ótimo';

    const dataInicio = estimarDataInicioComportamentoAtual(punicoes, 'Cabo', dataInclusao, hoje, compCalculado);
    assert.strictEqual(dataInicio, '2019-01-02'); // Primeira punicao + 4 anos + 1 dia
});
