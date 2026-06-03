const MESES_FOLHA_ALTERACOES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

export function listarMesesNoPeriodoFolhaAlteracoes(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal || dataInicial > dataFinal) return [];

  const [anoInicio, mesInicio] = dataInicial.split('-').map(Number);
  const [anoFim, mesFim] = dataFinal.split('-').map(Number);

  const itens = [];
  let anoAtual = anoInicio;
  let mesAtual = mesInicio;

  while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
    itens.push({
      ano: anoAtual,
      mes: mesAtual,
      chave: `${anoAtual}-${String(mesAtual).padStart(2, '0')}`,
      titulo: `MÊS DE ${MESES_FOLHA_ALTERACOES[mesAtual - 1]}/${anoAtual}`,
    });

    mesAtual += 1;
    if (mesAtual > 12) {
      mesAtual = 1;
      anoAtual += 1;
    }
  }

  return itens;
}

export function deduplicarEventosFolhaAlteracoes(eventos = []) {
  const idsConhecidos = new Set();
  const eventosPreservados = [];

  eventos.forEach((evento) => {
    const id = String(evento?.id || '').trim();
    const origem = String(evento?.origem || '').trim();

    if (id && origem) {
      const chave = `${origem}-${id}`;
      if (idsConhecidos.has(chave)) return;
      idsConhecidos.add(chave);
    }

    eventosPreservados.push(evento);
  });

  return eventosPreservados;
}

export function ordenarEventosFolhaAlteracoes(eventos = []) {
  return eventos
    .map((evento, index) => ({ evento, index }))
    .sort((a, b) => {
      const comparacaoData = String(a.evento?.data || '').localeCompare(String(b.evento?.data || ''));
      if (comparacaoData !== 0) return comparacaoData;
      return a.index - b.index;
    })
    .map(({ evento }) => evento);
}

export function agruparHistoricoPorAnoMes(eventos, dataInicial, dataFinal) {
  const meses = listarMesesNoPeriodoFolhaAlteracoes(dataInicial, dataFinal);
  const agrupadoPorAno = new Map();

  meses.forEach((mesInfo) => {
    if (!agrupadoPorAno.has(mesInfo.ano)) {
      agrupadoPorAno.set(mesInfo.ano, []);
    }

    const eventosDoMes = ordenarEventosFolhaAlteracoes(
      eventos.filter((evento) => {
        if (!evento?.data) return false;
        return evento.data.startsWith(mesInfo.chave);
      })
    );

    agrupadoPorAno.get(mesInfo.ano).push({
      ...mesInfo,
      eventos: eventosDoMes,
    });
  });

  return Array.from(agrupadoPorAno.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ano, mesesDoAno]) => ({ ano, meses: mesesDoAno }));
}
