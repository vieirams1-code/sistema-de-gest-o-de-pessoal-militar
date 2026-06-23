/**
 * descontoFeriasTemplateVars.js
 * Variáveis e fallback do tipo "Dispensa com Desconto em Férias".
 * O texto oficial deve vir do módulo Templates de Texto; este fallback
 * só é usado enquanto não houver template cadastrado para o tipo.
 */

export const TIPO_DESCONTO_FERIAS = 'Dispensa com Desconto em Férias';

// Placeholders oficiais do tipo (usados no editor de Templates de Texto).
export const DESCONTO_FERIAS_PLACEHOLDERS = [
  { v: '{{militar_posto}}', desc: 'Posto/graduação do militar' },
  { v: '{{militar_nome_guerra}}', desc: 'Nome de guerra do militar' },
  { v: '{{militar_nome_completo}}', desc: 'Nome completo do militar' },
  { v: '{{militar_matricula}}', desc: 'Matrícula funcional' },
  { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo (ex: 2023/2024)' },
  { v: '{{dias_descontados}}', desc: 'Quantidade de dias descontados' },
  { v: '{{data_inicio}}', desc: 'Data inicial do desconto' },
  { v: '{{data_fim}}', desc: 'Data final do desconto' },
  { v: '{{nota_bg}}', desc: 'Nota para o BG' },
  { v: '{{numero_bg}}', desc: 'Número do BG' },
  { v: '{{data_bg}}', desc: 'Data do BG' },
];

function formatarData(data) {
  if (!data) return '';
  return String(data).slice(0, 10).split('-').reverse().join('/');
}

/**
 * Monta o mapa de variáveis para aplicar no template do desconto.
 */
export function buildVarsDescontoFerias(dados = {}) {
  return {
    militar_posto: dados.militar_posto || '',
    militar_nome_guerra: dados.militar_nome_guerra || '',
    militar_nome_completo: dados.militar_nome || dados.militar_nome_completo || '',
    militar_matricula: dados.militar_matricula || '',
    periodo_aquisitivo: dados.periodo_aquisitivo_ref || '',
    dias_descontados: String(dados.dias ?? ''),
    data_inicio: formatarData(dados.data_inicio),
    data_fim: formatarData(dados.data_fim),
    nota_bg: dados.nota_para_bg || '',
    numero_bg: dados.numero_bg || '',
    data_bg: formatarData(dados.data_bg),
  };
}

/**
 * Fallback simples — usado apenas quando não há template oficial cadastrado.
 */
export function gerarTextoFallbackDesconto(dados = {}) {
  const posto = dados.militar_posto || '';
  const nome = dados.militar_nome || dados.militar_nome_completo || '';
  const matricula = dados.militar_matricula || '';
  return `Dispensa com desconto em férias do(a) ${posto} ${nome} (Mat. ${matricula}), `
    + `no total de ${dados.dias} dia(s), no período de ${formatarData(dados.data_inicio)} a ${formatarData(dados.data_fim)}.`;
}