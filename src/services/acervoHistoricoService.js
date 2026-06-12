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
 */
export async function listarAcervoMilitar(militar_id) {
  return await base44.entities.AcervoFuncionalHistorico.filter({
    militar_id,
    arquivado: false
  }, '-data_documento');
}

/**
 * Lista todos os repositórios documentais.
 */
export async function listarRepositorios() {
  return await base44.entities.RepositorioDocumental.list('ordem_prioridade');
}
