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
  const response = await base44.functions.invoke('registrosMilitarGateway', { action: 'LIST' });
  const body = response?.data ?? response ?? {};
  if (body?.error) throw new Error(body.error);
  const data = body?.data ?? body;
  const registrosSistema = Array.isArray(data?.registrosLivro) ? data.registrosLivro : [];
  const registrosExOfficio = Array.isArray(data?.publicacoesExOfficio) ? data.publicacoesExOfficio : [];

  const sistemaNormalizado = registrosSistema.map((registro) => normalizarRegistro(registro, 'RegistroLivro'));
  const exOfficioNormalizado = registrosExOfficio.map((registro) => normalizarRegistro(registro, 'PublicacaoExOfficio'));
  const registrosUnificados = [...sistemaNormalizado, ...exOfficioNormalizado];

  return registrosUnificados.map((registro) => {
    const apostilas = registrosUnificados.filter((item) => item.publicacao_referencia_id === registro.id && item.tipo === 'Apostila');
    const tsesPorApostila = apostilas.map((apostila) => ({
      apostila,
      tse: apostila.tornada_sem_efeito_por_id
        ? registrosUnificados.find((item) => item.id === apostila.tornada_sem_efeito_por_id)
        : registrosUnificados.find((item) => item.publicacao_referencia_id === apostila.id && item.tipo === 'Tornar sem Efeito') || null,
    }));

    const foiApostilada = calcularFoiApostilada({
      raiz: registro,
      apostilas,
      tsesPorApostila,
    });

    const tseVinculada = registro.tornada_sem_efeito_por_id
      ? registrosUnificados.find((item) => item.id === registro.tornada_sem_efeito_por_id)
      : registrosUnificados.find((item) => item.publicacao_referencia_id === registro.id && item.tipo === 'Tornar sem Efeito');

    return {
      ...registro,
      marcador_apostilada: Boolean(foiApostilada),
      marcador_tornada_sem_efeito: Boolean(registro.tornada_sem_efeito_por_id || tseVinculada),
    };
  });
}

function getEntityNameFromRegistro(registro) {
  return registro?.origem_fonte === 'PublicacaoExOfficio' ? 'PublicacaoExOfficio' : 'RegistroLivro';
}

async function invokeRegistrosGateway(action, registro, data = {}) {
  const response = await base44.functions.invoke('registrosMilitarGateway', {
    action,
    entityName: getEntityNameFromRegistro(registro),
    id: registro?.id,
    data,
  });
  const body = response?.data ?? response ?? {};
  if (body?.error) throw new Error(body.error);
  return body?.data ?? body;
}

export async function atualizarTipoRegistroMilitar(registro, novoTipo) {
  const tipoNormalizado = limparTexto(novoTipo);
  const payload = registro?.origem_fonte === 'PublicacaoExOfficio'
    ? { tipo: tipoNormalizado }
    : { tipo_registro: tipoNormalizado };
  return invokeRegistrosGateway('UPDATE_TYPE', registro, payload);
}

export async function excluirRegistroMilitar(registro) {
  return invokeRegistrosGateway('DELETE', registro);
}
