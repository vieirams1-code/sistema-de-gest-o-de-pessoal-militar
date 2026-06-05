function vazio(valor) {
  if (valor === null || valor === undefined) return true;
  return String(valor).trim() === '';
}

export function listarInconsistenciasCadastraisMilitar(militar = {}) {
  if (!militar || typeof militar !== 'object') return [];

  const inconsistencias = [];

  // --- FUNCIONAIS (CRÍTICOS) ---
  if (vazio(militar.data_inclusao)) {
    inconsistencias.push({
      tipo: 'sem_data_inclusao',
      campo: 'data_inclusao',
      labelCampo: 'data de inclusão',
      impacto: 'Impede cálculo de comportamento por tempo.',
      regraBloqueada: 'comportamento',
      nivel: 'critico',
    });
  }

  if (vazio(militar.posto_graduacao)) {
    inconsistencias.push({
      tipo: 'sem_posto_graduacao',
      campo: 'posto_graduacao',
      labelCampo: 'posto/graduação',
      impacto: 'Impede enquadramento funcional e regras disciplinares.',
      regraBloqueada: 'enquadramento_funcional',
      nivel: 'critico',
    });
  }

  if (vazio(militar.quadro)) {
    inconsistencias.push({
      tipo: 'sem_quadro',
      campo: 'quadro',
      labelCampo: 'quadro',
      impacto: 'Impede consistência funcional por carreira.',
      regraBloqueada: 'consistencia_funcional',
      nivel: 'critico',
    });
  }

  if (vazio(militar.lotacao)) {
    inconsistencias.push({
      tipo: 'sem_lotacao',
      campo: 'lotacao',
      labelCampo: 'lotação',
      impacto: 'Pode bloquear fluxos que dependem de lotação essencial.',
      regraBloqueada: 'fluxos_lotacao',
      nivel: 'critico',
    });
  }

  // --- DOCUMENTOS (CRÍTICOS) ---
  if (vazio(militar.cpf)) {
    inconsistencias.push({
      tipo: 'sem_cpf',
      campo: 'cpf',
      labelCampo: 'CPF',
      impacto: 'Imprescindível para identificação única e folha.',
      regraBloqueada: 'identificacao',
      nivel: 'critico',
    });
  }

  if (vazio(militar.rg)) {
    inconsistencias.push({
      tipo: 'sem_rg',
      campo: 'rg',
      labelCampo: 'RG',
      impacto: 'Necessário para identificação civil.',
      regraBloqueada: 'identificacao',
      nivel: 'critico',
    });
  }

  if (vazio(militar.data_nascimento)) {
    inconsistencias.push({
      tipo: 'sem_data_nascimento',
      campo: 'data_nascimento',
      labelCampo: 'data de nascimento',
      impacto: 'Impede cálculo de idade e reserva compulsória.',
      regraBloqueada: 'previdencia',
      nivel: 'critico',
    });
  }

  // --- CONTATOS E ENDEREÇO (ATENÇÃO) ---
  if (vazio(militar.email_particular) && vazio(militar.email_funcional)) {
    inconsistencias.push({
      tipo: 'sem_email',
      campo: 'email',
      labelCampo: 'e-mail',
      impacto: 'Dificulta comunicações digitais e notificações.',
      regraBloqueada: 'comunicacao',
      nivel: 'atencao',
    });
  }

  if (vazio(militar.telefone)) {
    inconsistencias.push({
      tipo: 'sem_telefone',
      campo: 'telefone',
      labelCampo: 'telefone',
      impacto: 'Impede acionamento rápido em emergências.',
      regraBloqueada: 'comunicacao',
      nivel: 'atencao',
    });
  }

  if (vazio(militar.logradouro) || vazio(militar.cidade)) {
    inconsistencias.push({
      tipo: 'endereco_incompleto',
      campo: 'endereco',
      labelCampo: 'endereço',
      impacto: 'Dificulta localização do militar e auxílio transporte.',
      regraBloqueada: 'localizacao',
      nivel: 'atencao',
    });
  }

  // --- DIVERSOS (INFO) ---
  if (vazio(militar.tipo_sanguineo)) {
    inconsistencias.push({
      tipo: 'sem_tipo_sanguineo',
      campo: 'tipo_sanguineo',
      labelCampo: 'tipo sanguíneo',
      impacto: 'Informação crítica para primeiros socorros.',
      regraBloqueada: 'saude',
      nivel: 'atencao',
    });
  }

  return inconsistencias;
}

export function obterInconsistenciasCalculoComportamento(militar = {}) {
  return listarInconsistenciasCadastraisMilitar(militar)
    .filter((item) => item.regraBloqueada === 'comportamento' || item.tipo === 'sem_posto_graduacao');
}
