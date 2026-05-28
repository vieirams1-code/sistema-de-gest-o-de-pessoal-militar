export const resolvePostoGraduacao = (m = {}) => String(m.posto_graduacao || m.posto_grad || m.posto || m.graduacao || '').toUpperCase();
export const toQuadro = (m = {}) => String(m.quadro || m.condicao || m.situacao || 'Não informada').toUpperCase();

const isTemporario = (m = {}) => /(TEMP|VOLUNT|CONTRAT|QOETBM|QOSTBM|QPTBM)/i.test([m.condicao, m.quadro, m.situacao, m.vinculo, m.tipo_vinculo, m.regime].join(' '));
const isOficial = (m = {}) => /(CEL|TCEL|MAJ|CAP|TEN|ASP|QOBM|QAOBM|QOEBM|QOSAU|OFICIAL|CORONEL)/i.test(`${resolvePostoGraduacao(m)} ${toQuadro(m)}`);

export const classificarMilitar = (m = {}) => {
  if (isTemporario(m)) return 'temporario';
  if (isOficial(m)) return 'oficial';
  return 'praca';
};

const compararFallbackEstavel = (a, b) => {
  const nomeA = String(a?.nome || a?.nome_completo || a?.nome_guerra || '').trim();
  const nomeB = String(b?.nome || b?.nome_completo || b?.nome_guerra || '').trim();
  if (nomeA !== nomeB) return nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true });
  const matriculaA = String(a?.matricula || '').trim();
  const matriculaB = String(b?.matricula || '').trim();
  if (matriculaA !== matriculaB) return matriculaA.localeCompare(matriculaB, 'pt-BR', { numeric: true });
  return String(a?.id || '').localeCompare(String(b?.id || ''), 'pt-BR', { numeric: true });
};

export const ordenarMilitaresAntiguidade = (militares = [], ordemAntiguidadeMap = new Map()) => militares
  .map((militar, index) => ({ militar, index }))
  .sort((a, b) => {
    const posA = ordemAntiguidadeMap.get(String(a?.militar?.id || ''));
    const posB = ordemAntiguidadeMap.get(String(b?.militar?.id || ''));
    const ordemA = Number.isFinite(posA) ? posA : Number.POSITIVE_INFINITY;
    const ordemB = Number.isFinite(posB) ? posB : Number.POSITIVE_INFINITY;
    if (ordemA !== ordemB) return ordemA - ordemB;
    if (!Number.isFinite(posA) && !Number.isFinite(posB)) return compararFallbackEstavel(a.militar, b.militar);
    return a.index - b.index;
  })
  .map((item) => item.militar);
