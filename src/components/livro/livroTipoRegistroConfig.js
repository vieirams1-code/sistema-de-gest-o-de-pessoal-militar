export const LIVRO_TIPOS_REGISTRO_BASE = [
  { value: 'Saída Férias', label: 'Férias', sexo: null },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', sexo: 'Feminino' },
  { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', sexo: 'Feminino' },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', sexo: 'Masculino' },
  { value: 'Núpcias', label: 'Núpcias', sexo: null },
  { value: 'Luto', label: 'Luto', sexo: null },
  { value: 'Cedência', label: 'Cedência', sexo: null },
  { value: 'Transferência', label: 'Transferência', sexo: null },
  { value: 'Trânsito', label: 'Trânsito', sexo: null },
  { value: 'Instalação', label: 'Instalação', sexo: null },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', sexo: null },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', sexo: null },
  { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', sexo: null },
];

export const LIVRO_TIPOS_DEFAULT_DIAS = {
  'Núpcias': 8,
  Luto: 8,
  Trânsito: 30,
  Instalação: 10,
  'Licença Maternidade': 120,
  'Licença Paternidade': 5,
  'Dispensa Recompensa': 4,
};

export function getDefaultDiasByTipoRegistro(tipoRegistro) {
  return LIVRO_TIPOS_DEFAULT_DIAS[tipoRegistro] ?? null;
}

export function getTiposRegistroLivro(tiposCustom = [], militarSexo = null) {
  const custom = tiposCustom.map((tipo) => ({
    value: tipo.nome,
    label: tipo.nome,
    sexo: null,
  }));

  return [...LIVRO_TIPOS_REGISTRO_BASE, ...custom].filter(
    (tipo) => !tipo.sexo || tipo.sexo === militarSexo
  );
}
