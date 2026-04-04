export const CATEGORIA_QUADRO_OFICIAL = 'Oficial';
export const CATEGORIA_QUADRO_PRACA = 'Praça';

const POSTOS_OFICIAIS = new Set([
  'coronel',
  'tenente coronel',
  'major',
  'capitao',
  '1 tenente',
  '2 tenente',
  'aspirante',
]);

const POSTOS_PRACAS = new Set([
  'subtenente',
  '1 sargento',
  '2 sargento',
  '3 sargento',
  'cabo',
  'soldado',
]);

function normalizarTexto(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function classificarPostoGraduacao(postoGraduacao) {
  const postoNormalizado = normalizarTexto(postoGraduacao);
  if (!postoNormalizado) return null;

  if (POSTOS_OFICIAIS.has(postoNormalizado)) {
    return CATEGORIA_QUADRO_OFICIAL;
  }

  if (POSTOS_PRACAS.has(postoNormalizado)) {
    return CATEGORIA_QUADRO_PRACA;
  }

  return null;
}

export function validarCompatibilidadePostoQuadro(postoGraduacao, categoriaQuadro) {
  const categoriaPosto = classificarPostoGraduacao(postoGraduacao);
  if (!categoriaPosto || !categoriaQuadro) return false;
  return categoriaPosto === categoriaQuadro;
}
