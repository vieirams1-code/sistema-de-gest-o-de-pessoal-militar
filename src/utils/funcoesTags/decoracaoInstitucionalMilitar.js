import { normalizarChaveInstitucional } from './militarFuncoes';

const DEFAULT_RANK = 100;

const PRIORIDADE_POR_CHAVE = {
  comandante: 1,
  subcomandante: 2,
};

const BADGE_DEFAULT = {
  emoji: '🏷️',
  nome: 'Função institucional',
  cor: '#64748B',
};

export function getSortRankFuncional(chave) {
  return PRIORIDADE_POR_CHAVE[chave] ?? DEFAULT_RANK;
}

function sortByPrioridade(a, b) {
  const pa = Number(a?.prioridade_lista ?? Number.MAX_SAFE_INTEGER);
  const pb = Number(b?.prioridade_lista ?? Number.MAX_SAFE_INTEGER);
  if (pa !== pb) return pa - pb;
  return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR');
}

export function montarDecoracoesInstitucionaisPorMilitar({ militares = [], funcoesInstitucionais = [], vinculosAtivos = [] }) {
  const militaresIds = new Set(militares.map((m) => String(m?.id || '')).filter(Boolean));
  const funcoesById = new Map(funcoesInstitucionais.map((f) => [String(f?.id || ''), f]));
  const vinculadosByMilitar = new Map();

  vinculosAtivos.forEach((vinculo) => {
    const militarId = String(vinculo?.militar_id || '');
    if (!militaresIds.has(militarId)) return;

    const funcao = funcoesById.get(String(vinculo?.funcao_id || ''));
    if (!funcao) return;

    const chave = normalizarChaveInstitucional(funcao?.institucional_chave);
    if (!PRIORIDADE_POR_CHAVE[chave]) return;

    if (!vinculadosByMilitar.has(militarId)) vinculadosByMilitar.set(militarId, []);
    vinculadosByMilitar.get(militarId).push(funcao);
  });

  const decoracaoByMilitar = new Map();

  militares.forEach((militar) => {
    const militarId = String(militar?.id || '');
    const funcoes = (vinculadosByMilitar.get(militarId) || []).slice().sort(sortByPrioridade);
    const escolhida = funcoes[0] || null;

    if (process.env.NODE_ENV === 'development' && funcoes.length > 1) {
      console.warn('[funcoes-tags] Militar com múltiplas funções institucionais ativas', {
        militar_id: militarId,
        funcoes: funcoes.map((f) => ({ id: f.id, nome: f.nome, prioridade_lista: f.prioridade_lista })),
      });
    }

    const chave = normalizarChaveInstitucional(escolhida?.institucional_chave);
    decoracaoByMilitar.set(militarId, {
      militar_id: militarId,
      funcaoInstitucional: escolhida ? {
        chave,
        nome: escolhida?.nome || null,
        emoji: escolhida?.emoji || null,
        cor: escolhida?.cor || null,
        prioridade_lista: Number(escolhida?.prioridade_lista ?? null),
      } : null,
      sort_rank_funcional: getSortRankFuncional(chave),
    });
  });

  return decoracaoByMilitar;
}

export function getDecoracaoInstitucionalMilitar(decoracoesByMilitar = new Map(), militarId) {
  return decoracoesByMilitar.get(String(militarId || '')) || null;
}

export function getBadgeInstitucionalProps(input) {
  const funcao = input?.funcaoInstitucional || input;
  if (!funcao) return null;
  return {
    emoji: funcao?.emoji || BADGE_DEFAULT.emoji,
    nome: funcao?.nome || BADGE_DEFAULT.nome,
    cor: funcao?.cor || BADGE_DEFAULT.cor,
    chave: normalizarChaveInstitucional(funcao?.chave || funcao?.institucional_chave || ''),
  };
}

export function ordenarComDestaqueInstitucional(militares = [], decoracaoByMilitar = new Map()) {
  return militares
    .map((militar, index) => ({ militar, index, rank: decoracaoByMilitar.get(String(militar?.id || ''))?.sort_rank_funcional ?? DEFAULT_RANK }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map((item) => item.militar);
}

