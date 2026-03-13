/**
 * Utilitário para aplicar templates de texto com variáveis {{variavel}}.
 */

/**
 * Abreviações de posto/graduação
 */
const ABREVIATURAS = {
  'Coronel': 'Cel',
  'Tenente Coronel': 'TC',
  'Major': 'Maj',
  'Capitão': 'Cap',
  '1º Tenente': '1º Ten',
  '2º Tenente': '2º Ten',
  'Aspirante': 'Asp',
  'Subtenente': 'ST',
  '1º Sargento': '1º Sgt',
  '2º Sargento': '2º Sgt',
  '3º Sargento': '3º Sgt',
  'Cabo': 'Cb',
  'Soldado': 'Sd',
};

export const abreviarPosto = (posto) => {
  if (!posto) return '';
  return ABREVIATURAS[posto] || posto;
};

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
 * Substitui variáveis {{var}} no template pelos valores do mapa.
 */
export function aplicarTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null && val !== '' ? val : `{{${key}}}`;
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
export function buildVarsLivro({ ferias, dataRegistro, periodo, diasDesconto, interrupcaoInfo } = {}) {
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
  const abreviatura = abreviarPosto(ferias.militar_posto);
  return {
    posto_nome: abreviatura ? `${abreviatura} QOBM` : '',
    posto: abreviatura,
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

/**
 * Dados simulados para preview do template na página de edição.
 */
export const VARS_PREVIEW = {
  posto_nome: 'Cap QOBM',
  posto: 'Cap',
  nome_completo: 'João da Silva',
  matricula: '123456',
  data_inicio: '01/04/2026',
  data_termino: '30/04/2026',
  data_retorno: '01/05/2026',
  data_registro: '01/04/2026',
  data_interrupcao: '10/04/2026',
  dias: '30',
  dias_extenso: 'trinta',
  dias_gozados: '10',
  dias_gozados_interrupcao: '10',
  saldo_remanescente: '20',
  periodo_aquisitivo: '01/09/2024 a 31/08/2025',
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
};
