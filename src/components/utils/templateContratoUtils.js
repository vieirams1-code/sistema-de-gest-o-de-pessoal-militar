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
  'Soldado': 'SD',
};

export const abreviarPosto = (posto) => {
  if (!posto) return '';
  return ABREVIATURAS[posto] || posto;
};

export const resolveQuadroTemplate = (source = {}) => {
  const candidatos = [
    source?.quadro,
    source?.quadro_nome,
    source?.militar_quadro,
    source?.ferias?.militar_quadro,
    source?.ferias?.quadro,
    source?.periodo?.militar_quadro,
    source?.registro?.militar_quadro,
    source?.registro?.quadro,
    source?.quadro_atual,
    source?.militar?.quadro,
    source?.militar?.militar_quadro,
    source?.militar?.quadro_nome,
    source?.militar?.militar_quadro,
  ];

  for (const candidato of candidatos) {
    const valor = String(candidato || '').trim();
    if (valor) return valor;
  }

  return '';
};

export const montarPostoNomeTemplate = ({ abreviatura, posto, quadro, source } = {}) => {
  const postoResolvido = String(abreviatura || posto || '').trim();
  const quadroResolvido = String(quadro || resolveQuadroTemplate(source) || '').trim();
  return [postoResolvido, quadroResolvido].filter(Boolean).join(' ');
};

export function buildTemplateVarsContrato(source = {}) {
  const nomeCompleto = String(
    source?.nome_completo ??
    source?.militar_nome ??
    source?.nome ??
    ''
  ).trim();
  const postoBase = source?.posto ?? source?.militar_posto ?? source?.militar?.posto_graduacao ?? source?.militar?.posto;
  const posto = String(source?.posto_abreviatura || abreviarPosto(postoBase) || '').trim();
  const quadro = resolveQuadroTemplate(source);
  const postoNome = montarPostoNomeTemplate({
    abreviatura: posto,
    quadro,
    source,
  });

  const matricula = [
    source?.matricula_documental,
    source?.matricula_operacional,
    source?.matricula,
    source?.militar_matricula_atual,
    source?.militar_matricula,
    source?.militar?.matricula_documental,
    source?.militar?.matricula_operacional,
    source?.militar?.matricula,
  ].map((v) => String(v || '').trim()).find(Boolean) || '-';

  return {
    nome_completo: nomeCompleto,
    posto,
    posto_nome: postoNome,
    quadro,
    quadro_nome: quadro,
    militar_quadro: quadro,
    matricula,
  };
}

export function composeTemplateVarsRP({ formData = {}, sourceRP = {}, rpSpecificOverrides = {} } = {}) {
  return {
    ...formData,
    ...buildTemplateVarsContrato(sourceRP),
    ...rpSpecificOverrides,
  };
}
