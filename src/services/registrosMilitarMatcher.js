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

function montarNomesMilitar(militar) {
  const nomes = [
    militar?.nome_completo,
    militar?.nome_guerra,
    militar?.militar_nome,
  ]
    .map((item) => normalizarTextoComparacao(item))
    .filter(Boolean);

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

  const matriculaRegistro = normalizarMatricula(registro?.militar_matricula || registro?.matricula_legado);
  const matriculasMilitar = extrairMatriculasMilitar(militar);
  if (matriculaRegistro && matriculasMilitar.includes(matriculaRegistro)) {
    return true;
  }

  const nomeRegistro = normalizarTextoComparacao(
    registro?.militar_nome || registro?.militar_nome_completo || registro?.nome_completo_legado || registro?.nome_guerra_legado,
  );

  if (!nomeRegistro || nomeRegistro.length < 6) return false;

  const nomesMilitar = montarNomesMilitar(militar);

  return nomesMilitar.some((nomeMilitar) => {
    if (!nomeMilitar || nomeMilitar.length < 6) return false;
    return nomeMilitar === nomeRegistro || nomeMilitar.includes(nomeRegistro) || nomeRegistro.includes(nomeMilitar);
  });
}

