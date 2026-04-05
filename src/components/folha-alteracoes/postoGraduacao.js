const ABREVIACOES_BASE = {
  CORONEL: 'CEL',
  'TENENTE CORONEL': 'TC',
  MAJOR: 'MAJ',
  CAPITAO: 'CAP',
  ASPIRANTE: 'ASP',
  SUBTENENTE: 'ST',
  SARGENTO: 'SGT',
  CABO: 'CB',
  SOLDADO: 'SD',
};

const ABREVIACOES_COMPOSTAS = {
  '1 TENENTE': '1° TEN',
  '2 TENENTE': '2° TEN',
  '1 SARGENTO': '1° SGT',
  '2 SARGENTO': '2° SGT',
  '3 SARGENTO': '3° SGT',
};

function normalizarPostoGraduacao(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/º|°/g, '')
    .replace(/\s+/g, ' ');
}

export function abreviarPostoGraduacao(postoGraduacao) {
  const valorOriginal = String(postoGraduacao || '').trim();
  if (!valorOriginal) return '';

  const normalizado = normalizarPostoGraduacao(valorOriginal);

  if (ABREVIACOES_COMPOSTAS[normalizado]) {
    return ABREVIACOES_COMPOSTAS[normalizado];
  }

  if (ABREVIACOES_BASE[normalizado]) {
    return ABREVIACOES_BASE[normalizado];
  }

  const matchComposto = normalizado.match(/^(\d+) (TENENTE|SARGENTO)$/);
  if (matchComposto) {
    const [, numero, posto] = matchComposto;
    const sufixo = posto === 'TENENTE' ? 'TEN' : 'SGT';
    return `${numero}° ${sufixo}`;
  }

  return valorOriginal.toUpperCase();
}

export function montarLinhaAssinatura(nome, postoGraduacao, quadro) {
  const nomeNormalizado = String(nome || '').trim();
  const postoAbreviado = abreviarPostoGraduacao(postoGraduacao);
  const quadroNormalizado = String(quadro || '').trim().toUpperCase();
  const postoComQuadro = [postoAbreviado, quadroNormalizado].filter(Boolean).join('\u00A0').trim();

  return [nomeNormalizado, postoComQuadro].filter(Boolean).join(' - ');
}
