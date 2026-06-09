import { base44 } from '@/api/base44Client';
import { calcularFoiApostilada } from '@/components/publicacao/apostilaUtils';
import { vinculaRegistroAoMilitar } from './registrosMilitarMatcher.js';

function limparTexto(valor) {
  return String(valor || '').trim();
}

function normalizarTextoComparacao(valor) {
  return limparTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extrairOrigemRegistro(registro) {
  const origem = normalizarTextoComparacao(registro?.origem_registro);
  if (origem === 'legado') return 'legado';
  if (registro?.importado_legado === true) return 'legado';
  return 'sistema';
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

export { vinculaRegistroAoMilitar };

export async function listarRegistrosMilitar() {
  const [registrosSistema, registrosExOfficio] = await Promise.all([
    base44.entities.RegistroLivro.list('-created_date', 10000),
    base44.entities.PublicacaoExOfficio.list('-created_date', 10000),
  ]);

  const sistemaNormalizado = (Array.isArray(registrosSistema) ? registrosSistema : []).map((registro) => normalizarRegistro(registro, 'RegistroLivro'));
  const exOfficioNormalizado = (Array.isArray(registrosExOfficio) ? registrosExOfficio : []).map((registro) => normalizarRegistro(registro, 'PublicacaoExOfficio'));
  const registrosUnificados = [...sistemaNormalizado, ...exOfficioNormalizado];

  const porId = new Map(registrosUnificados.map((r) => [r.id, r]));
  const porReferenciaId = new Map();
  for (const r of registrosUnificados) {
    if (r.publicacao_referencia_id) {
      if (!porReferenciaId.has(r.publicacao_referencia_id)) porReferenciaId.set(r.publicacao_referencia_id, []);
      porReferenciaId.get(r.publicacao_referencia_id).push(r);
    }
  }

  return registrosUnificados.map((registro) => {
    const relacionados = porReferenciaId.get(registro.id) || [];
    const apostilas = relacionados.filter((item) => item.tipo === 'Apostila');

    const tsesPorApostila = apostilas.map((apostila) => {
      let tse = null;
      if (apostila.tornada_sem_efeito_por_id) {
        tse = porId.get(apostila.tornada_sem_efeito_por_id);
      } else {
        const relApostila = porReferenciaId.get(apostila.id) || [];
        tse = relApostila.find((item) => item.tipo === 'Tornar sem Efeito') || null;
      }
      return { apostila, tse };
    });

    const foiApostilada = calcularFoiApostilada({
      raiz: registro,
      apostilas,
      tsesPorApostila,
    });

    let tseVinculada = null;
    if (registro.tornada_sem_efeito_por_id) {
      tseVinculada = porId.get(registro.tornada_sem_efeito_por_id);
    } else {
      tseVinculada = relacionados.find((item) => item.tipo === 'Tornar sem Efeito');
    }

    return {
      ...registro,
      marcador_apostilada: Boolean(foiApostilada),
      marcador_tornada_sem_efeito: Boolean(registro.tornada_sem_efeito_por_id || tseVinculada),
    };
  });
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
