/**
 * Guardas CLIENT-SIDE de apresentação da ficha militar.
 *
 * IMPORTANTE: o escopo e a projeção dos dados são impostos no servidor
 * (getScopedMilitares). Estas funções não substituem a autorização backend.
 */

const mesmoId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);
const emailNormalizado = (value) => String(value || '').trim().toLowerCase();

/**
 * Uma ficha individual só pode exibir o registro que a consulta escopada
 * devolveu para o ID solicitado, com as permissões funcionais atuais.
 * Não tenta reinterpretar o escopo a partir de campos omitidos pelo DTO.
 */
export function canDisplayScopedMilitar({
  militar,
  requestedId,
  isAccessResolved,
  canViewModule,
  canViewAction,
} = {}) {
  return Boolean(
    isAccessResolved
    && canViewModule
    && canViewAction
    && mesmoId(militar?.id, requestedId)
  );
}

/**
 * Compatibilidade para componentes legados que ainda fazem guardas locais
 * sobre dados do militar. Suporta estrutura_id e múltiplos acessos ativos.
 * Resultados deste helper NUNCA devem autorizar uma leitura fora do backend.
 */
export function isMilitarWithinClientScope({
  registro,
  acessos = [],
  unidadesFilhas = [],
  userEmail = null,
} = {}) {
  if (!registro || !Array.isArray(acessos) || acessos.length === 0) return false;

  return acessos.some((acesso) => {
    const tipo = String(acesso?.tipo_acesso || '').trim().toLowerCase();
    if (tipo === 'admin') return true;

    if (tipo === 'setor') {
      const grupoId = acesso?.grupamento_id;
      return Boolean(grupoId) && (
        mesmoId(registro.grupamento_id, grupoId)
        || mesmoId(registro.grupamento_raiz_id, grupoId)
        || mesmoId(registro.estrutura_id, grupoId)
      );
    }

    if (tipo === 'subsetor') {
      const subsetorId = acesso?.subgrupamento_id;
      if (!subsetorId) return false;
      const idsPermitidos = [
        subsetorId,
        ...unidadesFilhas
          .filter((filha) => mesmoId(filha.parent_id, subsetorId))
          .map((filha) => filha.id),
      ];
      return idsPermitidos.some((allowedId) => (
        mesmoId(registro.estrutura_id, allowedId)
        || mesmoId(registro.subgrupamento_id, allowedId)
      ));
    }

    if (tipo === 'unidade') {
      const unidadeId = acesso?.subgrupamento_id;
      return Boolean(unidadeId) && (
        mesmoId(registro.estrutura_id, unidadeId)
        || mesmoId(registro.subgrupamento_id, unidadeId)
      );
    }

    if (['proprio', 'próprio', 'individual', 'self', 'auto'].includes(tipo)) {
      return (
        mesmoId(registro.id, acesso?.militar_id)
        || [registro.created_by, registro.militar_email, registro.email]
          .some((email) => email && (
            emailNormalizado(email) === emailNormalizado(userEmail)
            || emailNormalizado(email) === emailNormalizado(acesso?.militar_email)
          ))
      );
    }

    return false;
  });
}
