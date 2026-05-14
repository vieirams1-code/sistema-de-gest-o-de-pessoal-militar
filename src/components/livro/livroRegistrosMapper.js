import { format } from 'date-fns';
import { getTipoRegistroLabel } from '@/components/livro/livroTipoRegistroConfig';
import { aplicarTemplate, buildVarsLivro } from '@/components/utils/templateUtils';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';
import { getTipoFeriasOperacional, resolverTipoFeriasCanonico } from '@/components/ferias/feriasTipoResolver';

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
  return getTipoRegistroLabel(tipoRegistro);
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

export function getTextoPublicacaoRegistro({
  registro,
  ferias,
  periodo,
  militar,
  templatesAtivosLivro,
}) {
  if (registro?.texto_publicacao) return registro.texto_publicacao;

  const tipoCanonicoFerias = resolverTipoFeriasCanonico(registro?.tipo_registro);
  if (!tipoCanonicoFerias) return registro?.documento_texto || '';

  const tipoOperacionalFerias = getTipoFeriasOperacional(tipoCanonicoFerias);
  const templateAtivo = getTemplateAtivoPorTipo(tipoCanonicoFerias, 'Livro', templatesAtivosLivro);
  const templateComEscopo = getTemplateAtivoPorTipo(
    tipoCanonicoFerias,
    'Livro',
    templatesAtivosLivro,
    {
      grupamento_id: militar?.grupamento_id,
      subgrupamento_id: militar?.subgrupamento_id,
      subgrupamento_tipo: militar?.subgrupamento_tipo,
    }
  );
  const templateResolvido = templateComEscopo || templateAtivo;

  if (!templateResolvido?.template) {
    const templatesCompativeis = templatesAtivosLivro
      .filter((template) => resolverTipoFeriasCanonico(template?.tipo_registro) === tipoCanonicoFerias)
      .map((template) => ({
        id: template.id,
        nome: template.nome || '',
        tipo_registro: template.tipo_registro,
        ativo: template.ativo !== false,
        modulo: template.modulo,
      }));
    console.warn('[Publicacoes][Ferias][TemplateNaoEncontrado]', {
      registro_id: registro?.id,
      tipo_real_registro: registro?.tipo_registro || '',
      tipo_normalizado: tipoCanonicoFerias,
      tipo_operacional: tipoOperacionalFerias,
      modulo_buscado: 'Livro',
      templates_ativos_ferias: templatesCompativeis,
    });
    return registro?.documento_texto || '';
  }

  const vars = buildVarsLivro({
    ferias: {
      ...(ferias || {}),
      dias: registro?.dias ?? ferias?.dias,
      data_inicio: registro?.data_inicio || ferias?.data_inicio || registro?.data_registro,
      data_retorno: registro?.data_retorno || ferias?.data_retorno,
      data_interrupcao: registro?.data_registro || registro?.data_inicio || null,
      militar_nome: registro?.militar_nome || militar?.nome_completo || militar?.nome,
      militar_posto: registro?.militar_posto || militar?.posto_graduacao,
      militar_matricula: registro?.militar_matricula || militar?.matricula_atual || militar?.matricula,
      periodo_aquisitivo_ref: registro?.periodo_aquisitivo || ferias?.periodo_aquisitivo_ref || '',
      saldo_remanescente: registro?.saldo_remanescente ?? ferias?.saldo_remanescente,
      dias_gozados_interrupcao: registro?.dias_gozados ?? ferias?.dias_gozados_interrupcao,
    },
    dataRegistro: registro?.data_registro || registro?.data_inicio || '',
    periodo,
    interrupcaoInfo: {
      diasNoMomento: registro?.dias_no_momento ?? registro?.dias,
      diasGozados: registro?.dias_gozados,
      saldoRemanescente: registro?.saldo_remanescente,
      dataInterrupcao: registro?.data_registro || registro?.data_inicio || '',
    },
  });

  return aplicarTemplate(templateResolvido.template, vars);
}

function mapVinculos({ registro, ferias, periodo, cadeiaInfo }) {
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
    nome_completo:
      registro?.militar_nome_completo ||
      militar?.nome_completo ||
      militar?.nome ||
      registro?.militar_nome ||
      null,
    nome:
      militar?.nome ||
      militar?.nome_completo ||
      registro?.militar_nome_completo ||
      registro?.militar_nome ||
      null,
    nome_guerra:
      registro?.militar_nome_guerra ||
      militar?.nome_guerra ||
      militar?.militar_nome_guerra ||
      registro?.nome_guerra ||
      null,
    posto_graduacao: registro?.militar_posto || militar?.posto_graduacao || militar?.militar_posto || null,
    quadro: registro?.militar_quadro || militar?.quadro || null,
    matricula: militar?.matricula_atual || militar?.matricula || registro?.militar_matricula || militar?.militar_matricula || null,
    matricula_atual: militar?.matricula_atual || militar?.matricula || null,
    matricula_registro: registro?.militar_matricula || null,
  };
}

export function mapLivroRegistrosPresenter({ registros = [], militares = [], ferias = [], periodos = [] } = {}) {
  const registrosLista = Array.isArray(registros) ? registros : [];
  const militaresLista = Array.isArray(militares) ? militares : [];
  const feriasLista = Array.isArray(ferias) ? ferias : [];
  const periodosLista = Array.isArray(periodos) ? periodos : [];

  const militarById = new Map(militaresLista.map((item) => [item.id, item]));
  const feriasById = new Map(feriasLista.map((item) => [item.id, item]));
  const periodoById = new Map(periodosLista.map((item) => [item.id, item]));

  const registrosPorFerias = registrosLista.reduce((acc, item) => {
    if (!item?.ferias_id) return acc;
    if (!acc[item.ferias_id]) acc[item.ferias_id] = [];
    acc[item.ferias_id].push(item);
    return acc;
  }, {});


  const registrosLivro = registrosLista.map((registro) => {
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
    const textoPublicacaoPersistido = registro?.texto_publicacao || null;
    const textoPublicacaoLazyDisponivel = Boolean(
      textoPublicacaoPersistido ||
      registro?.documento_texto ||
      resolverTipoFeriasCanonico(registro?.tipo_registro)
    );

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
      texto_publicacao: textoPublicacaoPersistido,
      texto_publicacao_lazy_disponivel: textoPublicacaoLazyDisponivel,
      inconsistencia,
      cadeia_eventos,
    };
  });

  return { registros_livro: registrosLivro };
}
