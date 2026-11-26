import { base44 } from '@/api/base44Client';

const ENTIDADE = 'DiarioOficialConciliacao';

export async function listarDiariosConciliacao() {
  const lista = await base44.entities[ENTIDADE].list('-data_publicacao', 200);
  return Array.isArray(lista) ? lista : [];
}

/** Guarda o PDF (armazenamento privado) e o resumo da leitura, sem duplicar diário já arquivado. */
export async function arquivarDiarioConciliacao({ arquivo, numeroEdicao, dataPublicacao, leitura, usuario }) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: arquivo });
  const numeroLimpo = String(numeroEdicao || '').trim();
  const dados = {
    numero_edicao: numeroLimpo,
    data_publicacao: dataPublicacao,
    arquivo_nome: arquivo.name,
    arquivo_uri: file_uri,
    arquivo_tamanho: arquivo.size,
    total_paginas: leitura?.totalPaginas || 0,
    total_trechos: leitura?.trechos?.length || 0,
    trechos_truncados: Boolean(leitura?.truncado),
    importado_por_email: usuario?.email || '',
  };

  const existentes = await base44.entities[ENTIDADE].filter({
    numero_edicao: numeroLimpo,
    data_publicacao: dataPublicacao,
  });

  if (Array.isArray(existentes) && existentes.length) {
    const registro = await base44.entities[ENTIDADE].update(existentes[0].id, dados);
    return { registro, jaExistia: true };
  }

  const registro = await base44.entities[ENTIDADE].create({ ...dados, status: 'Em análise' });
  return { registro, jaExistia: false };
}

export async function salvarAnaliseIaDiario(registroId, { resultado, usuario }) {
  if (!registroId) return null;
  const atual = await base44.entities[ENTIDADE].get(registroId).catch(() => null);
  return base44.entities[ENTIDADE].update(registroId, {
    analise_ia_json: JSON.stringify(resultado),
    analise_ia_em: new Date().toISOString(),
    analise_ia_por_email: usuario?.email || '',
    trechos_com_sugestao: resultado?.sugestoes?.length || 0,
    analise_ia_chamadas: Number(atual?.analise_ia_chamadas || 0) + 1,
    status: 'Em conciliação',
  });
}

export async function registrarImportacaoDiario(registroId, totalImportados) {
  if (!registroId) return null;
  return base44.entities[ENTIDADE].update(registroId, {
    trechos_importados: Number(totalImportados) || 0,
  });
}

export async function atualizarStatusDiario(registroId, status) {
  const dados = { status };
  if (status === 'Concluído') dados.concluido_em = new Date().toISOString();
  return base44.entities[ENTIDADE].update(registroId, dados);
}

export async function obterUrlArquivoDiario(fileUri) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 600 });
  return signed_url;
}