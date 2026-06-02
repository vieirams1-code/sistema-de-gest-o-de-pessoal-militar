const PLACEHOLDER_REGEX = /{{\s*([\w.]+)\s*}}/g;

export function substituirVariaveisDocumentoMilitar(template = '', variaveis = {}) {
  const texto = typeof template === 'string' ? template : '';
  const fonte = variaveis && typeof variaveis === 'object' ? variaveis : {};

  return texto.replace(PLACEHOLDER_REGEX, (_, chave) => {
    if (!Object.hasOwn(fonte, chave)) return '';

    const valor = fonte[chave];
    if (typeof valor !== 'string' && typeof valor !== 'number') return '';

    return String(valor);
  });
}
