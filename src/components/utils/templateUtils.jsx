/**
 * Utilitário para aplicar templates de texto com variáveis {{variavel}}.
 */

import {
  abreviarPosto,
  buildTemplateVarsContrato,
  montarPostoNomeTemplate,
  resolveQuadroTemplate,
} from './templateContratoUtils.js';

export { abreviarPosto, buildTemplateVarsContrato, montarPostoNomeTemplate, resolveQuadroTemplate };

const numeroPorExtenso = (num) => {
  const numeros = {
    1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',
    11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze',16:'dezesseis',17:'dezessete',
    18:'dezoito',19:'dezenove',20:'vinte',21:'vinte e um',22:'vinte e dois',23:'vinte e três',
    24:'vinte e quatro',25:'vinte e cinco',26:'vinte e seis',27:'vinte e sete',28:'vinte e oito',
    29:'vinte e nove',30:'trinta',60:'sessenta',120:'cento e vinte'
  };
  return numeros[num] || num.toString();
};


export const formatDateBR = (ds) => {
  if (!ds) return '';
  try {
    const d = new Date(ds + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return ds; }
};

/**
 * Extrai as variáveis usadas em um template de texto.
 * Retorna um array com os nomes das variáveis (sem as chaves).
 */
export function extrairVariaveisDoTemplate(template) {
  if (!template) return [];
  const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
  return [...new Set(matches.map(m => m[1].trim()))];
}

/**
 * Substitui variáveis {{var}} no template pelos valores do mapa.
 */
export function aplicarTemplate(template, vars) {
  if (!template) return '';
  const varsSafe = vars || {};
  const varsComFallbackVazio = new Set(['quadro', 'quadro_nome', 'militar_quadro', 'posto_nome']);

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = varsSafe[key];
    if (val !== undefined && val !== null && val !== '') return val;
    if (varsComFallbackVazio.has(key)) return '';
    return `{{${key}}}`;
  });
}

/**
 * Formata período aquisitivo completo: busca datas no PeriodoAquisitivo.
 * Recebe o objeto periodo (opcional) para exibir datas completas.
 */
export const formatPeriodoAquisitivo = (ref, periodo) => {
  if (periodo?.inicio_aquisitivo && periodo?.fim_aquisitivo) {
    return `${formatDateBR(periodo.inicio_aquisitivo)} a ${formatDateBR(periodo.fim_aquisitivo)}`;
  }
  return ref || '';
};

/**
 * Constrói o mapa de variáveis para registros do Livro com base em férias + dados do registro.
 * Recebe opcionalmente o objeto periodo aquisitivo para gerar a data completa.
 */
export function buildVarsLivro({ ferias, militar, registro, dataRegistro, periodo, diasDesconto, interrupcaoInfo } = {}) {
  if (!ferias) return {};
  const diasBase = Number(ferias.dias || 0);
  const diasNoMomento = Number(interrupcaoInfo?.diasNoMomento ?? diasBase);
  const diasGozados = Number(
    interrupcaoInfo?.diasGozados ??
      ferias.dias_gozados_interrupcao ??
      0
  );
  const saldoRemanescente = Number(
    interrupcaoInfo?.saldoRemanescente ??
      ferias.saldo_remanescente ??
      Math.max(0, diasNoMomento - diasGozados)
  );
  const dataInterrupcao = interrupcaoInfo?.dataInterrupcao || ferias.data_interrupcao || dataRegistro || null;

  const dias = diasBase;
  const desconto = diasDesconto || ferias._diasDesconto || 0;
  const abreviatura = abreviarPosto(ferias.militar_posto || militar?.posto_graduacao || registro?.militar_posto);
  const quadro = resolveQuadroTemplate({
    militar_quadro: ferias?.militar_quadro,
    militar: { quadro: militar?.quadro },
    quadro: registro?.militar_quadro || registro?.quadro || ferias?.quadro,
    quadro_nome: ferias?.quadro_nome || registro?.quadro_nome,
    ...ferias,
    militar,
    registro,
  });
  const postoNome = montarPostoNomeTemplate({
    abreviatura,
    quadro,
    source: { ferias, militar, registro, periodo },
  });

  return {
    posto_nome: postoNome,
    posto: abreviatura,
    quadro,
    quadro_nome: quadro,
    militar_quadro: quadro,
    nome_completo: ferias.militar_nome || '',
    matricula: ferias.militar_matricula || '',
    data_inicio: formatDateBR(ferias.data_inicio),
    data_termino: formatDateBR(ferias.data_fim || ferias.data_termino),
    data_retorno: formatDateBR(ferias.data_retorno),
    data_interrupcao: formatDateBR(dataInterrupcao),
    data_registro: formatDateBR(dataRegistro || ferias.data_inicio),
    dias: String(dias),
    dias_extenso: numeroPorExtenso(dias),
    dias_gozados: String(diasGozados),
    dias_gozados_interrupcao: String(diasGozados),
    saldo_remanescente: String(saldoRemanescente),
    dias_desconto: String(desconto),
    dias_desconto_extenso: numeroPorExtenso(desconto),
    periodo_aquisitivo: formatPeriodoAquisitivo(ferias.periodo_aquisitivo_ref, periodo),
    periodo_aquisitivo_simplificado: ferias.periodo_aquisitivo_ref || '',
    fracionamento: ferias.fracionamento || '',
    tipo_ferias_texto: ferias.fracionamento
      ? `${ferias.fracionamento} de férias regulamentares`
      : 'férias regulamentares',
  };
}

