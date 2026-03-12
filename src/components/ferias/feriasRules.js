export function getFracaoOrdem(fracionamento) {
  const valor = String(fracionamento || '').trim().toLowerCase();

  if (!valor) return 1;
  if (valor.includes('integral')) return 1;
  if (valor.includes('1')) return 1;
  if (valor.includes('2')) return 2;
  if (valor.includes('3')) return 3;

  return 1;
}

export function isMesmaReferenciaPeriodo(a, b) {
  return String(a || '').trim() === String(b || '').trim();
}

export function getFeriasMesmoPeriodoMesmoMilitar(lista, feriasAtualOuPayload) {
  const militarId = feriasAtualOuPayload?.militar_id;
  const periodoRef = feriasAtualOuPayload?.periodo_aquisitivo_ref;
  const feriasIdAtual = feriasAtualOuPayload?.id || null;

  return (lista || []).filter((item) => {
    if (!item?.militar_id || !item?.periodo_aquisitivo_ref) return false;
    if (feriasIdAtual && item.id === feriasIdAtual) return false;

    return (
      item.militar_id === militarId &&
      isMesmaReferenciaPeriodo(item.periodo_aquisitivo_ref, periodoRef)
    );
  });
}

export function getFracaoAnteriorObrigatoria(lista, feriasAtualOuPayload) {
  const ordemAtual = getFracaoOrdem(feriasAtualOuPayload?.fracionamento);

  if (ordemAtual <= 1) return null;

  const mesmoPeriodo = getFeriasMesmoPeriodoMesmoMilitar(lista, feriasAtualOuPayload);

  return mesmoPeriodo.find((item) => getFracaoOrdem(item.fracionamento) === ordemAtual - 1) || null;
}

export function validarOrdemDasFracoesNoCadastro(lista, feriasAtualOuPayload) {
  const ordemAtual = getFracaoOrdem(feriasAtualOuPayload?.fracionamento);
  const dataInicioAtual = feriasAtualOuPayload?.data_inicio;

  if (!dataInicioAtual || ordemAtual <= 1) return null;

  const fracaoAnterior = getFracaoAnteriorObrigatoria(lista, feriasAtualOuPayload);

  if (!fracaoAnterior) {
    return `A ${ordemAtual}ª fração não pode ser cadastrada antes da ${ordemAtual - 1}ª fração.`;
  }

  if (!fracaoAnterior.data_inicio) {
    return `A ${ordemAtual}ª fração exige que a ${ordemAtual - 1}ª fração já tenha data de início definida.`;
  }

  if (new Date(`${dataInicioAtual}T00:00:00`) < new Date(`${fracaoAnterior.data_inicio}T00:00:00`)) {
    return `A ${ordemAtual}ª fração não pode iniciar antes da ${ordemAtual - 1}ª fração.`;
  }

  return null;
}

export function validarInicioDentroDoConcessivo({ dataInicio, dataLimiteGozo }) {
  if (!dataInicio || !dataLimiteGozo) return null;

  const inicio = new Date(`${dataInicio}T00:00:00`);
  const limite = new Date(`${dataLimiteGozo}T00:00:00`);

  if (inicio > limite) {
    return 'O início do gozo não pode ocorrer após o término do período concessivo deste período aquisitivo.';
  }

  return null;
}

export function jaFoiIniciada(ferias, registrosLivro = []) {
  if (!ferias?.id) return false;

  return registrosLivro.some(
    (r) => r.ferias_id === ferias.id && r.tipo_registro === 'Saída Férias'
  );
}

export function validarOrdemDasFracoesNoInicio(lista, feriasAtual, registrosLivro = [], dataRegistro) {
  const ordemAtual = getFracaoOrdem(feriasAtual?.fracionamento);

  if (ordemAtual <= 1) return null;

  const fracaoAnterior = getFracaoAnteriorObrigatoria(lista, feriasAtual);

  if (!fracaoAnterior) {
    return `A ${ordemAtual}ª fração não pode iniciar antes da ${ordemAtual - 1}ª fração existir.`;
  }

  if (!jaFoiIniciada(fracaoAnterior, registrosLivro)) {
    return `A ${ordemAtual}ª fração só pode iniciar após o início da ${ordemAtual - 1}ª fração.`;
  }

  if (dataRegistro && fracaoAnterior.data_inicio) {
    const dataAtual = new Date(`${dataRegistro}T00:00:00`);
    const dataAnterior = new Date(`${fracaoAnterior.data_inicio}T00:00:00`);

    if (dataAtual < dataAnterior) {
      return `A ${ordemAtual}ª fração não pode iniciar antes da ${ordemAtual - 1}ª fração.`;
    }
  }

  return null;
}

export function possuiPrevisaoValidaNoConcessivo(periodo, feriasDoPeriodo = []) {
  if (!periodo?.data_limite_gozo) return false;

  const limite = new Date(`${periodo.data_limite_gozo}T00:00:00`);

  return (feriasDoPeriodo || []).some((f) => {
    if (!f?.data_inicio) return false;
    const inicio = new Date(`${f.data_inicio}T00:00:00`);
    return inicio <= limite;
  });
}

export function calcularNivelAlertaPeriodo(periodo, feriasDoPeriodo = []) {
  if (!periodo?.data_limite_gozo) return 'Regular';

  const possuiPrevisaoValida = possuiPrevisaoValidaNoConcessivo(periodo, feriasDoPeriodo);
  if (possuiPrevisaoValida) return 'Regular';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = new Date(`${periodo.data_limite_gozo}T00:00:00`);
  const dias = Math.floor((limite - hoje) / (1000 * 60 * 60 * 24));

  if (dias < 0) return 'Vencido';
  if (dias <= 90) return 'Crítico 90 Dias';
  if (dias <= 150) return 'Atenção 5 Meses';

  return 'Regular';
}