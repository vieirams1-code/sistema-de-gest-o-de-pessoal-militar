import { base44 } from '@/api/base44Client';

const STATUS_LABELS = {
  pendente_publicacao: 'Pendente de Publicação',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  revertido: 'Revertido',
};

const STATUS_BADGE = {
  pendente_publicacao: 'bg-amber-100 text-amber-800 border-amber-200',
  ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
  revertido: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function getStatusDescontoLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

export function getStatusDescontoBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

function calcStatusPublicacao(pub = {}) {
  if (pub.numero_bg && pub.data_bg) return 'Publicado';
  if (pub.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function getStatusPublicacaoDesconto(desconto, publicacao) {
  if (publicacao) return calcStatusPublicacao(publicacao);
  if (desconto?.publicacao_id) return 'Publicação não encontrada';
  return '—';
}

/**
 * Lista os descontos de férias e enriquece cada um com o status atual
 * da PublicacaoExOfficio vinculada (origem da verdade documental).
 */
export async function listarDescontosFerias() {
  const descontos = await base44.entities.DescontoFerias.list('-created_date');
  const pubIds = [...new Set((descontos || []).map((d) => d.publicacao_id).filter(Boolean))];

  const publicacoesPorId = new Map();
  if (pubIds.length > 0) {
    const publicacoes = await Promise.all(
      pubIds.map((id) => base44.entities.PublicacaoExOfficio.filter({ id }).catch(() => [])),
    );
    publicacoes.flat().forEach((pub) => {
      if (pub?.id) publicacoesPorId.set(pub.id, pub);
    });
  }

  const reversoesPorReferencia = new Map();
  if (pubIds.length > 0) {
    const reversoes = await Promise.all(
      pubIds.map((id) => base44.entities.PublicacaoExOfficio.filter({ publicacao_referencia_id: id }).catch(() => [])),
    );
    reversoes.flat()
      .filter((pub) => pub?.tipo === 'Tornar sem Efeito')
      .forEach((pub) => reversoesPorReferencia.set(pub.publicacao_referencia_id, pub));
  }

  return (descontos || []).map((desconto) => {
    const publicacao = publicacoesPorId.get(desconto.publicacao_id) || null;
    return {
      ...desconto,
      publicacao,
      publicacao_reversao: reversoesPorReferencia.get(desconto.publicacao_id) || null,
      status_publicacao: getStatusPublicacaoDesconto(desconto, publicacao),
    };
  });
}
