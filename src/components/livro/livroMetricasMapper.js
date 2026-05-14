const STATUS_LABELS = {
  ativo: 'Ativo',
  aguardando_nota: 'Aguardando Nota',
  aguardando_publicacao: 'Aguardando Publicação',
  gerada: 'Gerada',
  inconsistente: 'Inconsistente',
};

function toCodigo(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function buildInconsistenciaResumo(registro) {
  const motivoCurto = registro?.inconsistencia_motivo_curto || registro?.motivo_inconsistencia || null;
  const detalhe = registro?.inconsistencia_detalhe || registro?.detalhe_inconsistencia || null;
  const status = String(registro?.status || '').toLowerCase();

  if (motivoCurto || detalhe || status.includes('inconsistente')) {
    return {
      existe: true,
      motivo_curto: motivoCurto || 'Inconsistência no registro',
    };
  }

  return { existe: false, motivo_curto: null };
}

function getStatusCodigoMetrica(registro, inconsistencia) {
  if (inconsistencia?.existe) return 'inconsistente';

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

function getStatusLabelMetrica(statusCodigo, registro) {
  return STATUS_LABELS[statusCodigo] || registro?.status || 'Ativo';
}

export function mapLivroRegistrosMetricasRP({ registros = [] } = {}) {
  return {
    registros_livro_metricas: registros.map((registro) => {
      const inconsistencia = buildInconsistenciaResumo(registro);
      const statusCodigo = getStatusCodigoMetrica(registro, inconsistencia);

      return {
        id: registro?.id || null,
        militar_id: registro?.militar_id || null,
        status_codigo: statusCodigo,
        status_label: getStatusLabelMetrica(statusCodigo, registro),
        status: registro?.status || null,
        status_publicacao: registro?.status_publicacao || null,
        nota_para_bg: registro?.nota_para_bg || null,
        numero_bg: registro?.numero_bg || null,
        data_bg: registro?.data_bg || null,
        created_date: registro?.created_date || null,
        updated_date: registro?.updated_date || null,
        inconsistencia,
      };
    }),
  };
}
