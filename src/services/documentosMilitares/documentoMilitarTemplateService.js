import {
  MODULO_DOCUMENTOS_MILITARES,
  montarVariaveisDocumentoMilitar,
} from './documentoMilitarVarsService.js';
import {
  obterChaveCampoDinamicoDocumentoMilitar,
  substituirCamposDinamicosDocumentoMilitar,
} from './camposDinamicosDocumentoMilitar.js';
import { substituirVariaveisDocumentoMilitar } from './substituirVariaveisDocumentoMilitar.js';
import { montarVariaveisSignatarioDocumentoMilitar } from './documentoMilitarSignatarioService.js';

export const TIPO_TEMPLATE_DOCUMENTO_MILITAR = 'Documento Militar';

export const DOCUMENTOS_MILITARES_TEMPLATE_OPTION = {
  value: TIPO_TEMPLATE_DOCUMENTO_MILITAR,
  label: 'Documento Militar',
  modulo: MODULO_DOCUMENTOS_MILITARES,
};

export const VARIAVEIS_TEMPLATE_DOCUMENTO_MILITAR = [
  { chave: 'nome_completo', descricao: 'Nome completo do militar' },
  { chave: 'nome_guerra', descricao: 'Nome de guerra do militar' },
  { chave: 'posto_graduacao', descricao: 'Posto ou graduação do militar' },
  { chave: 'quadro', descricao: 'Quadro do militar' },
  { chave: 'matricula', descricao: 'Matrícula funcional' },
  { chave: 'cpf', descricao: 'CPF do militar' },
  { chave: 'rg', descricao: 'RG do militar' },
  { chave: 'data_nascimento', descricao: 'Data de nascimento' },
  { chave: 'data_inclusao', descricao: 'Data de inclusão' },
  { chave: 'lotacao', descricao: 'Lotação atual' },
  { chave: 'unidade', descricao: 'Unidade atual' },
  { chave: 'situacao', descricao: 'Situação funcional' },
  { chave: 'comportamento_atual', descricao: 'Comportamento atual' },
  { chave: 'data_promocao_atual', descricao: 'Data da promoção atual' },
  { chave: 'tempo_servico', descricao: 'Tempo de serviço' },
  { chave: 'data_atual', descricao: 'Data atual' },
  { chave: 'cidade', descricao: 'Cidade de referência do documento' },
  { chave: 'titulo_documento', descricao: 'Título configurável do documento' },
  { chave: 'signatario_nome', descricao: 'Nome do signatário' },
  { chave: 'signatario_posto_graduacao', descricao: 'Posto ou graduação do signatário' },
  { chave: 'signatario_quadro', descricao: 'Quadro do signatário' },
  { chave: 'signatario_matricula', descricao: 'Matrícula do signatário' },
  { chave: 'signatario_funcao', descricao: 'Função do signatário' },
  { chave: 'assinatura_signatario', descricao: 'Assinatura institucional do signatário em 3 linhas' },
];

const CHAVES_VARIAVEIS_DOCUMENTO_MILITAR = new Set(
  VARIAVEIS_TEMPLATE_DOCUMENTO_MILITAR.map(({ chave }) => chave)
);
const PLACEHOLDER_REGEX = /{{\s*([^{}]+?)\s*}}/g;

function montarResumo(findings) {
  return {
    erros: findings.filter((finding) => finding.severity === 'ERRO').length,
    alertas: findings.filter((finding) => finding.severity === 'ALERTA').length,
    infos: findings.filter((finding) => finding.severity === 'INFO').length,
  };
}

export function lintTemplateDocumentoMilitar(template = '') {
  const texto = typeof template === 'string' ? template : '';
  const findings = [];
  const normalizedVars = [];

  if (!texto.trim()) {
    findings.push({
      severity: 'ERRO',
      code: 'TEMPLATE_VAZIO',
      variavel: null,
      message: 'Template vazio: informe o texto antes de salvar.',
    });
  }

  for (const match of texto.matchAll(PLACEHOLDER_REGEX)) {
    const variavel = match[1].trim();
    normalizedVars.push(variavel);

    if (obterChaveCampoDinamicoDocumentoMilitar(variavel)) {
      continue;
    }

    if (!CHAVES_VARIAVEIS_DOCUMENTO_MILITAR.has(variavel)) {
      findings.push({
        severity: 'ALERTA',
        code: 'VAR_DESCONHECIDA_DOCUMENTO_MILITAR',
        variavel,
        message: `Variável '{{${variavel}}}' não é reconhecida para Documentos Militares. O salvamento será permitido, mas revise o placeholder.`,
      });
    }
  }

  return {
    ok: findings.every((finding) => finding.severity !== 'ERRO'),
    summary: montarResumo(findings),
    findings,
    normalizedVars,
  };
}

export function buildPreviewDocumentoMilitarVars() {
  return {
    ...montarVariaveisDocumentoMilitar({
      nome_completo: 'Maria da Silva',
      nome_guerra: 'SILVA',
      posto_graduacao: 'Capitão',
      quadro: 'QOBM',
      matricula: '123456',
      cpf: '111.222.333-44',
      rg: '987654',
      data_nascimento: '1990-05-20',
      data_inclusao: '2010-06-01',
      lotacao: { nome: '1º GBM' },
      unidade_nome: 'CBMDF',
      situacao: 'Ativo',
      comportamento_atual: 'Ótimo',
      data_promocao_atual: '2024-01-15',
      endereco: { cidade: 'Brasília' },
    }, {
      dataReferencia: '2026-06-02',
    }),
    titulo_documento: 'DOCUMENTO MILITAR',
    ...montarVariaveisSignatarioDocumentoMilitar({
      nomeSignatario: 'Edson Vieira de Souza',
      postoGraduacaoSignatario: '2º TEN',
      quadroSignatario: 'QOBM',
      matriculaSignatario: '108.747-021',
      funcaoSignatario: 'Chefe da B1/1ºGBM/CBMMS',
    }),
  };
}

export function buildPreviewDocumentoMilitarCamposDinamicos() {
  return {
    nome_curso: 'Curso de Formação',
    periodo_curso: '1º a 30 de junho de 2026',
    destino_documento: 'Comando-Geral',
  };
}

export function previewTemplateDocumentoMilitar(template = '') {
  const templateComCamposDinamicos = substituirCamposDinamicosDocumentoMilitar(
    template,
    buildPreviewDocumentoMilitarCamposDinamicos()
  );

  return substituirVariaveisDocumentoMilitar(templateComCamposDinamicos, buildPreviewDocumentoMilitarVars(), {
    manterDesconhecidas: true,
  });
}
