import { base44 } from '@/api/base44Client';
import { AcervoHistoricoError } from './acervoHistoricoErrors.js';

function extrairStatusErro(error, response) {
  return response?.status || error?.status || error?.response?.status || null;
}

function extrairBodyErro(error, response) {
  return response?.data || error?.response?.data || error?.data || error;
}

function criarErroAcervo(body, status) {
  const code = body?.code || body?.error;
  const documento_existente = body?.documento_existente || body?.documento;
  const message = body?.message || body?.error || 'Erro ao salvar documento histórico.';
  return new AcervoHistoricoError(message, { status, code, documento_existente, data: body });
}

/**
 * Cadastra um novo documento histórico no storage oficial do SGP/Base44.
 */
export async function cadastrarDocumentoHistorico({ militar_id, tipo_documento, data, file }) {
  try {
    // Invoca a função backend para gerenciar o upload e o salvamento do registro
    const response = await base44.functions.invoke('gerirAcervoHistorico', {
      militar_id,
      tipo_documento,
      data,
      file
    });

    const body = response?.data ?? response;
    const status = extrairStatusErro(null, response);
    if (body?.error || body?.code) {
      throw criarErroAcervo(body, status);
    }
    return body;
  } catch (error) {
    if (error instanceof AcervoHistoricoError) throw error;
    const body = extrairBodyErro(error);
    const status = extrairStatusErro(error);
    if (body?.error || body?.code) {
      throw criarErroAcervo(body, status);
    }
    throw error;
  }
}

/**
 * Lista o acervo funcional histórico de um militar.
 * Apenas registros ativos (não excluídos) e com status ATIVO (não substituídos).
 */
export async function listarAcervoMilitar(militar_id) {
  return await base44.entities.AcervoFuncionalHistorico.filter({
    militar_id,
    ativo: true,
    status_documento: 'ATIVO',
    arquivado: false
  }, '-data_documento');
}

/**
 * Lista o histórico de versões de um documento.
 */
export async function listarHistoricoVersoes(substitui_documento_id) {
  if (!substitui_documento_id) return [];
  return await base44.entities.AcervoFuncionalHistorico.filter({
    substitui_documento_id,
    ativo: true
  }, '-versao');
}

/**
 * Exclui logicamente um documento do acervo.
 */
export async function excluirDocumentoHistorico(id, usuario_email) {
  return await base44.entities.AcervoFuncionalHistorico.update(id, {
    ativo: false,
    deleted_at: new Date().toISOString(),
    deleted_by: usuario_email
  });
}

/**
 * Restaura um documento da lixeira.
 */
export async function restaurarDocumentoHistorico(id) {
  return await base44.entities.AcervoFuncionalHistorico.update(id, {
    ativo: true,
    deleted_at: null,
    deleted_by: null
  });
}

/**
 * Arquiva definitivamente um documento (remove da lixeira).
 */
export async function arquivarDefinitivamenteAcervo(id) {
  return await base44.entities.AcervoFuncionalHistorico.update(id, {
    arquivado: true
  });
}

/**
 * Lista documentos na lixeira de um militar.
 */
export async function listarLixeiraAcervo(militar_id) {
  return await base44.entities.AcervoFuncionalHistorico.filter({
    militar_id,
    ativo: false,
    arquivado: false
  }, '-deleted_at');
}


export const TIPOS_DOCUMENTAIS_ACERVO = {
  ALTERACAO: 'ALTERACAO',
  CERTIDAO_COMPORTAMENTO: 'CERTIDAO_COMPORTAMENTO',
  DIVERSOS: 'DIVERSOS',
};

export const LABEL_TIPO_DOCUMENTAL_ACERVO = {
  ALTERACAO: 'Alterações',
  CERTIDAO_COMPORTAMENTO: 'Certidões',
  DIVERSOS: 'Diversos',
};

export function getArquivoUrlAcervo(documento = {}) {
  return documento?.arquivo_url || '';
}

