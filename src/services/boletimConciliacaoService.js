import { base44 } from '@/api/base44Client';

const ENTIDADE = 'BoletimConciliacao';

export function calcularMetricasBoletim(leitura, auditoria) {
  const notas = leitura?.notas || [];
  const comRelacionados = notas.filter(nota => nota.relacionados?.encontrada);
  const militaresRelacionados = comRelacionados.reduce(
    (total, nota) => total + (nota.relacionados?.militares || []).filter(item => !item.responsavel_pelo_ato).length,
    0
  );

  return {
    total_paginas: leitura?.totalPaginas || 0,
    total_notas: notas.length,
    notas_com_relacionados: comRelacionados.length,
    militares_relacionados: militaresRelacionados,
    notas_sem_militar: auditoria?.notasSemMilitar?.length || 0,
    paginas_sem_texto: leitura?.paginasSemTexto?.length || 0,
  };
}

export async function listarBoletinsConciliacao() {
  const lista = await base44.entities[ENTIDADE].list('-data_boletim', 200);
  return Array.isArray(lista) ? lista : [];
}

/** Guarda o PDF (armazenamento privado) e o resumo da leitura, sem duplicar boletim já arquivado. */
export async function arquivarBoletimConciliacao({ arquivo, tipo, numero, dataBoletim, leitura, auditoria, usuario }) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: arquivo });
  const numeroLimpo = String(numero || '').trim();
  const dados = {
    tipo,
    numero: numeroLimpo,
    data_boletim: dataBoletim,
    arquivo_nome: arquivo.name,
    arquivo_uri: file_uri,
    arquivo_tamanho: arquivo.size,
    ...calcularMetricasBoletim(leitura, auditoria),
    importado_por_email: usuario?.email || '',
  };

  const existentes = await base44.entities[ENTIDADE].filter({
    tipo,
    numero: numeroLimpo,
    data_boletim: dataBoletim,
  });

  if (Array.isArray(existentes) && existentes.length) {
    const registro = await base44.entities[ENTIDADE].update(existentes[0].id, dados);
    return { registro, jaExistia: true };
  }

  const registro = await base44.entities[ENTIDADE].create({ ...dados, status: 'Em análise' });
  return { registro, jaExistia: false };
}

export async function atualizarStatusBoletimConciliacao(registroId, status) {
  const dados = { status };
  if (status === 'Concluído') dados.concluido_em = new Date().toISOString();
  return base44.entities[ENTIDADE].update(registroId, dados);
}

export async function obterUrlArquivoBoletim(fileUri) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 600 });
  return signed_url;
}