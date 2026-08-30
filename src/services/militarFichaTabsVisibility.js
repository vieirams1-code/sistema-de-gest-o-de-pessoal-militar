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
    && canAccessAction('visualizar_atestados')
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
    && canAccessAction('visualizar_armamentos')
  );
}