export function contarDocumentosAcervo(acervo = []) {
  return acervo.reduce((acc, doc) => {
    if (!doc || doc.arquivado) return acc;
    const tipo = doc.tipo_documento;
    if (doc.ativo !== false && doc.status_documento === 'ATIVO') {
      if (tipo === TIPOS_DOCUMENTAIS_ACERVO.ALTERACAO) acc.alteracoes += 1;
      if (tipo === TIPOS_DOCUMENTAIS_ACERVO.CERTIDAO_COMPORTAMENTO) acc.certidoes += 1;
      if (tipo === TIPOS_DOCUMENTAIS_ACERVO.DIVERSOS) acc.diversos += 1;
      acc.total += 1;
    }
    if (doc.ativo === false && !doc.arquivado) acc.lixeira += 1;
    return acc;
  }, { alteracoes: 0, certidoes: 0, diversos: 0, total: 0, lixeira: 0 });
}

export function montarResumoAcervoPorMilitar({ militares = [], acervo = [] } = {}) {
  const documentosPorMilitar = new Map();
  for (const doc of acervo) {
    if (!doc?.militar_id) continue;
    const lista = documentosPorMilitar.get(doc.militar_id) || [];
    lista.push(doc);
    documentosPorMilitar.set(doc.militar_id, lista);
  }

  return militares.map((militar) => {
    const contadores = contarDocumentosAcervo(documentosPorMilitar.get(militar.id) || []);
    return {
      militar,
      militar_id: militar.id,
      nome: militar.nome_guerra || militar.nome_completo || '',
      nome_completo: militar.nome_completo || '',
      matricula: militar.matricula || '',
      unidade: militar.subgrupamento_nome || militar.grupamento_nome || militar.lotacao_atual || militar.lotacao || '',
      alteracoes: contadores.alteracoes,
      certidoes: contadores.certidoes,
      diversos: contadores.diversos,
      total: contadores.total,
      lixeira: contadores.lixeira,
      completo: contadores.alteracoes > 0 && contadores.certidoes > 0 && contadores.diversos > 0,
      parcial: contadores.total > 0 && !(contadores.alteracoes > 0 && contadores.certidoes > 0 && contadores.diversos > 0),
      semDocumentos: contadores.total === 0,
    };
  });
}

export function calcularIndicadoresAcervo(linhas = []) {
  return linhas.reduce((acc, linha) => {
    acc.efetivoTotal += 1;
    acc.totalAlteracoes += linha.alteracoes;
    acc.totalCertidoes += linha.certidoes;
    acc.totalDiversos += linha.diversos;
    acc.documentosLixeira += linha.lixeira;
    if (linha.total > 0) acc.militaresComDocumentos += 1;
    else acc.militaresSemDocumentos += 1;
    if (linha.completo) acc.documentacaoCompleta += 1;
    else if (linha.parcial) acc.documentacaoParcial += 1;
    else acc.semDocumentacao += 1;
    return acc;
  }, {
    efetivoTotal: 0,
    militaresComDocumentos: 0,
    militaresSemDocumentos: 0,
    totalAlteracoes: 0,
    totalCertidoes: 0,
    totalDiversos: 0,
    documentosLixeira: 0,
    documentacaoCompleta: 0,
    documentacaoParcial: 0,
    semDocumentacao: 0,
  });
}

export function filtrarResumoAcervo(linhas = [], filtros = {}) {
  const nome = String(filtros.nome || '').trim().toLowerCase();
  const matricula = String(filtros.matricula || '').trim().toLowerCase();
  const unidade = String(filtros.unidade || '').trim().toLowerCase();
  const tipo = filtros.tipo_documental || 'TODOS';
  const situacao = filtros.situacao || 'TODAS';

  return linhas.filter((linha) => {
    const textoNome = `${linha.nome} ${linha.nome_completo}`.toLowerCase();
    if (nome && !textoNome.includes(nome)) return false;
    if (matricula && !String(linha.matricula).toLowerCase().includes(matricula)) return false;
    if (unidade && !String(linha.unidade).toLowerCase().includes(unidade)) return false;
    if (tipo === TIPOS_DOCUMENTAIS_ACERVO.ALTERACAO && linha.alteracoes === 0) return false;
    if (tipo === TIPOS_DOCUMENTAIS_ACERVO.CERTIDAO_COMPORTAMENTO && linha.certidoes === 0) return false;
    if (tipo === TIPOS_DOCUMENTAIS_ACERVO.DIVERSOS && linha.diversos === 0) return false;
    if (situacao === 'COMPLETA' && !linha.completo) return false;
    if (situacao === 'PARCIAL' && !linha.parcial) return false;
    if (situacao === 'SEM_DOCUMENTACAO' && !linha.semDocumentos) return false;
    return true;
  });
}
