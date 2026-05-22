import { APLICABILIDADE_TAG_MILITAR } from './militarTags';
import { getFuncaoMilitarId, getTagGrupoId, isRegistroAtivo } from './contratoCampos';

const normalizar = (valor) => String(valor || '').trim().toLowerCase();

function ordenarFuncoes(a = {}, b = {}) {
  const prioridadeA = Number.isFinite(Number(a?.prioridade_lista)) ? Number(a?.prioridade_lista) : Number.POSITIVE_INFINITY;
  const prioridadeB = Number.isFinite(Number(b?.prioridade_lista)) ? Number(b?.prioridade_lista) : Number.POSITIVE_INFINITY;
  if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
  return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });
}

function ordenarTags(a = {}, b = {}) {
  const grupoA = String(a?.grupo_nome || '').trim();
  const grupoB = String(b?.grupo_nome || '').trim();
  const porGrupo = grupoA.localeCompare(grupoB, 'pt-BR', { sensitivity: 'base' });
  if (porGrupo !== 0) return porGrupo;
  const ordemA = Number.isFinite(Number(a?.ordem_lista)) ? Number(a?.ordem_lista) : Number.POSITIVE_INFINITY;
  const ordemB = Number.isFinite(Number(b?.ordem_lista)) ? Number(b?.ordem_lista) : Number.POSITIVE_INFINITY;
  if (ordemA !== ordemB) return ordemA - ordemB;
  return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });
}

export function enriquecerMilitaresComFuncoesETags({ militares = [], vinculosFuncoesAtivos = [], funcoesAtivas = [], vinculosTagsAtivos = [], tagsAtivas = [], gruposTagsAtivos = [] }) {
  const funcoesById = new Map(funcoesAtivas.map((funcao) => [String(funcao?.id || '').trim(), funcao]));
  const gruposById = new Map(gruposTagsAtivos.map((grupo) => [String(grupo?.id || '').trim(), grupo]));
  const tagsById = new Map(
    tagsAtivas
      .filter((tag) => APLICABILIDADE_TAG_MILITAR.has(normalizar(tag?.aplicabilidade)))
      .map((tag) => [String(tag?.id || '').trim(), tag]),
  );

  const funcoesAtivasByMilitar = new Map();
  vinculosFuncoesAtivos.forEach((vinculo) => {
    if (!isRegistroAtivo(vinculo)) return;
    const militarId = String(vinculo?.militar_id || '').trim();
    const funcao = funcoesById.get(String(getFuncaoMilitarId(vinculo) || '').trim());
    if (!militarId || !funcao) return;
    if (!funcoesAtivasByMilitar.has(militarId)) funcoesAtivasByMilitar.set(militarId, []);
    funcoesAtivasByMilitar.get(militarId).push({ ...funcao, principal: vinculo?.principal === true });
  });

  const tagsAtivasByMilitar = new Map();
  vinculosTagsAtivos.forEach((vinculo) => {
    if (!isRegistroAtivo(vinculo)) return;
    const militarId = String(vinculo?.militar_id || '').trim();
    const tag = tagsById.get(String(vinculo?.tag_id || '').trim());
    if (!militarId || !tag) return;
    const grupo = gruposById.get(String(getTagGrupoId(tag) || '').trim());
    if (!tagsAtivasByMilitar.has(militarId)) tagsAtivasByMilitar.set(militarId, []);
    tagsAtivasByMilitar.get(militarId).push({ ...tag, grupo_nome: String(grupo?.nome || '').trim() });
  });

  return militares.map((militar) => {
    const militarId = String(militar?.id || '').trim();
    const funcoesOrdenadas = [...(funcoesAtivasByMilitar.get(militarId) || [])].sort(ordenarFuncoes);
    const principal = funcoesOrdenadas.find((funcao) => funcao.principal) || funcoesOrdenadas[0] || null;
    const tagsOrdenadas = [...(tagsAtivasByMilitar.get(militarId) || [])].sort(ordenarTags);
    const gruposUnicos = [...new Set(tagsOrdenadas.map((tag) => tag.grupo_nome).filter(Boolean))];

    return {
      ...militar,
      funcao_principal: principal?.nome || '',
      funcoes: funcoesOrdenadas.map((funcao) => String(funcao?.nome || '').trim()).filter(Boolean).join(' | '),
      tags: tagsOrdenadas.map((tag) => String(tag?.nome || '').trim()).filter(Boolean).join(' | '),
      grupos_tags: gruposUnicos.join(' | '),
    };
  });
}
