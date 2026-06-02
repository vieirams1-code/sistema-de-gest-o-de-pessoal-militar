import { getFuncaoMilitarId, getMilitarTagMilitarId, getMilitarTagTagId, isRegistroAtivo } from './contratoCampos.js';
import { resolveTagVisual } from '../tags/tagPresenter.js';

const EMOJI_PADRAO_FUNCAO = '⭐';
const EMOJI_PADRAO_TAG = '🏷️';
const LIMITE_ICONES_PADRAO = 4;

const TAGS_PRIORITARIAS_CHAVES = ['motorista', 'aph', 'altura', 'restricao', 'instrutor'];

const normalizarChave = (valor) => String(valor || '').trim().toLowerCase();
const getMilitarFuncaoMilitarId = (vinculo = {}) => vinculo?.militar_id || vinculo?.militarId || vinculo?.militar?.id || null;
const resolveIconeFuncao = (funcao = {}) => {
  const chave = normalizarChave(funcao?.institucional_chave);
  if (chave === 'comandante') return 'estrela_amarela_comandante';
  if (chave === 'subcomandante') return 'estrela_azul_subcomandante';
  return String(funcao?.emoji || EMOJI_PADRAO_FUNCAO);
};

const isTipoVisualChip = (registro = {}) => {
  const tipoVisual = String(registro?.tipo_visual || '').trim().toLowerCase();
  return tipoVisual === '' || tipoVisual === 'chip';
};

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
    .filter((vinculo) => isRegistroAtivo(vinculo) && String(getMilitarFuncaoMilitarId(vinculo) || '') === militarKey)
    .map((vinculo) => funcoesById.get(String(getFuncaoMilitarId(vinculo) || '')))
    .filter((funcao) => {
      const chave = normalizarChave(funcao?.institucional_chave);
      return chave === 'comandante' || chave === 'subcomandante';
    })
    .sort((a, b) => (Number(a?.prioridade_lista) || 999) - (Number(b?.prioridade_lista) || 999))
    .map((funcao) => ({
      emoji: resolveIconeFuncao(funcao),
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
    .map((vinculo) => {
      const tagId = String(getMilitarTagTagId(vinculo) || '');
      const tagCatalogo = tagsById.get(tagId);
      const tagFallback = vinculo?.tag || vinculo?.Tag || vinculo?.tag_data || null;
      const tag = tagCatalogo || tagFallback;
      return { tag, tagCatalogo };
    })
    .filter(({ tag }) => Boolean(tag))
    .map(({ tag, tagCatalogo }) => {
      const origem = tagCatalogo || tag;
      const chave = normalizarChave(origem?.slug || origem?.chave || origem?.nome);
      const indicePrioridade = TAGS_PRIORITARIAS_CHAVES.indexOf(chave);
      return {
        emoji: resolveTagVisual(origem).emoji,
        nome: resolveTagVisual(origem).nome,
        tipo: 'tag',
        prioridade: indicePrioridade >= 0 ? 4 : (isTipoVisualChip(tag) ? 5 : 6),
        ordemPrioritaria: indicePrioridade >= 0 ? indicePrioridade : 999,
      };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      if (a.prioridade === 4 && a.ordemPrioritaria !== b.ordemPrioritaria) return a.ordemPrioritaria - b.ordemPrioritaria;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

export function getAtributosCompactosEfetivo(params = {}) {
  const funcoes = getFuncoesInstitucionaisCompactas(params).map((item) => ({ ...item, prioridade: 1 }));
  const tags = getTagsCompactasMilitar(params);
  const combinados = [...funcoes, ...tags];

  const vistos = new Set();
  return combinados.filter((item) => {
    const chave = `${item.tipo}|${normalizarChave(item.nome)}|${item.emoji}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function getEmojisEfetivo({ militarId, funcoesInstitucionais = [], vinculosFuncoesAtivos = [], tagsAtivas = [], vinculosTagsAtivos = [], limiteIcones = LIMITE_ICONES_PADRAO }) {
  const combinados = getAtributosCompactosEfetivo({ militarId, funcoesInstitucionais, vinculosFuncoesAtivos, tagsAtivas, vinculosTagsAtivos });
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
