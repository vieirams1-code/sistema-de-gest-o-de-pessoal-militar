import { normalizarGrupoId, normalizarTexto } from './normalizacao.js';

export const INSTITUCIONAIS = { comandante: 1, subcomandante: 2 };

export function validarFuncao(payload, funcoes, funcaoEdicao) {
  const nomeNormalizado = normalizarTexto(payload.nome);
  const isInstitucional = Boolean(INSTITUCIONAIS[payload.institucional_chave]);

  if (payload.institucional_chave === 'comandante' && Number(payload.prioridade_lista) !== 1) return 'Comandante deve ter prioridade 1.';
  if (payload.institucional_chave === 'subcomandante' && Number(payload.prioridade_lista) !== 2) return 'Subcomandante deve ter prioridade 2.';
  if (!isInstitucional && Number(payload.prioridade_lista) < 10) return 'Funções personalizadas devem ter prioridade 10 ou maior.';

  const duplicadoNome = funcoes.some((f) =>
    f.ativa && f.id !== funcaoEdicao?.id && normalizarTexto(f.nome) === nomeNormalizado
  );
  if (duplicadoNome) return 'Já existe uma função ativa com esse nome.';

  if (payload.institucional_chave === 'comandante') {
    const temComandante = funcoes.some((f) => f.ativa && f.id !== funcaoEdicao?.id && f.institucional_chave === 'comandante');
    if (temComandante) return 'Já existe uma função ativa com esse nome.';
  }

  if (payload.institucional_chave === 'subcomandante') {
    const temSub = funcoes.some((f) => f.ativa && f.id !== funcaoEdicao?.id && f.institucional_chave === 'subcomandante');
    if (temSub) return 'Já existe uma função ativa com esse nome.';
  }

  return null;
}

export function validarTagGrupo(payload, grupos, grupoEdicao) {
  const nomeNormalizado = normalizarTexto(payload.nome);
  const duplicado = grupos.some((g) => g.ativo && g.id !== grupoEdicao?.id && normalizarTexto(g.nome) === nomeNormalizado);
  return duplicado ? 'Já existe um grupo ativo com esse nome.' : null;
}

export function validarTag(payload, tags, tagEdicao) {
  const nomeNormalizado = normalizarTexto(payload.nome);
  const grupoNormalizado = normalizarGrupoId(payload.grupo_id);

  const duplicado = tags.some((t) => {
    if (!t.ativo || t.id === tagEdicao?.id) return false;
    return normalizarTexto(t.nome) === nomeNormalizado && normalizarGrupoId(t.grupo_id) === grupoNormalizado;
  });

  return duplicado ? 'Já existe uma tag ativa com esse nome neste grupo.' : null;
}
