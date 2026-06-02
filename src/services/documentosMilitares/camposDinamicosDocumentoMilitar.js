const PLACEHOLDER_CAMPO_DINAMICO_REGEX = /{{\s*campo\s*:\s*([^{}:]+?)\s*}}/gi;

export function normalizarChaveCampoDinamicoDocumentoMilitar(chave = '') {
  return String(chave || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function obterChaveCampoDinamicoDocumentoMilitar(conteudoPlaceholder = '') {
  const match = String(conteudoPlaceholder || '').match(/^campo\s*:\s*([^{}:]+?)\s*$/i);
  if (!match) return '';

  return normalizarChaveCampoDinamicoDocumentoMilitar(match[1]);
}

export function identificarCamposDinamicosDocumentoMilitar(template = '') {
  const texto = typeof template === 'string' ? template : '';
  const campos = [];
  const chavesEncontradas = new Set();

  for (const match of texto.matchAll(PLACEHOLDER_CAMPO_DINAMICO_REGEX)) {
    const chave = normalizarChaveCampoDinamicoDocumentoMilitar(match[1]);
    if (!chave || chavesEncontradas.has(chave)) continue;

    chavesEncontradas.add(chave);
    campos.push(chave);
  }

  return campos;
}

export function substituirCamposDinamicosDocumentoMilitar(template = '', valoresManuais = {}) {
  const texto = typeof template === 'string' ? template : '';
  const fonte = valoresManuais && typeof valoresManuais === 'object' ? valoresManuais : {};
  const valoresNormalizados = new Map();

  for (const [chave, valor] of Object.entries(fonte)) {
    const chaveNormalizada = normalizarChaveCampoDinamicoDocumentoMilitar(chave);
    if (chaveNormalizada) valoresNormalizados.set(chaveNormalizada, valor);
  }

  return texto.replace(PLACEHOLDER_CAMPO_DINAMICO_REGEX, (placeholder, chaveOriginal) => {
    const chave = normalizarChaveCampoDinamicoDocumentoMilitar(chaveOriginal);
    if (!chave || !valoresNormalizados.has(chave)) return placeholder;

    const valor = valoresNormalizados.get(chave);
    if (typeof valor !== 'string' && typeof valor !== 'number') return placeholder;

    return String(valor);
  });
}
