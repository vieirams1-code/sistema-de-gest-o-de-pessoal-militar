import { format } from 'date-fns';

const PRIORIDADE_ORDEM = { critica: 0, alta: 1, media: 2, baixa: 3 };

export const normalizarTexto = (value) => String(value || '').trim().toLowerCase();

export function formatarDataSegura(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'dd/MM/yyyy');
}

export function diferencaDias(dataRef, base = new Date()) {
  if (!dataRef) return null;
  const alvo = new Date(`${String(dataRef).slice(0, 10)}T00:00:00`);
  const hoje = new Date(base);
  alvo.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.floor((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function calcularPrioridadePorPrazo({ diasParaVencer, vencido = false, status = '' } = {}) {
  const statusNorm = normalizarTexto(status);
  if (vencido || statusNorm.includes('vencid')) return 'critica';
  if (diasParaVencer !== null && diasParaVencer <= 3) return 'critica';
  if (diasParaVencer !== null && diasParaVencer <= 15) return 'alta';
  if (statusNorm.includes('aguardando')) return 'alta';
  if (diasParaVencer !== null && diasParaVencer <= 30) return 'media';
  return 'media';
}

export function normalizarTipoCategoria(categoria) {
  const norm = normalizarTexto(categoria);
  if (norm.includes('publica')) return 'publicacoes';
  if (norm.includes('atestado')) return 'atestados';
  if (norm.includes('féri') || norm.includes('feria')) return 'ferias';
  if (norm.includes('comport')) return 'comportamento';
  if (norm.includes('legado') || norm.includes('duplicidade')) return 'legado';
  return 'outros';
}

export function montarDescricaoCurta({ situacao, detalhe, dataReferencia }) {
  const partes = [situacao, detalhe, dataReferencia ? `Ref.: ${formatarDataSegura(dataReferencia)}` : ''].filter(Boolean);
  return partes.join(' • ');
}

export function ordenarPendencias(lista = [], ordenacao = 'prioridade_desc') {
  const itens = [...(lista || [])];
  if (ordenacao === 'data_desc') return itens.sort((a, b) => new Date(b.dataReferencia || 0) - new Date(a.dataReferencia || 0));
  if (ordenacao === 'data_asc') return itens.sort((a, b) => new Date(a.dataReferencia || 0) - new Date(b.dataReferencia || 0));

  return itens.sort((a, b) => {
    const pa = PRIORIDADE_ORDEM[a.prioridade] ?? 9;
    const pb = PRIORIDADE_ORDEM[b.prioridade] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.dataReferencia || 0) - new Date(a.dataReferencia || 0);
  });
}

export function filtrarPendencias(lista = [], filtros = {}) {
  const texto = normalizarTexto(filtros.texto);
  return (lista || []).filter((item) => {
    if (filtros.categoria && filtros.categoria !== 'todas' && item.categoriaSlug !== filtros.categoria) return false;
    if (filtros.prioridade && filtros.prioridade !== 'todas' && item.prioridade !== filtros.prioridade) return false;
    if (filtros.situacao && filtros.situacao !== 'todas') {
      const statusNorm = normalizarTexto(item.situacao);
      if (!statusNorm.includes(normalizarTexto(filtros.situacao))) return false;
    }
    if (!texto) return true;
    const alvo = [item.titulo, item.descricao, item.militar, item.setor, item.origem].join(' ').toLowerCase();
    return alvo.includes(texto);
  });
}
