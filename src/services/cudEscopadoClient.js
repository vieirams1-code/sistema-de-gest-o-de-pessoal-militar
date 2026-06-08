import { base44 as defaultBase44 } from '@/api/base44Client';
import { isDataIsoDateOnly } from '@/services/contratosDesignacaoMilitarService';

let client = defaultBase44;

export function __setCudEscopadoClientDepsForTests(newClient) {
  client = newClient;
}

export function __resetCudEscopadoClientDepsForTests() {
  client = defaultBase44;
}

// =====================================================================
// cudEscopadoClient — Backend Hardening Lote 1
// ---------------------------------------------------------------------
// Cliente frontend para a Deno Function `cudEscopado`.
// Substitui chamadas diretas a base44.entities.X.create/update/delete
// para entidades sensíveis com validação de escopo militar no backend.
//
// Allowlist (espelha o backend):
//   - Ferias
//   - PeriodoAquisitivo
//   - Atestado
//   - RegistroLivro
//   - PublicacaoExOfficio
//   - ContratoDesignacaoMilitar (create/update/delete controlado)
//
// Em caso de falha (403 fora do escopo, 400 payload inválido, etc.),
// uma exceção é lançada com mensagem amigável extraída de response.data.error.
// =====================================================================

const ENTIDADES_PERMITIDAS = new Set([
  'Ferias',
  'PeriodoAquisitivo',
  'Atestado',
  'RegistroLivro',
  'PublicacaoExOfficio',
  'CreditoExtraFerias',
  'ContratoDesignacaoMilitar',
  'PerfilPermissao',
  'UsuarioAcesso',
  'MilitarFuncao',
  'MilitarTag',
  'FeriasTag',
  'FuncaoMilitar',
  'TagGrupo',
  'Tag',
]);


const CAMPOS_DATA_ISO_POR_ENTIDADE = {
  MilitarTag: [
    'data_aplicacao',
    'data_remocao',
  ],
  FeriasTag: [
    'data_aplicacao',
    'data_remocao',
  ],
  MilitarFuncao: [
    'data_inicio',
    'data_fim',
  ],
  ContratoDesignacaoMilitar: [
    'data_inicio_contrato',
    'data_inclusao_para_ferias',
    'data_fim_contrato',
    'data_publicacao',
  ],
  MilitarFuncao: ['data_inicio', 'data_fim'],
  MilitarTag: ['data_aplicacao', 'data_remocao'],
  FeriasTag: ['data_aplicacao', 'data_remocao'],
};

function validarDatasIsoEntity(entityName, data = {}) {
  const campos = CAMPOS_DATA_ISO_POR_ENTIDADE[entityName] || [];
  campos.forEach((campo) => {
    const valor = data?.[campo];
    if (valor && !isDataIsoDateOnly(valor)) {
      throw new Error(`cudEscopado: ${campo} deve estar no formato ISO yyyy-MM-dd.`);
    }
  });
}

function assertEntidadePermitida(entityName) {
  if (!ENTIDADES_PERMITIDAS.has(entityName)) {
    throw new Error(`cudEscopado: entidade "${entityName}" não é permitida no cliente.`);
  }
}

function extrairMensagemErro(err, fallback) {
  const data = err?.response?.data || err?.data;
  if (data?.error) return data.error;
  if (typeof data === 'string' && data) return data;
  return err?.message || fallback;
}

async function invocar(payload) {
  let response;
  try {
    response = await client.functions.invoke('cudEscopado', payload);
  } catch (err) {
    const msg = extrairMensagemErro(err, 'Falha ao executar cudEscopado.');
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }

  const body = response?.data ?? response;
  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}

export async function criarEscopado(entityName, data) {
  assertEntidadePermitida(entityName);
  validarDatasIsoEntity(entityName, data || {});
  const resp = await invocar({ entityName, operation: 'create', data: data || {} });
  return resp?.data || resp;
}

export async function atualizarEscopado(entityName, registroId, data) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em atualizar.');
  validarDatasIsoEntity(entityName, data || {});
  const resp = await invocar({
    entityName,
    operation: 'update',
    registroId: String(registroId),
    data: data || {},
  });
  return resp?.data || resp;
}

export async function bulkEscopado(entityName, itens) {
  assertEntidadePermitida(entityName);
  if (!Array.isArray(itens)) throw new Error('cudEscopado: itens deve ser um array.');
  const resp = await invocar({
    entityName,
    operation: 'bulk',
    itens,
  });
  return resp?.data || resp;
}

export async function encerrarEscopado(entityName, registroId, data) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em encerrar.');
  const resp = await invocar({
    entityName,
    operation: 'encerrar',
    registroId: String(registroId),
    data: data || {},
  });
  return resp?.data || resp;
}

export async function removerEscopado(entityName, registroId, data) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em remover.');
  const resp = await invocar({
    entityName,
    operation: 'remover',
    registroId: String(registroId),
    data: data || {},
  });
  return resp?.data || resp;
}

export async function desativarEscopado(entityName, registroId, data) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em desativar.');
  const resp = await invocar({
    entityName,
    operation: 'desativar',
    registroId: String(registroId),
    data: data || {},
  });
  return resp?.data || resp;
}

export async function excluirEscopado(entityName, registroId) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em excluir.');
  const resp = await invocar({
    entityName,
    operation: 'delete',
    registroId: String(registroId),
  });
  return resp?.data || resp;
}