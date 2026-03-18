export const LIVRO_TIPOS_BASE = [
  { value: 'Saída Férias', label: 'Férias', grupo: 'Férias', sexo: null, descricao: 'Fluxo operacional de saída, retorno, interrupção ou retomada de férias.', palavrasChave: ['ferias', 'saida', 'retorno', 'interrupcao', 'retomada'], destaque: true },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino', descricao: 'Afastamento por maternidade com período integral previsto.', palavrasChave: ['licenca', 'maternidade', 'afastamento'], destaque: true },
  { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino', descricao: 'Extensão do período de licença maternidade.', palavrasChave: ['prorrogacao', 'licenca', 'maternidade'] },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', grupo: 'Licenças', sexo: 'Masculino', descricao: 'Afastamento por paternidade com duração padrão.', palavrasChave: ['licenca', 'paternidade', 'afastamento'], destaque: true },
  { value: 'Núpcias', label: 'Núpcias', grupo: 'Afastamentos', sexo: null, descricao: 'Registro de afastamento por casamento.', palavrasChave: ['nupcias', 'casamento'], destaque: true },
  { value: 'Luto', label: 'Luto', grupo: 'Afastamentos', sexo: null, descricao: 'Afastamento motivado por falecimento de familiar.', palavrasChave: ['luto', 'falecimento', 'obito'], destaque: true },
  { value: 'Cedência', label: 'Cedência', grupo: 'Movimentações', sexo: null, descricao: 'Movimentação temporária com origem e destino.', palavrasChave: ['cedencia', 'movimentacao', 'origem', 'destino'] },
  { value: 'Transferência', label: 'Transferência', grupo: 'Movimentações', sexo: null, descricao: 'Mudança de lotação com publicação de referência.', palavrasChave: ['transferencia', 'lotacao', 'movimentacao'], destaque: true },
  { value: 'Transferência para RR', label: 'Transferência para Reserva Remunerada', grupo: 'Movimentações', sexo: null, descricao: 'Transferência específica para reserva remunerada.', palavrasChave: ['transferencia', 'rr', 'reserva'] },
  { value: 'Trânsito', label: 'Trânsito', grupo: 'Movimentações', sexo: null, descricao: 'Período de trânsito entre origem e destino.', palavrasChave: ['transito', 'movimentacao'] },
  { value: 'Instalação', label: 'Instalação', grupo: 'Movimentações', sexo: null, descricao: 'Período de instalação vinculado à movimentação.', palavrasChave: ['instalacao', 'movimentacao'] },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', grupo: 'Afastamentos', sexo: null, descricao: 'Dispensa operacional vinculada a recompensa.', palavrasChave: ['dispensa', 'recompensa'] },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', grupo: 'Operacional', sexo: null, descricao: 'Registro de deslocamento operacional com retorno previsto.', palavrasChave: ['deslocamento', 'missao', 'operacional'], destaque: true },
  { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', grupo: 'Operacional', sexo: null, descricao: 'Participação em curso, estágio ou capacitação.', palavrasChave: ['curso', 'estagio', 'capacitacao'], destaque: true },
  { value: 'Designação de Função', label: 'Designação de Função', grupo: 'Função', sexo: null, descricao: 'Assunção formal de função.', palavrasChave: ['designacao', 'funcao'] },
  { value: 'Dispensa de Função', label: 'Dispensa de Função', grupo: 'Função', sexo: null, descricao: 'Desligamento formal da função.', palavrasChave: ['dispensa', 'funcao'] },
];

export const LIVRO_TIPO_LABELS = {
  'Saída Férias': 'Saída de Férias',
  'Retorno Férias': 'Retorno de Férias',
  'Interrupção de Férias': 'Interrupção de Férias',
  'Nova Saída / Retomada': 'Nova Saída / Retomada',
};

export function getTiposLivroFiltrados({ sexo, tiposCustom = [] } = {}) {
  const customTipos = tiposCustom.map((t) => ({ value: t.nome, label: t.nome, grupo: 'Personalizado', sexo: null }));
  return [...LIVRO_TIPOS_BASE, ...customTipos].filter((tipo) => !tipo.sexo || tipo.sexo === sexo);
}

export function groupTiposLivro(tipos = []) {
  return tipos.reduce((acc, tipo) => {
    const grupo = tipo.grupo || 'Outros';
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(tipo);
    return acc;
  }, {});
}

export function getTipoRegistroLabel(tipoRegistro) {
  if (!tipoRegistro) return 'Registro';
  return LIVRO_TIPO_LABELS[tipoRegistro] || tipoRegistro;
}


function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesTipoLivroSearch(tipo, search = '') {
  const normalizedSearch = normalizeText(search).trim();
  if (!normalizedSearch) return true;

  const haystack = [tipo?.label, tipo?.value, tipo?.grupo, tipo?.descricao, ...(tipo?.palavrasChave || [])]
    .map(normalizeText)
    .join(' ');

  return haystack.includes(normalizedSearch);
}
