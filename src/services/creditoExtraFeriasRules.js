export const TIPOS_CREDITO_EXTRA_FERIAS = {
  DOACAO_SANGUE: 'DOACAO_SANGUE',
  RECOMPENSA: 'RECOMPENSA',
  TAF_10: 'TAF_10',
  DECISAO_ADMINISTRATIVA: 'DECISAO_ADMINISTRATIVA',
  OUTRO: 'OUTRO',
};

export const STATUS_CREDITO_EXTRA_FERIAS = {
  DISPONIVEL: 'DISPONIVEL',
  VINCULADO: 'VINCULADO',
  USADO: 'USADO',
  CANCELADO: 'CANCELADO',
};

export function criarPayloadCreditoExtraFerias(input = {}, militar = {}) {
  return {
    militar_id: input.militar_id || militar.id || '',
    militar_nome: input.militar_nome || militar.nome_completo || '',
    militar_posto: input.militar_posto || militar.posto_grad || '',
    militar_matricula: input.militar_matricula || militar.matricula || '',
    tipo_credito: input.tipo_credito || TIPOS_CREDITO_EXTRA_FERIAS.OUTRO,
    quantidade_dias: Number(input.quantidade_dias || 0),
    data_referencia: input.data_referencia || '',
    origem_documental: input.origem_documental || '',
    numero_boletim: input.numero_boletim || '',
    data_boletim: input.data_boletim || '',
    observacoes: input.observacoes || '',
    status: input.status || STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
    gozo_ferias_id: input.gozo_ferias_id || null,
  };
}

export function calcularTotaisGozoComCreditos({ diasBase = 0, creditos = [] }) {
  const base = Number(diasBase || 0);
  const extras = (creditos || []).reduce((acc, credito) => acc + Number(credito?.quantidade_dias || 0), 0);

  return {
    dias_base_gozo: base,
    dias_extras_creditos: extras,
    dias_totais_gozo: base + extras,
  };
}

export function validarCreditosSelecionadosParaGozo({ creditos = [], idsSelecionados = [], militarId, gozoFeriasId = null }) {
  const ids = new Set(idsSelecionados || []);
  const selecionados = (creditos || []).filter((credito) => ids.has(credito.id));

  for (const credito of selecionados) {
    if (credito.militar_id !== militarId) {
      throw new Error('Crédito extraordinário não pertence ao militar selecionado.');
    }

    if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO) {
      throw new Error('Crédito cancelado não pode ser vinculado ao gozo.');
    }

    const jaVinculadoOutroGozo = credito.gozo_ferias_id && gozoFeriasId && credito.gozo_ferias_id !== gozoFeriasId;

    if (jaVinculadoOutroGozo || credito.status === STATUS_CREDITO_EXTRA_FERIAS.USADO) {
      throw new Error('Crédito extraordinário já utilizado em outro gozo.');
    }
  }

  return selecionados;
}

export function formatarTipoCreditoExtra(tipo) {
  const mapa = {
    DOACAO_SANGUE: 'Doação de Sangue',
    RECOMPENSA: 'Recompensa',
    TAF_10: 'TAF 10',
    DECISAO_ADMINISTRATIVA: 'Decisão Administrativa',
    OUTRO: 'Outro',
  };
  return mapa[tipo] || tipo || '—';
}
