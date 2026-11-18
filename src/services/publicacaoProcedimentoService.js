import { base44 } from '@/api/base44Client';
import { criarEscopado } from '@/services/cudEscopadoClient';
import {
  calcularStatusPublicacaoRegistro,
  criarEventoAuditoriaPublicacao,
  EVENTO_AUDITORIA_PUBLICACAO,
  extrairSnapshotPublicacao,
  validarPayloadPublicacao,
} from '@/components/publicacao/publicacaoStateMachine';
import { aceitaPublicacaoSemMilitar, TIPOS_RP_PROCEDIMENTO } from '@/components/procedimentos/procedimentoPublicacao';

export async function enviarAnexoPublicacao(file) {
  const retorno = await base44.integrations.Core.UploadFile({ file });
  const url = String(retorno?.file_url || retorno?.url || retorno?.signedUrl || '').trim();
  if (!url) throw new Error('Não foi possível carregar o anexo.');
  return {
    doems_arquivo: url,
    doems_arquivo_bucket: String(retorno.storage_bucket || retorno.bucket || retorno.bucket_name || '').trim(),
    doems_arquivo_path: String(retorno.storage_object_path || retorno.object_path || retorno.path || '').trim(),
    doems_arquivo_nome: file.name,
    doems_arquivo_mime: file.type,
  };
}

export async function criarPublicacaoProcedimento(dados, usuario, carregarAnexo) {
  const texto_publicacao = dados.texto_publicacao?.trim();
  if (!dados.procedimento_id || !aceitaPublicacaoSemMilitar(dados.tipo)
    || (dados.tipo === TIPOS_RP_PROCEDIMENTO.prorrogacao) !== Boolean(dados.procedimento_prazo_id)) {
    throw new Error('Informe o procedimento e o ato vinculados à publicação.');
  }
  if (!dados.data_publicacao || !texto_publicacao) throw new Error('Informe a data e o texto da publicação.');
  if (/{{\s*[\w.]+\s*}}/.test(texto_publicacao)) throw new Error('Revise as variáveis que ainda aparecem no texto da publicação.');

  const registro = { ...dados, texto_publicacao, status: calcularStatusPublicacaoRegistro(dados) };
  const validacao = validarPayloadPublicacao({ registroDestino: registro });
  if (!validacao.valido) throw new Error(validacao.motivo);

  const anexo = carregarAnexo ? await carregarAnexo() : {};
  const evento = criarEventoAuditoriaPublicacao({
    registro: { ...registro, origem_tipo: 'ex-officio' },
    evento: EVENTO_AUDITORIA_PUBLICACAO.CRIACAO,
    usuario,
    resumo: 'Criação de publicação vinculada ao procedimento.',
    estadoNovo: registro.status,
    depois: extrairSnapshotPublicacao(registro),
    metadata: { procedimento_id: registro.procedimento_id },
  });
  return criarEscopado('PublicacaoExOfficio', {
    ...registro,
    ...anexo,
    historico_publicacao: [evento],
  });
}
