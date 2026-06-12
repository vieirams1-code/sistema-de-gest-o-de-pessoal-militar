import { base44 } from '@/api/base44Client';

/**
 * Cadastra um novo documento histórico integrando com o Google Drive.
 */
export async function cadastrarDocumentoHistorico({ militar_id, tipo_documento, data, file }) {
  // Invoca a função backend para gerenciar o upload e o salvamento do registro
  const response = await base44.functions.invoke('gerirAcervoHistorico', {
    militar_id,
    tipo_documento,
    data,
    file
  });

  const body = response?.data ?? response;
  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
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

/**
 * Lista todos os repositórios documentais.
 */
export async function listarRepositorios() {
  return await base44.entities.RepositorioDocumental.list('ordem_prioridade');
}
