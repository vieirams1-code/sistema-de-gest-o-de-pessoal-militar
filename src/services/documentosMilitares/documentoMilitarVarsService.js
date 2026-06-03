import { calcularTempoServico, parseDateSafe } from '../tempoServicoService.js';

export const MODULO_DOCUMENTOS_MILITARES = 'DocumentosMilitares';

function textoSeguro(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  return '';
}

function primeiroTexto(...values) {
  for (const value of values) {
    const texto = textoSeguro(value);
    if (texto) return texto;
  }

  return '';
}

function textoDeReferencia(value) {
  if (!value || typeof value !== 'object') return textoSeguro(value);

  return primeiroTexto(
    value.nome,
    value.nome_completo,
    value.descricao,
    value.sigla,
    value.titulo
  );
}

export function formatarDataDocumentoMilitar(value) {
  const data = parseDateSafe(value);
  if (!data) return '';

  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarTempoServico(militar, dataReferencia) {
  const tempoServico = calcularTempoServico(militar, dataReferencia);
  if (!tempoServico.valido) return '';

  const anos = tempoServico.anos_completos;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

export function montarVariaveisDocumentoMilitar(militar = {}, { dataReferencia = new Date(), cidade = '' } = {}) {
  const fonte = militar && typeof militar === 'object' ? militar : {};

  return {
    nome_completo: primeiroTexto(fonte.nome_completo, fonte.nome),
    nome_guerra: primeiroTexto(fonte.nome_guerra, fonte.guerra),
    posto_graduacao: primeiroTexto(fonte.posto_graduacao, fonte.posto, fonte.graduacao),
    quadro: primeiroTexto(fonte.quadro, fonte.quadro_nome, fonte.militar_quadro),
    matricula: primeiroTexto(fonte.matricula_documental, fonte.matricula_operacional, fonte.matricula),
    cpf: textoSeguro(fonte.cpf),
    rg: textoSeguro(fonte.rg),
    data_nascimento: formatarDataDocumentoMilitar(primeiroTexto(fonte.data_nascimento, fonte.nascimento)),
    data_inclusao: formatarDataDocumentoMilitar(fonte.data_inclusao),
    lotacao: primeiroTexto(textoDeReferencia(fonte.lotacao), fonte.lotacao_nome),
    unidade: primeiroTexto(textoDeReferencia(fonte.unidade), fonte.unidade_nome, fonte.lotacao_unidade, fonte.unidade_atual),
    situacao: primeiroTexto(fonte.situacao, fonte.situacao_funcional, fonte.status_cadastro, fonte.status, fonte.situacao_militar),
    comportamento_atual: primeiroTexto(fonte.comportamento_atual, fonte.comportamento),
    data_promocao_atual: formatarDataDocumentoMilitar(primeiroTexto(
      fonte.data_promocao_atual,
      fonte.data_ultima_promocao,
      fonte.promocao_atual_data,
      fonte.data_promocao
    )),
    tempo_servico: formatarTempoServico(fonte, dataReferencia),
    data_atual: formatarDataDocumentoMilitar(dataReferencia),
    cidade: primeiroTexto(cidade, fonte.cidade, fonte.endereco?.cidade),
  };
}