export function buildPreviewTemplateVars(overrides = {}) {
  const dataSimuladaLivro = {
    ferias: {
      militar_posto: 'Capitão',
      militar_quadro: 'QPTBM',
      militar_nome: 'João da Silva',
      militar_matricula: '123456',
      data_inicio: '2026-01-07',
      data_fim: '2026-02-05',
      data_retorno: '2026-02-06',
      dias: 30,
      dias_base: 30,
      periodo_aquisitivo_ref: '2024/2025',
      fracionamento: '1ª parcela',
    },
    dataRegistro: '2026-01-07',
    periodo: {
      inicio_aquisitivo: '2024-01-01',
      fim_aquisitivo: '2025-12-31',
    },
  };

  const varsLivro = buildVarsLivro(dataSimuladaLivro);
  const base = {
    nome: 'João da Silva',
    nome_completo: 'João da Silva',
    matricula: '123456',
    posto_abreviatura: varsLivro.posto || 'Cap',
    ...varsLivro,
    novo_fim: varsLivro.data_termino || '',
    retorno_previsto: varsLivro.data_retorno || '',
    base_dias: String(dataSimuladaLivro.ferias.dias_base || dataSimuladaLivro.ferias.dias || ''),
  };

  const merged = { ...base, ...overrides };
  const quadro = resolveQuadroTemplate(merged);
  const posto = String(merged.posto_abreviatura || merged.posto || '').trim();
  const postoNome = montarPostoNomeTemplate({
    abreviatura: posto,
    quadro,
    source: merged,
  });

  return {
    ...merged,
    nome: merged.nome || merged.nome_completo || '',
    nome_completo: merged.nome_completo || merged.nome || '',
    posto,
    quadro,
    quadro_nome: quadro,
    militar_quadro: quadro,
    posto_nome: postoNome,
  };
}

/**
 * Dados simulados para preview do template na página de edição.
 */
export const VARS_PREVIEW = buildPreviewTemplateVars({
  data_inicio: '07/01/2026',
  data_termino: '05/02/2026',
  data_retorno: '06/02/2026',
  data_registro: '07/01/2026',
  data_publicacao: '07/01/2026',
  data_interrupcao: '10/04/2026',
  dias: '30',
  dias_extenso: 'trinta',
  dias_gozados: '10',
  dias_gozados_interrupcao: '10',
  saldo_remanescente: '20',
  periodo_aquisitivo: '01/01/2024 a 31/12/2025',
  periodo_aquisitivo_simplificado: '2024/2025',
  fracionamento: '1ª parcela',
  tipo_ferias_texto: '1ª parcela de férias regulamentares',
  conjuge_nome: 'Maria da Silva',
  falecido_nome: 'José da Silva',
  falecido_certidao: '123456',
  grau_parentesco: 'Ascendentes',
  origem: '1° GBM',
  destino: '2° GBM',
  data_cedencia: '01/04/2026',
  data_transferencia: '01/04/2026',
  documento_referencia: 'DOEMS nº 1.234, de 01 de abril de 2026',
  tipo_transferencia: 'Ex officio',
  missao_descricao: 'CMAUT/2026',
  curso_nome: 'CBMESC/2026',
  curso_local: 'Florianópolis',
  edicao_ano: '2026',
  motivo_dispensa: 'serviços prestados',
  dias_restantes: '24',
  dias_desconto: '6',
  dias_desconto_extenso: 'seis',
  inicio_termino: 'Início',
  tipo_texto: 'início',
  funcao: 'Auxiliar B1',
  data_designacao: '01/03/2026',
  assunto: 'Comunicado de interesse da tropa',
  data_documento: '01/03/2026',
  documento_referencia_rr: 'DOEMS nº 12.345, de 01 de março de 2026',
  data_transferencia_rr: '01/03/2026',
  finalidade_jiso: 'LTS',
  secao_jiso: '62/JISO/2026',
  data_ata: '01/03/2026',
  nup: '31.001.005-12',
  parecer_jiso: 'Apto',
  data_melhoria: '01/03/2026',
  comportamento_atual: 'Bom',
  comportamento_ingressou: 'Ótimo',
  data_inclusao: '15/03/2010',
  texto_complemento: 'pela dedicação e esforço demonstrados',
  portaria: '123/2026',
  data_portaria: '01/03/2026',
  data_punicao: '02/03/2026',
  tipo_punicao: 'Prisão',
  dias_punicao: '5',
  itens_enquadramento: '3 e 5',
  graduacao_punicao: 'Média',
  comportamento_ingresso: 'Bom',
  publicacao_transferencia: 'DOEMS nº 12.345',
  documento: 'Ofício 001/2026',
  tipo_afastamento: 'própria saúde',
  numero_bg_ref: '045',
  data_bg_ref: '10/03/2026',
  nota_ref: '123/2026',
  texto_errado: 'transferido para o 1º GBM',
  texto_novo: 'transferido para o 2º GBM',
  tipo_ref: 'Transferência',
  militar_nome: 'João da Silva',
  posto_graduacao: '3º Sargento',
  unidade: '1º GBM',
  comportamento_anterior: 'Bom',
  comportamento_novo: 'Ótimo',
  data_alteracao: '01/03/2026',
  motivo_mudanca: 'cumprimento dos requisitos temporais para melhoria',
  fundamento_legal: 'Art. 52 do regulamento disciplinar',
});
