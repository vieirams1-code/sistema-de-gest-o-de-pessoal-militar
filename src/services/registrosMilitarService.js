import { base44 } from '@/api/base44Client';

function limparTexto(valor) {
  return String(valor || '').trim();
}

function normalizarTextoComparacao(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarMatricula(valor) {
  return limparTexto(valor).replace(/\D/g, '');
}

function extrairOrigemRegistro(registro) {
  const origem = normalizarTextoComparacao(registro?.origem_registro);
  if (origem === 'legado') return 'legado';
  if (registro?.importado_legado === true) return 'legado';
  return 'sistema';
}

function montarNomesMilitar(militar) {
  const nomes = [
    militar?.nome_completo,
    militar?.nome_guerra,
    militar?.militar_nome,
  ]
    .map((item) => normalizarTextoComparacao(item))
    .filter(Boolean);

  return Array.from(new Set(nomes));
}

function normalizarRegistro(registro, origemFonte) {
  return {
    ...registro,
    origem_fonte: origemFonte,
    origem_registro: extrairOrigemRegistro(registro),
    status_publicacao: registro?.status_publicacao || registro?.status || '',
    militar_nome: registro?.militar_nome || registro?.militar_nome_completo || registro?.nome_completo_legado || '',
    militar_matricula: registro?.militar_matricula || registro?.matricula_legado || '',
  };
}

export function vinculaRegistroAoMilitar(registro, militar) {
  if (!militar || !registro) return false;

  const registroMilitarId = limparTexto(registro?.militar_id || registro?.militarId || registro?.militar?.id || registro?.militar);
  const militarId = limparTexto(militar?.id);
  if (registroMilitarId && militarId && registroMilitarId === militarId) {
    return true;
  }

  const matriculaRegistro = normalizarMatricula(registro?.militar_matricula || registro?.matricula_legado);
  const matriculaMilitar = normalizarMatricula(militar?.matricula || militar?.militar_matricula);
  if (matriculaRegistro && matriculaMilitar && matriculaRegistro === matriculaMilitar) {
    return true;
  }

  const nomeRegistro = normalizarTextoComparacao(
    registro?.militar_nome || registro?.militar_nome_completo || registro?.nome_completo_legado || registro?.nome_guerra_legado,
  );

  if (!nomeRegistro || nomeRegistro.length < 6) return false;

  const nomesMilitar = montarNomesMilitar(militar);

  return nomesMilitar.some((nomeMilitar) => {
    if (!nomeMilitar || nomeMilitar.length < 6) return false;
    return nomeMilitar === nomeRegistro || nomeMilitar.includes(nomeRegistro) || nomeRegistro.includes(nomeMilitar);
  });
}

export async function listarRegistrosMilitar() {
  const [registrosSistema, registrosExOfficio] = await Promise.all([
    base44.entities.RegistroLivro.list('-created_date', 10000),
    base44.entities.PublicacaoExOfficio.list('-created_date', 10000),
  ]);

  const sistemaNormalizado = (Array.isArray(registrosSistema) ? registrosSistema : []).map((registro) => normalizarRegistro(registro, 'RegistroLivro'));
  const exOfficioNormalizado = (Array.isArray(registrosExOfficio) ? registrosExOfficio : []).map((registro) => normalizarRegistro(registro, 'PublicacaoExOfficio'));

  return [...sistemaNormalizado, ...exOfficioNormalizado];
}

function getEntityFromRegistro(registro) {
  if (registro?.origem_fonte === 'PublicacaoExOfficio') return base44.entities.PublicacaoExOfficio;
  return base44.entities.RegistroLivro;
}

export async function atualizarTipoRegistroMilitar(registro, novoTipo, audit = {}) {
  const entity = getEntityFromRegistro(registro);
  const tipoNormalizado = limparTexto(novoTipo);

  const payload = registro?.origem_fonte === 'PublicacaoExOfficio'
    ? { tipo: tipoNormalizado }
    : { tipo_registro: tipoNormalizado };

  if (audit?.userEmail) {
    payload.tipo_alterado_por = audit.userEmail;
    payload.tipo_alterado_em = new Date().toISOString();
  }

  return entity.update(registro.id, payload);
}

export async function excluirRegistroMilitar(registro) {
  const entity = getEntityFromRegistro(registro);
  return entity.delete(registro.id);
}
