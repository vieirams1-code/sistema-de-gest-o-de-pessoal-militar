function limparTexto(valor) {
  return String(valor || '').trim();
}

function normalizarTextoComparacao(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarMatricula(valor) {
  return limparTexto(valor).replace(/\D/g, '');
}

function hasNomeCompletoMinimo(nome) {
  const texto = normalizarTextoComparacao(nome);
  return texto.length >= 6 && texto.split(/\s+/).filter(Boolean).length >= 2;
}

function montarNomesCompletosMilitar(militar) {
  const nomes = [
    militar?.nome_completo,
    militar?.militar_nome_completo,
    militar?.militar_nome,
  ]
    .map((item) => normalizarTextoComparacao(item))
    .filter(hasNomeCompletoMinimo);

  return Array.from(new Set(nomes));
}

function montarNomesCompletosRegistro(registro) {
  const nomes = [
    registro?.militar_nome_completo,
    registro?.nome_completo_legado,
    registro?.militar_nome,
  ]
    .map((item) => normalizarTextoComparacao(item))
    .filter(hasNomeCompletoMinimo);

  return Array.from(new Set(nomes));
}

function extrairMatriculasMilitar(militar) {
  const matriculasHistorico = (militar?.matriculas_historico || []).flatMap((item) => [
    item?.matricula,
    item?.matricula_formatada,
    item?.matricula_normalizada,
  ]);

  const candidatas = [
    militar?.matricula,
    militar?.matricula_atual,
    militar?.militar_matricula,
    ...matriculasHistorico,
  ];

  return Array.from(new Set(candidatas.map(normalizarMatricula).filter(Boolean)));
}

export function vinculaRegistroAoMilitar(registro, militar) {
  if (!militar || !registro) return false;

  const registroMilitarId = limparTexto(registro?.militar_id || registro?.militarId || registro?.militar?.id || registro?.militar);
  const militarId = limparTexto(militar?.id);
  if (registroMilitarId && militarId && registroMilitarId === militarId) {
    return true;
  }

  const matriculasRegistro = [
    registro?.militar_matricula_atual,
    registro?.militar_matricula,
    registro?.militar_matricula_legado,
    registro?.matricula_legado,
    registro?.matricula,
  ]
    .map(normalizarMatricula)
    .filter(Boolean);

  const matriculasMilitar = extrairMatriculasMilitar(militar);
  if (matriculasRegistro.some((matricula) => matriculasMilitar.includes(matricula))) {
    return true;
  }

  const nomesRegistro = montarNomesCompletosRegistro(registro);
  if (nomesRegistro.length === 0) return false;

  const nomesMilitar = montarNomesCompletosMilitar(militar);
  if (nomesMilitar.length === 0) return false;

  return nomesRegistro.some((nomeRegistro) => nomesMilitar.includes(nomeRegistro));
}
