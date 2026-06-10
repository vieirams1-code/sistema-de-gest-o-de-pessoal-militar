import { obterStatusCanonicoPublicacao, STATUS_PUBLICACAO } from '../publicacao/publicacaoStateMachine.js';
import { vinculaRegistroAoMilitar } from '../../services/registrosMilitarMatcher.js';

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


export function normalizarDataISOFolhaAlteracoes(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return null;
  }

  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return null;
  const ano = dateObj.getUTCFullYear();
  const mes = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function toText(value) {
  return String(value || '').trim();
}

function getTextoOficialRegistroFolhaAlteracoes(item) {
  const camposPreferenciais = [
    'texto_publicacao',
    'texto_renderizado',
    'texto_oficial',
    'texto_base',
    'texto_complemento',
    'nota_para_bg',
    'observacoes',
    'descricao',
    'historico',
    'resumo',
    'titulo_evento',
    'tipo_registro',
    'tipo',
    'categoria',
  ];

  for (const campo of camposPreferenciais) {
    const valor = item?.[campo];
    if (typeof valor === 'string' && valor.trim()) {
      return valor.trim();
    }
  }

  return '';
}

function isRegistroDOEMS(item = {}) {
  const tipo = toText(item?.tipo_registro || item?.tipo || '');
  return tipo === 'Registro de Publicação DOEMS';
}

function extrairDadosBgFolhaAlteracoes(item = {}) {
  const numero = toText(item?.numero_bg || item?.publicacao?.numero_bg || item?.boletim_numero);
  const data = normalizarDataISOFolhaAlteracoes(item?.data_bg || item?.publicacao?.data_bg || item?.boletim_data);
  return {
    numero,
    data,
    completo: Boolean(numero && data),
  };
}

function montarReferenciaBoletimFolhaAlteracoes(item = {}) {
  if (isRegistroDOEMS(item)) {
    const edicao = toText(item.doems_edicao_numero);
    const dataPub = normalizarDataISOFolhaAlteracoes(item.data_publicacao || item.data_registro);
    const subtipo = toText(item.subtipo_geral);

    let base = '';
    if (edicao && dataPub) {
      const [ano, mes, dia] = dataPub.split('-');
      base = `DOEMS nº ${edicao}, de ${dia}/${mes}/${ano}`;
    } else if (edicao) {
      base = `DOEMS nº ${edicao}`;
    } else if (dataPub) {
      const [ano, mes, dia] = dataPub.split('-');
      base = `DOEMS de ${dia}/${mes}/${ano}`;
    }

    if (!base && !subtipo) return '';
    if (base && subtipo) return `${base}. Subtipo: ${subtipo}.`;
    if (base) return `${base}.`;
    return `Subtipo: ${subtipo}.`;
  }

  const bg = extrairDadosBgFolhaAlteracoes(item);
  if (!bg.completo) return '';
  const [ano, mes, dia] = bg.data.split('-');
  return `Boletim ${bg.numero}, de ${dia}/${mes}/${ano}`;
}

function registroPublicadoEmBgFolhaAlteracoes(item = {}) {
  const statusPublicado = obterStatusCanonicoPublicacao(item) === STATUS_PUBLICACAO.PUBLICADO;
  if (isRegistroDOEMS(item)) {
    return statusPublicado;
  }

  const bg = extrairDadosBgFolhaAlteracoes(item);
  return bg.completo && statusPublicado;
}

function getDataEventoFolhaAlteracoes(item = {}) {
  return normalizarDataISOFolhaAlteracoes(
    item?.data_bg ||
    item?.publicacao?.data_bg ||
    item?.data_publicacao ||
    item?.data_registro ||
    item?.data_evento ||
    item?.created_date
  );
}

export function montarEventoRegistroMilitarFolhaAlteracoes(item, dataEvento = getDataEventoFolhaAlteracoes(item)) {
  const textoOficial = getTextoOficialRegistroFolhaAlteracoes(item);
  if (!textoOficial) return null;

  const tipoPublicacao = item?.tipo_registro || item?.tipo || item?.categoria || 'Publicação';
  const origem = item?.origem_fonte || item?.origem || (item?.tipo_registro ? 'RegistroLivro' : 'PublicacaoExOfficio');

  let refIdentificador = '';
  if (isRegistroDOEMS(item)) {
    const edicao = toText(item.doems_edicao_numero);
    refIdentificador = edicao ? `DOEMS nº ${edicao}` : 'DOEMS';
  } else {
    const bgNumero = extrairDadosBgFolhaAlteracoes(item).numero;
    refIdentificador = bgNumero ? `BG ${bgNumero}` : '';
  }

  const descricao = [tipoPublicacao, refIdentificador].filter(Boolean).join(' - ');

  return {
    id: item.id,
    data: dataEvento,
    tipo: 'Publicação',
    texto: textoOficial,
    referenciaBoletim: montarReferenciaBoletimFolhaAlteracoes(item),
    descricao,
    origem,
  };
}

export function montarHistoricoFolhaAlteracoes({ registros = [], atestados = [], militar, dataInicial, dataFinal }) {
  const metricas = {
    brutos: registros.length + atestados.length,
    registrosBrutos: registros.length,
    atestadosBrutos: atestados.length,
    aposFiltroMilitar: 0,
    aposFiltroPeriodo: 0,
    aposFiltroStatusPublicacao: 0,
    chegaramAgrupamento: 0,
    renderizados: 0,
  };

  const noPeriodo = (data) => Boolean(data && data >= dataInicial && data <= dataFinal);
  const registrosDoMilitar = registros.filter((item) => vinculaRegistroAoMilitar(item, militar));
  const atestadosDoMilitar = atestados
    .filter((item) => vinculaRegistroAoMilitar(item, militar))
    .map((item) => ({ ...item, origem_fonte: item?.origem_fonte || 'Atestado' }));
  metricas.aposFiltroMilitar = registrosDoMilitar.length + atestadosDoMilitar.length;

  const candidatosComData = [...registrosDoMilitar, ...atestadosDoMilitar]
    .map((item) => ({ item, dataEvento: getDataEventoFolhaAlteracoes(item) }))
    .filter(({ dataEvento }) => noPeriodo(dataEvento));
  metricas.aposFiltroPeriodo = candidatosComData.length;

  const publicados = candidatosComData.filter(({ item }) => registroPublicadoEmBgFolhaAlteracoes(item));
  metricas.aposFiltroStatusPublicacao = publicados.length;

  const eventos = publicados
    .map(({ item, dataEvento }) => montarEventoRegistroMilitarFolhaAlteracoes(item, dataEvento))
    .filter(Boolean);

  const eventosDeduplicados = deduplicarEventosFolhaAlteracoes(eventos);
  metricas.chegaramAgrupamento = eventosDeduplicados.length;

  const historicoOrdenado = ordenarEventosFolhaAlteracoes(eventosDeduplicados);
  const agrupado = agruparHistoricoPorAnoMes(historicoOrdenado, dataInicial, dataFinal);
  metricas.renderizados = agrupado.reduce(
    (totalAno, ano) => totalAno + ano.meses.reduce((totalMes, mes) => totalMes + mes.eventos.length, 0),
    0
  );

  return { eventos: historicoOrdenado, agrupado, metricas };
}
