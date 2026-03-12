import { format } from 'date-fns';

const TIPO_LABELS = {
  'Saída Férias': 'Saída de Férias',
  'Retorno Férias': 'Retorno de Férias',
  'Interrupção de Férias': 'Interrupção de Férias',
  'Nova Saída / Retomada': 'Nova Saída / Retomada',
  'Dispensa com Desconto em Férias': 'Dispensa com Desconto em Férias',
};

const STATUS_LABELS = {
  ativo: 'Ativo',
  aguardando_nota: 'Aguardando Nota',
  aguardando_publicacao: 'Aguardando Publicação',
  gerada: 'Gerada',
  inconsistente: 'Inconsistente',
};

function parseDateOnly(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateBR(date) {
  const parsed = parseDateOnly(date);
  return parsed ? format(parsed, 'dd/MM/yyyy') : null;
}

function formatDateTimeBR(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'dd/MM/yyyy HH:mm');
}

function toCodigo(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function getTipoLabel(tipoRegistro) {
  if (TIPO_LABELS[tipoRegistro]) return TIPO_LABELS[tipoRegistro];
  return tipoRegistro || 'Registro';
}

function getStatusCodigo(registro, inconsistencia) {
  if (inconsistencia) return 'inconsistente';

  const statusRaw = String(registro?.status || '').trim();
  if (!statusRaw) {
    if (registro?.numero_bg && registro?.data_bg) return 'gerada';
    if (registro?.nota_para_bg) return 'aguardando_publicacao';
    return 'ativo';
  }

  const statusCodigo = toCodigo(statusRaw);
  if (statusCodigo === 'publicado') return 'gerada';
  return statusCodigo || 'ativo';
}

function getStatusLabel(statusCodigo, registro) {
  return STATUS_LABELS[statusCodigo] || registro?.status || 'Ativo';
}

function buildInconsistencia(registro) {
  const motivoCurto = registro?.inconsistencia_motivo_curto || registro?.motivo_inconsistencia || null;
  const detalhe = registro?.inconsistencia_detalhe || registro?.detalhe_inconsistencia || null;
  const status = String(registro?.status || '').toLowerCase();

  if (motivoCurto || detalhe || status.includes('inconsistente')) {
    return {
      motivo_curto: motivoCurto || 'Inconsistência no registro',
      detalhe: detalhe || 'Verifique os vínculos e os dados operacionais informados.',
    };
  }

  return null;
}

function getDataRange(registro, ferias) {
  const dataInicioIso = registro?.data_inicio || ferias?.data_inicio || registro?.data_registro || null;
  const dataFimIso = registro?.data_termino || ferias?.data_fim || null;
  const dataRetornoIso = registro?.data_retorno || ferias?.data_retorno || null;

  let dataDisplay = formatDateBR(dataInicioIso) || '-';
  if (dataInicioIso && dataFimIso) {
    dataDisplay = `${formatDateBR(dataInicioIso)} a ${formatDateBR(dataFimIso)}`;
  }

  return {
    data_display: dataDisplay,
    data_inicio_iso: dataInicioIso,
    data_fim_iso: dataFimIso,
    data_retorno_iso: dataRetornoIso,
  };
}

function sortByEventoDate(a, b) {
  const da = new Date(`${a?.data_registro || a?.data_inicio || '1900-01-01'}T00:00:00`).getTime();
  const db = new Date(`${b?.data_registro || b?.data_inicio || '1900-01-01'}T00:00:00`).getTime();
  if (da !== db) return da - db;
  return new Date(a?.created_date || 0).getTime() - new Date(b?.created_date || 0).getTime();
}

function mapCadeiaEventos(registro, cadeiaRaw) {
  const cadeia = [...cadeiaRaw].sort(sortByEventoDate);

  return {
    cadeia: {
      existe: cadeia.length > 0,
      total_eventos: cadeia.length,
    },
    cadeia_eventos: cadeia.map((evento) => ({
      id: evento.id,
      tipo: getTipoLabel(evento.tipo_registro),
      tipo_codigo: toCodigo(evento.tipo_registro),
      data: formatDateBR(evento.data_registro || evento.data_inicio) || '-',
      atual: evento.id === registro.id,
    })),
  };
}

function mapPublicacao(registro) {
  const hasPublicacao =
    !!registro?.publicacao_id ||
    !!registro?.numero_bg ||
    !!registro?.data_bg ||
    !!registro?.nota_para_bg ||
    !!registro?.texto_publicacao ||
    !!registro?.documento_texto;

  if (!hasPublicacao) return null;

  const publicacaoId = registro.publicacao_id || registro.id;
  const status = registro?.numero_bg && registro?.data_bg
    ? 'Gerada'
    : registro?.nota_para_bg
      ? 'Pendente'
      : 'Gerada';

  return {
    id: publicacaoId,
    status,
    nota_para_bg: registro?.nota_para_bg || null,
    numero_bg: registro?.numero_bg || null,
    data_bg: registro?.data_bg || null,
    texto: registro?.texto_publicacao || registro?.documento_texto || registro?.nota_para_bg || null,
    url: `/controle-publicacoes/${publicacaoId}`,
  };
}

function mapVinculos({ registro: _registro, ferias, periodo, cadeiaInfo }) {
  return {
    ferias: ferias
      ? {
          id: ferias.id,
          label: ferias.fracionamento
            ? `${ferias.fracionamento} (${Number(ferias.dias || 0)}d)`
            : `${Number(ferias.dias || 0)} dias`,
          url: `/modulo-ferias/${ferias.id}`,
        }
      : null,
    periodo: periodo
      ? {
          id: periodo.id,
          label: periodo.ano_referencia || periodo.periodo_aquisitivo_ref || ferias?.periodo_aquisitivo_ref || null,
          url: `/modulo-ferias/periodos/${periodo.id}`,
        }
      : null,
    cadeia: cadeiaInfo,
  };
}

function mapMilitar(registro, militar) {
  return {
    id: registro?.militar_id || militar?.id || null,
    nome_guerra: registro?.militar_nome || militar?.nome_guerra || militar?.militar_nome_guerra || null,
    posto_graduacao: registro?.militar_posto || militar?.posto_graduacao || militar?.militar_posto || null,
    matricula: registro?.militar_matricula || militar?.matricula || militar?.militar_matricula || null,
  };
}

export function mapLivroRegistrosPresenter({ registros = [], militares = [], ferias = [], periodos = [] } = {}) {
  const militarById = new Map(militares.map((item) => [item.id, item]));
  const feriasById = new Map(ferias.map((item) => [item.id, item]));
  const periodoById = new Map(periodos.map((item) => [item.id, item]));

  const registrosPorFerias = registros.reduce((acc, item) => {
    if (!item?.ferias_id) return acc;
    if (!acc[item.ferias_id]) acc[item.ferias_id] = [];
    acc[item.ferias_id].push(item);
    return acc;
  }, {});

  const registrosLivro = registros.map((registro) => {
    const militar = militarById.get(registro?.militar_id);
    const feriasRegistro = registro?.ferias_id ? feriasById.get(registro.ferias_id) : null;
    const periodoRegistro =
      periodoById.get(registro?.periodo_aquisitivo_id) ||
      periodoById.get(feriasRegistro?.periodo_aquisitivo_id) ||
      null;

    const inconsistencia = buildInconsistencia(registro);
    const statusCodigo = getStatusCodigo(registro, inconsistencia);
    const cadeiaRaw = registro?.ferias_id ? registrosPorFerias[registro.ferias_id] || [] : [];
    const { cadeia, cadeia_eventos } = mapCadeiaEventos(registro, cadeiaRaw);

    return {
      id: registro.id,
      tipo_codigo: toCodigo(registro?.tipo_registro),
      tipo_label: getTipoLabel(registro?.tipo_registro),
      origem: registro?.origem || (registro?.ferias_id ? 'Automática' : 'Manual'),
      ...getDataRange(registro, feriasRegistro),
      dias: Number(registro?.dias ?? feriasRegistro?.dias ?? 0),
      status_codigo: statusCodigo,
      status_label: getStatusLabel(statusCodigo, registro),
      militar: mapMilitar(registro, militar),
      detalhes: {
        observacoes: registro?.observacoes || null,
        criado_em: formatDateTimeBR(registro?.created_date),
        atualizado_em: formatDateTimeBR(registro?.updated_date),
        criado_em_iso: registro?.created_date || null,
        atualizado_em_iso: registro?.updated_date || null,
      },
      vinculos: mapVinculos({
        registro,
        ferias: feriasRegistro,
        periodo: periodoRegistro,
        cadeiaInfo: cadeia,
      }),
      publicacao: mapPublicacao(registro),
      inconsistencia,
      cadeia_eventos,
    };
  });

  return { registros_livro: registrosLivro };
}
