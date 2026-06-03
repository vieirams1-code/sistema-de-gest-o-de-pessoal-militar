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


function dataDeReferencia(value) {
  if (!value || typeof value !== 'object') return textoSeguro(value);

  return primeiroTexto(
    value.data,
    value.date,
    value.valor,
    value.value,
    value.data_nascimento,
    value.dataNascimento,
    value.nascimento,
    value.nascimento_data,
    value.data_promocao_atual,
    value.dataPromocaoAtual,
    value.data_promocao,
    value.dataPromocao,
    value.data_ultima_promocao,
    value.dataUltimaPromocao
  );
}

function textoDeReferencia(value) {
  if (!value || typeof value !== 'object') return textoSeguro(value);

  return primeiroTexto(
    value.nome,
    value.nome_completo,
    value.descricao,
    value.sigla,
    value.titulo,
    value.estrutura_nome,
    value.grupamento_nome,
    value.subgrupamento_nome
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
    data_nascimento: formatarDataDocumentoMilitar(primeiroTexto(
      dataDeReferencia(fonte.data_nascimento),
      dataDeReferencia(fonte.dataNascimento),
      dataDeReferencia(fonte.nascimento),
      dataDeReferencia(fonte.data_nasc),
      dataDeReferencia(fonte.data_de_nascimento),
      dataDeReferencia(fonte.dataDeNascimento),
      dataDeReferencia(fonte.dt_nascimento),
      dataDeReferencia(fonte.nascimento_data),
      dataDeReferencia(fonte.nascimentoData),
      dataDeReferencia(fonte.dados_pessoais?.data_nascimento),
      dataDeReferencia(fonte.dados_pessoais?.dataNascimento),
      dataDeReferencia(fonte.dadosPessoais?.data_nascimento),
      dataDeReferencia(fonte.dadosPessoais?.dataNascimento)
    )),
    data_inclusao: formatarDataDocumentoMilitar(fonte.data_inclusao),
    lotacao: primeiroTexto(
      textoDeReferencia(fonte.lotacao_atual),
      textoDeReferencia(fonte.lotacaoAtual),
      textoDeReferencia(fonte.lotacao),
      fonte.lotacao_nome,
      fonte.estrutura_nome,
      fonte.subgrupamento_nome,
      fonte.grupamento_nome
    ),
    unidade: primeiroTexto(
      textoDeReferencia(fonte.unidade),
      textoDeReferencia(fonte.unidadeAtual),
      textoDeReferencia(fonte.unidade_atual),
      textoDeReferencia(fonte.lotacao_unidade),
      textoDeReferencia(fonte.lotacaoUnidade),
      textoDeReferencia(fonte.lotacao_atual),
      textoDeReferencia(fonte.lotacaoAtual),
      textoDeReferencia(fonte.lotacaoAtualUnidade),
      textoDeReferencia(fonte.lotacao_atual_unidade),
      fonte.unidade_nome,
      fonte.unidadeNome,
      fonte.unidade_atual_nome,
      fonte.unidadeAtualNome,
      fonte.unidade_atual,
      fonte.estrutura_nome,
      fonte.subgrupamento_nome,
      fonte.grupamento_nome
    ),
    situacao: primeiroTexto(fonte.situacao, fonte.situacao_funcional, fonte.status_cadastro, fonte.status, fonte.situacao_militar),
    comportamento_atual: primeiroTexto(fonte.comportamento_atual, fonte.comportamento),
    data_promocao_atual: formatarDataDocumentoMilitar(primeiroTexto(
      dataDeReferencia(fonte.data_promocao_atual),
      dataDeReferencia(fonte.dataPromocaoAtual),
      dataDeReferencia(fonte.data_ultima_promocao),
      dataDeReferencia(fonte.dataUltimaPromocao),
      dataDeReferencia(fonte.promocao_atual_data),
      dataDeReferencia(fonte.promocaoAtualData),
      dataDeReferencia(fonte.promocao_atual),
      dataDeReferencia(fonte.promocaoAtual),
      dataDeReferencia(fonte.data_promocao),
      dataDeReferencia(fonte.dataPromocao),
      dataDeReferencia(fonte.dt_promocao_atual),
      dataDeReferencia(fonte.historico_promocao_atual),
      dataDeReferencia(fonte.historicoPromocaoAtual)
    )),
    tempo_servico: formatarTempoServico(fonte, dataReferencia),
    data_atual: formatarDataDocumentoMilitar(dataReferencia),
    cidade: primeiroTexto(cidade, fonte.cidade, fonte.endereco?.cidade),
  };
}