function vazio(valor) {
  if (valor === null || valor === undefined) return true;
  return String(valor).trim() === '';
}

export function listarInconsistenciasCadastraisMilitar(militar = {}) {
  if (!militar || typeof militar !== 'object') return [];

  const inconsistencias = [];

  if (vazio(militar.data_inclusao)) {
    inconsistencias.push({
      tipo: 'sem_data_inclusao',
      campo: 'data_inclusao',
      labelCampo: 'data de inclusão',
      impacto: 'Impede cálculo de comportamento por tempo.',
      regraBloqueada: 'comportamento',
    });
  }

  if (vazio(militar.posto_graduacao)) {
    inconsistencias.push({
      tipo: 'sem_posto_graduacao',
      campo: 'posto_graduacao',
      labelCampo: 'posto/graduação',
      impacto: 'Impede enquadramento funcional e regras disciplinares.',
      regraBloqueada: 'enquadramento_funcional',
    });
  }

  if (vazio(militar.quadro)) {
    inconsistencias.push({
      tipo: 'sem_quadro',
      campo: 'quadro',
      labelCampo: 'quadro',
      impacto: 'Impede consistência funcional por carreira.',
      regraBloqueada: 'consistencia_funcional',
    });
  }

  if (vazio(militar.lotacao)) {
    inconsistencias.push({
      tipo: 'sem_lotacao',
      campo: 'lotacao',
      labelCampo: 'lotação',
      impacto: 'Pode bloquear fluxos que dependem de lotação essencial.',
      regraBloqueada: 'fluxos_lotacao',
    });
  }

  return inconsistencias;
}

export function obterInconsistenciasCalculoComportamento(militar = {}) {
  return listarInconsistenciasCadastraisMilitar(militar)
    .filter((item) => item.regraBloqueada === 'comportamento' || item.tipo === 'sem_posto_graduacao');
}
