import { getMilitarTagMilitarId, getMilitarTagTagId, isRegistroAtivo } from './contratoCampos';

const EMOJI_PADRAO_FUNCAO = '⭐';
const EMOJI_PADRAO_TAG = '🏷️';
const LIMITE_ICONES_PADRAO = 4;

const TAGS_PRIORITARIAS_CHAVES = ['motorista', 'aph', 'altura', 'restricao', 'instrutor'];

const normalizarChave = (valor) => String(valor || '').trim().toLowerCase();

const montarIndicePorId = (lista = []) => {
  const indice = new Map();
  lista.forEach((item) => {
    const id = String(item?.id || '').trim();
    if (id) indice.set(id, item);
  });
  return indice;
};

export function getFuncoesInstitucionaisCompactas({ militarId, funcoesInstitucionais = [], vinculosFuncoesAtivos = [] }) {
  const militarKey = String(militarId || '').trim();
  if (!militarKey) return [];

  const funcoesById = montarIndicePorId(funcoesInstitucionais);

  return vinculosFuncoesAtivos
    .filter((vinculo) => isRegistroAtivo(vinculo) && String(vinculo?.militar_id || '') === militarKey)
    .map((vinculo) => funcoesById.get(String(vinculo?.funcao_id || '')))
    .filter((funcao) => {
      const chave = normalizarChave(funcao?.institucional_chave);
      return chave === 'comandante' || chave === 'subcomandante';
    })
    .sort((a, b) => (Number(a?.prioridade_lista) || 999) - (Number(b?.prioridade_lista) || 999))
    .map((funcao) => ({
      emoji: String(funcao?.emoji || EMOJI_PADRAO_FUNCAO),
      nome: String(funcao?.nome || '').trim(),
      tipo: 'funcao',
      prioridade: 1,
    }));
}

export function getTagsCompactasMilitar({ militarId, tagsAtivas = [], vinculosTagsAtivos = [] }) {
  const militarKey = String(militarId || '').trim();
  if (!militarKey) return [];

  const tagsById = montarIndicePorId(tagsAtivas);

  return vinculosTagsAtivos
    .filter((vinculo) => isRegistroAtivo(vinculo) && String(getMilitarTagMilitarId(vinculo) || '') === militarKey)
    .map((vinculo) => tagsById.get(String(getMilitarTagTagId(vinculo) || '')))
    .filter(Boolean)
    .map((tag) => {
      const chave = normalizarChave(tag?.slug || tag?.chave || tag?.nome);
      const indicePrioridade = TAGS_PRIORITARIAS_CHAVES.indexOf(chave);
      return {
        emoji: String(tag?.emoji || EMOJI_PADRAO_TAG),
        nome: String(tag?.nome || '').trim(),
        tipo: 'tag',
        prioridade: indicePrioridade >= 0 ? 2 : 3,
        ordemPrioritaria: indicePrioridade >= 0 ? indicePrioridade : 999,
      };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      if (a.prioridade === 2 && a.ordemPrioritaria !== b.ordemPrioritaria) return a.ordemPrioritaria - b.ordemPrioritaria;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

export function getEmojisEfetivo({ militarId, funcoesInstitucionais = [], vinculosFuncoesAtivos = [], tagsAtivas = [], vinculosTagsAtivos = [], limiteIcones = LIMITE_ICONES_PADRAO }) {
  const funcoes = getFuncoesInstitucionaisCompactas({ militarId, funcoesInstitucionais, vinculosFuncoesAtivos });
  const tags = getTagsCompactasMilitar({ militarId, tagsAtivas, vinculosTagsAtivos });

  const combinados = [...funcoes, ...tags];
  if (combinados.length === 0) {
    return { itens: [], excesso: 0, textoExcesso: '' };
  }

  const itens = combinados.slice(0, limiteIcones);
  const excesso = Math.max(0, combinados.length - limiteIcones);

  return {
    itens,
    excesso,
    textoExcesso: excesso > 0 ? `+${excesso}` : '',
  };
}
