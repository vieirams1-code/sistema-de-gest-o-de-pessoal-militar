import { base44 } from '@/api/base44Client';

const ENTITY = () => base44.entities.ClassificacaoHistoricaAlteracao;

export const CLASSIFICACOES_HISTORICAS_INICIAIS = [
  { nome: 'Concessão de Férias', grupo: 'Férias', ordem: 10 },
  { nome: 'Transcrição de Documento', grupo: 'Administrativo', ordem: 20 },
  { nome: 'Movimentação', grupo: 'Movimentação', ordem: 30 },
  { nome: 'Apresentação', grupo: 'Movimentação', ordem: 40 },
  { nome: 'Designação', grupo: 'Função', ordem: 50 },
  { nome: 'Dispensa', grupo: 'Função', ordem: 60 },
  { nome: 'Curso', grupo: 'Capacitação', ordem: 70 },
  { nome: 'Elogio', grupo: 'Disciplina', ordem: 80 },
  { nome: 'Punição', grupo: 'Disciplina', ordem: 90 },
  { nome: 'Outros', grupo: 'Geral', ordem: 100 },
];

export function normalizarClassificacaoHistoricaForm(form = {}) {
  const ordemTexto = form.ordem === null || form.ordem === undefined ? '' : String(form.ordem).trim();
  const ordem = ordemTexto === '' ? null : Number(ordemTexto);

  return {
    nome: String(form.nome || '').trim(),
    grupo: String(form.grupo || '').trim(),
    descricao: String(form.descricao || '').trim(),
    ativo: form.ativo !== false,
    ordem: Number.isFinite(ordem) ? ordem : null,
    uso_migracao: form.uso_migracao !== false,
    legado: form.legado !== false,
  };
}

export function validarClassificacaoHistoricaForm(payload = {}) {
  if (!String(payload.nome || '').trim()) return 'Informe o nome da classificação histórica.';
  if (payload.ordem !== null && payload.ordem !== undefined && !Number.isFinite(Number(payload.ordem))) {
    return 'Informe uma ordem numérica válida ou deixe o campo em branco.';
  }
  return '';
}

function chaveNomeGrupo(item = {}) {
  return `${String(item.nome || '').trim().toLowerCase()}::${String(item.grupo || '').trim().toLowerCase()}`;
}

export function ordenarClassificacoesHistoricas(classificacoes = []) {
  return [...classificacoes].sort((a, b) => {
    const grupo = String(a?.grupo || '').localeCompare(String(b?.grupo || ''), 'pt-BR', { sensitivity: 'base' });
    if (grupo !== 0) return grupo;

    const ordemA = Number.isFinite(Number(a?.ordem)) ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
    const ordemB = Number.isFinite(Number(b?.ordem)) ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
    if (ordemA !== ordemB) return ordemA - ordemB;

    return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
}

export async function listarClassificacoesHistoricasAlteracoes() {
  const registros = await ENTITY().list('-updated_date', 1000);
  return ordenarClassificacoesHistoricas(registros || []);
}

export async function garantirClassificacoesHistoricasIniciais() {
  const existentes = await listarClassificacoesHistoricasAlteracoes();
  const chavesExistentes = new Set((existentes || []).map(chaveNomeGrupo));
  const faltantes = CLASSIFICACOES_HISTORICAS_INICIAIS.filter((item) => !chavesExistentes.has(chaveNomeGrupo(item)));

  if (!faltantes.length) {
    return { criados: 0, registros: existentes };
  }

  const payloads = faltantes.map((item) => ({
    ...item,
    descricao: '',
    ativo: true,
    uso_migracao: true,
    legado: true,
  }));

  let criados = [];
  if (typeof ENTITY().bulkCreate === 'function') {
    criados = await ENTITY().bulkCreate(payloads);
  } else {
    criados = await Promise.all(payloads.map((p) => ENTITY().create(p)));
  }

  return {
    criados: criados.length,
    registros: ordenarClassificacoesHistoricas([...existentes, ...criados]),
  };
}

export async function salvarClassificacaoHistoricaAlteracao(id, form) {
  const payload = normalizarClassificacaoHistoricaForm(form);
  const erro = validarClassificacaoHistoricaForm(payload);
  if (erro) throw new Error(erro);
  return id ? ENTITY().update(id, payload) : ENTITY().create(payload);
}

export async function alternarStatusClassificacaoHistoricaAlteracao(classificacao) {
  if (!classificacao?.id) throw new Error('Classificação histórica não identificada.');
  return ENTITY().update(classificacao.id, { ativo: classificacao.ativo === false });
}
