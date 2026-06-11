const hasItems = (items) => Array.isArray(items) && items.length > 0;

export function canShowAtestadosTab({
  atestados = [],
  isLoadingAtestados = false,
  canAccessModule = () => false,
  canAccessAction = () => false,
} = {}) {
  if (hasItems(atestados)) return true;
  if (isLoadingAtestados) return true;

  return Boolean(
    canAccessModule('atestados')
    || canAccessAction('visualizar_atestados')
    || canAccessAction('adicionar_atestados')
    || canAccessAction('editar_atestados')
    || canAccessAction('excluir_atestados')
    || canAccessAction('excluir_atestado')
    || canAccessAction('ver_dados_sensiveis_atestado')
    || canAccessAction('gerar_relatorio_dp_dintel_atestados')
    || canAccessAction('gerir_encaminhamento_dp_dintel_atestado')
  );
}

export function canShowArmamentosTab({
  armamentos = [],
  isLoadingArmamentos = false,
  canAccessModule = () => false,
  canAccessAction = () => false,
} = {}) {
  if (hasItems(armamentos)) return true;
  if (isLoadingArmamentos) return true;

  return Boolean(
    canAccessModule('armamentos')
    || canAccessAction('visualizar_armamentos')
    || canAccessAction('adicionar_armamentos')
    || canAccessAction('editar_armamentos')
    || canAccessAction('excluir_armamentos')
  );
}
