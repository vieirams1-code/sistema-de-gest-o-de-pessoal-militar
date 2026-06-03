function textoSeguro(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function primeiroTexto(...values) {
  for (const value of values) {
    const texto = textoSeguro(value);
    if (texto) return texto;
  }
  return '';
}

function textoReferencia(value) {
  if (!value || typeof value !== 'object') return textoSeguro(value);
  return primeiroTexto(value.nome, value.nome_completo, value.descricao, value.sigla, value.titulo);
}

function obterFuncaoSignatario(militar = {}) {
  const funcoes = [
    militar.funcao_atual,
    militar.funcao,
    militar.cargo,
    militar.cargo_funcao,
    militar.funcao_nome,
    militar.funcao_militar,
  ];

  if (Array.isArray(militar.funcoes_ativas)) {
    const funcaoAtiva = militar.funcoes_ativas.find((item) => item?.status !== 'inativa') || militar.funcoes_ativas[0];
    funcoes.push(funcaoAtiva?.nome, funcaoAtiva?.descricao, funcaoAtiva?.funcao_nome);
  }

  return primeiroTexto(...funcoes.map(textoReferencia));
}

function obterLotacaoSignatario(militar = {}) {
  return primeiroTexto(
    textoReferencia(militar.lotacao_atual),
    textoReferencia(militar.lotacao),
    militar.lotacao_nome,
    textoReferencia(militar.unidade),
    militar.unidade_nome,
    militar.unidade_atual,
  );
}

function obterMatriculaSignatario(militar = {}) {
  return primeiroTexto(
    militar.matricula_atual,
    militar.militar_matricula_atual,
    militar.militar_matricula,
    militar.matricula_documental,
    militar.matricula_operacional,
    militar.matricula,
  );
}

export function normalizarSignatarioMilitar(militar = {}) {
  const fonte = militar && typeof militar === 'object' ? militar : {};
  const nome = primeiroTexto(fonte.nome_completo, fonte.militar_nome, fonte.nome, fonte.nome_guerra);
  const postoGraduacao = primeiroTexto(fonte.posto_graduacao, fonte.militar_posto, fonte.posto, fonte.graduacao);
  const funcao = obterFuncaoSignatario(fonte);
  const lotacao = obterLotacaoSignatario(fonte);
  const detalhesCargo = [funcao, lotacao].filter(Boolean).join(' / ');
  const cargoSignatario = [postoGraduacao, detalhesCargo].filter(Boolean).join(' - ');

  return {
    nomeSignatario: nome,
    cargoSignatario,
    matriculaSignatario: obterMatriculaSignatario(fonte),
  };
}
