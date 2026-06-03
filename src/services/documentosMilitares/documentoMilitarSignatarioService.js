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

function obterQuadroSignatario(militar = {}) {
  return primeiroTexto(
    militar.quadro,
    militar.quadro_nome,
    militar.militar_quadro,
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
  const quadro = obterQuadroSignatario(fonte);
  const funcao = obterFuncaoSignatario(fonte);
  const lotacao = obterLotacaoSignatario(fonte);
  const funcaoComLotacao = [funcao, lotacao].filter(Boolean).join('/');
  const detalhesCargo = [funcao, lotacao].filter(Boolean).join(' / ');
  const cargoSignatario = [postoGraduacao, detalhesCargo].filter(Boolean).join(' - ');
  const matricula = obterMatriculaSignatario(fonte);

  return {
    nomeSignatario: nome,
    postoGraduacaoSignatario: postoGraduacao,
    quadroSignatario: quadro,
    funcaoSignatario: funcaoComLotacao,
    cargoSignatario,
    matriculaSignatario: matricula,
  };
}

export function montarLinhaIdentificacaoSignatario({ nome = '', postoGraduacao = '', quadro = '' } = {}) {
  const nomeSeguro = textoSeguro(nome);
  const postoQuadro = [textoSeguro(postoGraduacao), textoSeguro(quadro)].filter(Boolean).join(' ');

  if (nomeSeguro && postoQuadro) return `${nomeSeguro} - ${postoQuadro}`;
  return nomeSeguro || postoQuadro;
}

export function montarAssinaturaSignatario({ nome = '', postoGraduacao = '', quadro = '', matricula = '', funcao = '' } = {}) {
  const linhaIdentificacao = montarLinhaIdentificacaoSignatario({ nome, postoGraduacao, quadro });
  const matriculaSegura = textoSeguro(matricula);

  return [
    linhaIdentificacao,
    matriculaSegura ? `Matrícula ${matriculaSegura}` : '',
    textoSeguro(funcao),
  ].filter(Boolean).join('\n');
}

export function montarVariaveisSignatarioDocumentoMilitar(signatario = {}) {
  const fonte = signatario && typeof signatario === 'object' ? signatario : {};
  const nome = primeiroTexto(fonte.signatario_nome, fonte.nomeSignatario, fonte.nome, fonte.nome_completo);
  const postoGraduacao = primeiroTexto(
    fonte.signatario_posto_graduacao,
    fonte.postoGraduacaoSignatario,
    fonte.posto_graduacao,
    fonte.posto,
    fonte.graduacao,
  );
  const quadro = primeiroTexto(fonte.signatario_quadro, fonte.quadroSignatario, fonte.quadro, fonte.quadro_nome, fonte.militar_quadro);
  const matricula = primeiroTexto(fonte.signatario_matricula, fonte.matriculaSignatario, fonte.matricula_atual, fonte.matricula);
  const funcao = primeiroTexto(fonte.signatario_funcao, fonte.funcaoSignatario, fonte.funcao, fonte.cargoSignatario);

  return {
    signatario_nome: nome,
    signatario_posto_graduacao: postoGraduacao,
    signatario_quadro: quadro,
    signatario_matricula: matricula,
    signatario_funcao: funcao,
    assinatura_signatario: montarAssinaturaSignatario({ nome, postoGraduacao, quadro, matricula, funcao }),
  };
}
