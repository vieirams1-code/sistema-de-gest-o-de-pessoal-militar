import { addDays, format } from 'date-fns';

const TIPOS_LIVRO_AFASTAMENTO = new Set([
  'Licença Maternidade',
  'Prorrogação de Licença Maternidade',
  'Licença Paternidade',
  'Núpcias',
  'Luto',
  'Dispensa Recompensa',
]);

function parseDateOnly(dateValue) {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function computeDataTerminoLivro(registro) {
  if (registro?.data_termino) return registro.data_termino;
  if (!registro?.data_inicio || !registro?.dias) return null;
  const inicio = parseDateOnly(registro.data_inicio);
  const dias = Number(registro.dias);
  if (!inicio || Number.isNaN(dias) || dias <= 0) return null;
  return format(addDays(inicio, dias - 1), 'yyyy-MM-dd');
}

function isAtestadoVigente(atestado, hoje) {
  const status = normalizeStatus(atestado?.status);
  if (status === 'cancelado' || status === 'encerrado') return false;
  const dataFim = parseDateOnly(atestado?.data_retorno || atestado?.data_termino);
  if (!dataFim) return status === 'ativo' || status === 'em curso';
  return hoje <= dataFim;
}

function getTipoAtestado(atestado) {
  const finalidade = normalizeText(atestado?.finalidade_jiso);
  if (finalidade.includes('ltspf')) return 'LTSPF';
  if (finalidade.includes('lts')) return 'LTS';
  return atestado?.tipo_afastamento || 'Atestado';
}

function mapAtestadosVigentes(atestados, hoje) {
  return atestados
    .filter((atestado) => isAtestadoVigente(atestado, hoje))
    .map((atestado) => {
      const dataInicio = atestado.data_inicio || atestado.data_atestado || null;
      const dataRetorno = atestado.data_retorno || atestado.data_termino || null;
      return {
        id: `atestado:${atestado.id}`,
        entidadeId: atestado.id,
        militarId: atestado.militar_id || null,
        militarNome: atestado.militar_nome || 'Militar não identificado',
        postoGraduacao: atestado.militar_posto || '-',
        tipoAfastamento: getTipoAtestado(atestado),
        origem: 'Atestado',
        dataInicio,
        dataTermino: dataRetorno,
        status: atestado.status || 'Ativo',
        statusDetalhado: atestado.status_jiso || null,
      };
    });
}

function mapFeriasVigentes(ferias) {
  return ferias
    .filter((item) => normalizeStatus(item?.status) === 'em curso')
    .map((item) => ({
      id: `ferias:${item.id}`,
      entidadeId: item.id,
      militarId: item.militar_id || null,
      militarNome: item.militar_nome || 'Militar não identificado',
      postoGraduacao: item.militar_posto || '-',
      tipoAfastamento: 'Férias',
      origem: 'Férias',
      dataInicio: item.data_inicio || null,
      dataTermino: item.data_retorno || item.data_fim || null,
      status: item.status || 'Em Curso',
      statusDetalhado: item.fracionamento || null,
    }));
}

function isRegistroLivroAfastamentoVigente(registro, hoje) {
  if (!TIPOS_LIVRO_AFASTAMENTO.has(registro?.tipo_registro)) return false;

  const status = normalizeStatus(registro?.status);
  if (['cancelado', 'encerrado', 'finalizado'].includes(status)) return false;

  const dataInicio = parseDateOnly(registro?.data_inicio || registro?.data_registro);
  if (!dataInicio || dataInicio > hoje) return false;

  const dataFim = parseDateOnly(registro?.data_retorno || computeDataTerminoLivro(registro));
  if (!dataFim) return true;

  return hoje <= dataFim;
}

function mapRegistroLivroVigentes(registros, hoje) {
  return registros
    .filter((registro) => isRegistroLivroAfastamentoVigente(registro, hoje))
    .map((registro) => ({
      id: `livro:${registro.id}`,
      entidadeId: registro.id,
      militarId: registro.militar_id || null,
      militarNome: registro.militar_nome || 'Militar não identificado',
      postoGraduacao: registro.militar_posto || '-',
      tipoAfastamento: registro.tipo_registro,
      origem: 'Livro',
      dataInicio: registro.data_inicio || registro.data_registro || null,
      dataTermino: registro.data_retorno || computeDataTerminoLivro(registro),
      status: registro.status || 'Ativo',
      statusDetalhado: registro.tipo_registro,
    }));
}

export function buildAfastamentosVigentes({ atestados = [], ferias = [], registrosLivro = [], hoje = new Date() } = {}) {
  const hojeNormalizado = new Date(hoje);
  hojeNormalizado.setHours(0, 0, 0, 0);

  const consolidados = [
    ...mapAtestadosVigentes(atestados, hojeNormalizado),
    ...mapFeriasVigentes(ferias),
    ...mapRegistroLivroVigentes(registrosLivro, hojeNormalizado),
  ];

  const deduplicados = Array.from(
    consolidados.reduce((acc, item) => {
      if (!acc.has(item.id)) acc.set(item.id, item);
      return acc;
    }, new Map()).values()
  );

  const ocorrenciasPorMilitar = deduplicados.reduce((acc, item) => {
    if (!item.militarId) return acc;
    acc[item.militarId] = (acc[item.militarId] || 0) + 1;
    return acc;
  }, {});

  return deduplicados.map((item) => ({
    ...item,
    possuiConflitoSimultaneo: item.militarId ? (ocorrenciasPorMilitar[item.militarId] || 0) > 1 : false,
  }));
}

export function sortAfastamentosByRetorno(a, b) {
  const fimA = parseDateOnly(a.dataTermino);
  const fimB = parseDateOnly(b.dataTermino);
  if (fimA && fimB) return fimA - fimB;
  if (fimA && !fimB) return -1;
  if (!fimA && fimB) return 1;

  const iniA = parseDateOnly(a.dataInicio);
  const iniB = parseDateOnly(b.dataInicio);
  if (iniA && iniB) return iniB - iniA;
  return 0;
}
