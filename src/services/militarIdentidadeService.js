let runtimeClient = null;
let clientPromise = null;

export function __setMilitarIdentidadeClientForTests(client) {
  runtimeClient = client || null;
  clientPromise = client ? Promise.resolve(client) : null;
}

async function ensureClient() {
  if (runtimeClient) return runtimeClient;
  if (clientPromise) return clientPromise;
  clientPromise = import('../api/base44Client.js').then((mod) => mod.base44);
  return clientPromise;
}

export const STATUS_POSSIVEL_DUPLICIDADE = {
  PENDENTE: 'PENDENTE',
  CONFIRMADO_DUPLICADO: 'CONFIRMADO_DUPLICADO',
  DESCARTADO: 'DESCARTADO',
  MESCLADO: 'MESCLADO',
};

const onlyDigits = (value = '') => String(value || '').replace(/\D/g, '');

export function normalizarMatricula(value = '') {
  return onlyDigits(value).slice(0, 9);
}

export function formatarMatriculaPadrao(value = '') {
  const digits = normalizarMatricula(value);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizarCPF(value = '') {
  const digits = onlyDigits(value);
  return digits.length === 11 ? digits : '';
}

export function normalizarNomeCanonico(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

async function invokeGateway(action, payload = {}) {
  const client = await ensureClient();
  if (!client?.functions?.invoke) throw new Error('Gateway de identidade militar indisponível.');

  try {
    const response = await client.functions.invoke('militarIdentidadeGateway', { action, payload });
    const body = response?.data ?? response ?? {};
    if (body?.error) {
      const error = new Error(body.error);
      if (body?.status) error.status = body.status;
      throw error;
    }
    return body?.result ?? null;
  } catch (error) {
    const body = error?.response?.data;
    if (body?.error) {
      const normalized = new Error(body.error);
      normalized.status = error?.response?.status || error?.status;
      throw normalized;
    }
    throw error;
  }
}

export async function validarMatriculaDisponivel(matricula, excludeMilitarId = '') {
  return invokeGateway('VALIDATE_MATRICULA', { matricula, excludeMilitarId });
}

export async function localizarDuplicidadeForte({ cpf, nomeCanonico, dataNascimento, excludeMilitarId = '' }) {
  return invokeGateway('FIND_DUPLICATE', { cpf, nomeCanonico, dataNascimento, excludeMilitarId });
}

export async function criarMilitarComMatricula(payload = {}, { origemRegistro = 'manual' } = {}) {
  return invokeGateway('CREATE_MILITAR', { data: payload, origemRegistro });
}

export async function carregarMilitarParaEdicao(militarId) {
  const result = await invokeGateway('GET_MILITAR_FOR_EDIT', { militarId });
  return {
    militar: result?.militar || null,
    matriculas: Array.isArray(result?.matriculas) ? result.matriculas : [],
    sensitiveFieldsIncluded: result?.sensitiveFieldsIncluded === true,
  };
}

export async function atualizarMilitarSemTrocarMatricula(militarId, payload = {}) {
  return invokeGateway('UPDATE_MILITAR', { militarId, data: payload });
}

export async function adicionarNovaMatriculaMilitar({
  militarId,
  matricula,
  tipoMatricula = 'Secundária',
  motivo = 'Nova matrícula vinculada',
  origemRegistro = 'manual',
  dataInicio = '',
}) {
  return invokeGateway('ADD_MATRICULA', {
    militarId,
    matricula,
    tipoMatricula,
    motivo,
    origemRegistro,
    dataInicio,
  });
}

export async function listarPendenciasPossivelDuplicidade({ status = STATUS_POSSIVEL_DUPLICIDADE.PENDENTE } = {}) {
  const result = await invokeGateway('LIST_DUPLICATES', { status });
  return Array.isArray(result) ? result : [];
}

export async function resolverPendenciaPossivelDuplicidade({ pendenciaId, status }) {
  return invokeGateway('RESOLVE_DUPLICATE', { pendenciaId, status });
}

export async function executarMergeManualMilitares({
  militarOrigemId,
  militarDestinoId,
  motivo,
  pendenciaId = '',
} = {}) {
  return invokeGateway('MERGE', {
    militarOrigemId,
    militarDestinoId,
    motivo,
    pendenciaId,
  });
}

export async function migrarMatriculasLegadas({ dryRun = true } = {}) {
  return invokeGateway('MIGRATE_LEGACY_MATRICULAS', { dryRun });
}
