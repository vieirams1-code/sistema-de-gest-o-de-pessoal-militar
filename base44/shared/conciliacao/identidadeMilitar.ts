/**
 * Identidade militar na conciliação documental (BG, BGR e DOEMS).
 *
 * Regra única e determinística: um militar só é considerado citado em uma
 * nota quando o texto DA PRÓPRIA NOTA contém
 *   (a) o NOME COMPLETO cadastrado, como sequência contígua de palavras; ou
 *   (b) a MATRÍCULA cadastrada (comparada apenas pelos dígitos).
 *
 * Nome de guerra, sobrenome isolado, iniciais e nomes parecidos NÃO
 * identificam ninguém: era exatamente isso que gerava falsos positivos.
 */

const MIN_DIGITOS_MATRICULA = 5;

// Trechos do boletim que citam militares sem serem o autor do ato: a
// autoridade que aprova e a lista de militares relacionados. Comparar o
// nome completo contra eles criava ambiguidade (ex.: o TC que aprova a
// nota aparecendo como candidato ao lado da Sgt citada no corpo).
const CORTES_DO_ATO = [
  /APROVADO\s+POR\s*:?/i,
  /MILITARES\s+REL\s*ACIONADOS\s+COM\s+A\s+NOTA/i,
];

// Texto em que a identidade é procurada: somente o corpo do ato.
export function textoDoAto(texto) {
  const bruto = String(texto ?? '');
  let corte = bruto.length;
  for (const padrao of CORTES_DO_ATO) {
    const achado = bruto.search(padrao);
    if (achado >= 0 && achado < corte) corte = achado;
  }
  return bruto.slice(0, corte);
}

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function textoSimples(valor, limite) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, limite);
}

// Conjunto de matrículas presentes no texto, já reduzidas a dígitos.
// Aceita 124.324-021, 124324021, 124.324.021 e 124 324 021.
export function extrairMatriculas(texto) {
  const encontradas = new Set();
  const bruto = String(texto ?? '');
  const padrao = /\d(?:[\d.\-/ \t]{2,18})\d/g;
  let achado = padrao.exec(bruto);
  while (achado !== null) {
    const digitos = achado[0].replace(/\D+/g, '');
    if (digitos.length >= MIN_DIGITOS_MATRICULA) encontradas.add(digitos);
    achado = padrao.exec(bruto);
  }
  return encontradas;
}

export function prepararIdentidadeMilitar(bruto) {
  const nomeCompleto = textoSimples(bruto?.nome_completo, 120);
  const matricula = textoSimples(bruto?.matricula, 30);
  return {
    id: String(bruto?.id ?? ''),
    posto: textoSimples(bruto?.posto, 40),
    nome_guerra: textoSimples(bruto?.nome_guerra, 120),
    nome_completo: nomeCompleto,
    matricula,
    nome_chave: normalizarTexto(nomeCompleto),
    matricula_chave: matricula.replace(/\D+/g, ''),
  };
}

// Militares citados no texto de UM item. Retorna apenas correspondências
// completas (nome completo contíguo ou matrícula), com a origem da prova.
export function selecionarCitadosNoItem(texto, militares) {
  const corpo = textoDoAto(texto);
  const normalizado = ' ' + normalizarTexto(corpo) + ' ';
  const matriculas = extrairMatriculas(corpo);
  const citados = [];

  for (const militar of militares || []) {
    if (!militar?.id) continue;
    const viaMatricula = Boolean(militar.matricula_chave)
      && matriculas.has(militar.matricula_chave);
    const partesDoNome = militar.nome_chave ? militar.nome_chave.split(' ') : [];
    const viaNome = partesDoNome.length >= 2
      && normalizado.includes(' ' + militar.nome_chave + ' ');

    if (viaMatricula || viaNome) {
      citados.push({ ...militar, viaMatricula, viaNome });
    }
  }

  return citados;
}

export function descreverMilitar(militar) {
  return [militar?.posto, militar?.nome_guerra || militar?.nome_completo]
    .filter(Boolean).join(' ');
}

export function descreverProva(militar) {
  if (militar?.viaMatricula) return `matrícula ${militar.matricula}`;
  return `nome completo "${militar?.nome_completo || militar?.nome_guerra || ''}"`;
}