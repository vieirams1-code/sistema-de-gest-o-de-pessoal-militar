export function calcStatusPublicacao(registro = {}) {
  if (registro.numero_bg && registro.data_bg) return 'Publicado';
  if (registro.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

export function isPublicacaoAtestadoAtiva(publicacao) {
  if (!publicacao) return false;
  return !publicacao.tornada_sem_efeito_por_id;
}

export function getAtestadoIdsVinculados(publicacao) {
  if (!publicacao) return [];

  const ids = [];
  if (publicacao.atestado_homologado_id) {
    ids.push(publicacao.atestado_homologado_id);
  }

  if (Array.isArray(publicacao.atestados_jiso_ids)) {
    ids.push(...publicacao.atestados_jiso_ids);
  }

  return [...new Set(ids.filter(Boolean))];
}

export function getEstadoAtestadoPorPublicacoes(atestado, publicacoesVinculadas = []) {
  const ativas = publicacoesVinculadas.filter(isPublicacaoAtestadoAtiva);
  const homologacoesAtivas = ativas.filter(
    (p) => p.tipo === 'Homologação de Atestado' && p.atestado_homologado_id === atestado.id
  );
  const atasAtivas = ativas.filter(
    (p) => p.tipo === 'Ata JISO' && (p.atestados_jiso_ids || []).includes(atestado.id)
  );

  const ultimaPublicacaoAtiva = [...homologacoesAtivas, ...atasAtivas].sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  )[0];

  const precisaJiso = atestado?.necessita_jiso || atestado?.fluxo_homologacao === 'jiso' || Number(atestado?.dias || 0) > 15;

  let statusJiso = null;
  if (atasAtivas.length > 0) {
    statusJiso = 'Homologado pela JISO';
  } else if (homologacoesAtivas.length > 0) {
    statusJiso = 'Homologado pelo Comandante';
  } else if (precisaJiso) {
    statusJiso = 'Aguardando JISO';
  }

  return {
    homologado_comandante: homologacoesAtivas.length > 0,
    status_jiso: statusJiso,
    status_publicacao: ultimaPublicacaoAtiva ? calcStatusPublicacao(ultimaPublicacaoAtiva) : 'Aguardando Nota',
  };
}

export async function reverterAtestadosPorExclusaoPublicacao(publicacaoExcluida, atestadoEntity, publicacaoEntity) {
  const atestadoIds = getAtestadoIdsVinculados(publicacaoExcluida);
  if (!atestadoIds.length) return;

  for (const atestadoId of atestadoIds) {
    const [atestado] = await atestadoEntity.filter({ id: atestadoId });
    if (!atestado) continue;

    const publicacoesMilitar = await publicacaoEntity.filter({ militar_id: atestado.militar_id });
    const vinculadas = publicacoesMilitar.filter(
      (p) => p.id !== publicacaoExcluida.id && getAtestadoIdsVinculados(p).includes(atestadoId)
    );

    const payload = getEstadoAtestadoPorPublicacoes(atestado, vinculadas);
    await atestadoEntity.update(atestadoId, payload);
  }
}

export function existePublicacaoAtivaParaAtestado(publicacoes = [], atestadoId, tipoPublicacao, publicacaoIgnoradaId = null) {
  return publicacoes.some((publicacao) => {
    if (!isPublicacaoAtestadoAtiva(publicacao)) return false;
    if (publicacaoIgnoradaId && publicacao.id === publicacaoIgnoradaId) return false;
    if (publicacao.tipo !== tipoPublicacao) return false;

    if (tipoPublicacao === 'Homologação de Atestado') {
      return publicacao.atestado_homologado_id === atestadoId;
    }

    if (tipoPublicacao === 'Ata JISO') {
      return (publicacao.atestados_jiso_ids || []).includes(atestadoId);
    }

    return false;
  });
}
