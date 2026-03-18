export const LIVRO_TIPOS_BASE = [
  { value: 'Saída Férias', label: 'Férias', grupo: 'Férias', sexo: null },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino' },
  { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino' },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', grupo: 'Licenças', sexo: 'Masculino' },
  { value: 'Núpcias', label: 'Núpcias', grupo: 'Afastamentos', sexo: null },
  { value: 'Luto', label: 'Luto', grupo: 'Afastamentos', sexo: null },
  { value: 'Cedência', label: 'Cedência', grupo: 'Movimentações', sexo: null },
  { value: 'Transferência', label: 'Transferência', grupo: 'Movimentações', sexo: null },
  { value: 'Transferência para RR', label: 'Transferência para Reserva Remunerada', grupo: 'Movimentações', sexo: null },
  { value: 'Trânsito', label: 'Trânsito', grupo: 'Movimentações', sexo: null },
  { value: 'Instalação', label: 'Instalação', grupo: 'Movimentações', sexo: null },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', grupo: 'Afastamentos', sexo: null },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', grupo: 'Operacional', sexo: null },
  { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', grupo: 'Operacional', sexo: null },
  { value: 'Designação de Função', label: 'Designação de Função', grupo: 'Função', sexo: null },
  { value: 'Dispensa de Função', label: 'Dispensa de Função', grupo: 'Função', sexo: null },
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
