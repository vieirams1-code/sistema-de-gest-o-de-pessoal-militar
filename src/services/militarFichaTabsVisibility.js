const hasItems = (items) => Array.isArray(items) && items.length > 0;

export function canShowAtestadosTab({
  atestados = [],
  isLoadingAtestados = false,
  canAccessModule = () => false,
  canAccessAction = () => false,
} = {}) {
  const autorizado = Boolean(
    canAccessModule('atestados')
    && canAccessAction('visualizar_atestados')
  );
  if (!autorizado) return false;
  if (hasItems(atestados)) return true;
  if (isLoadingAtestados) return true;
  return true;
}

export function canShowArmamentosTab({
  armamentos = [],
  isLoadingArmamentos = false,
  canAccessModule = () => false,
  canAccessAction = () => false,
} = {}) {
  const autorizado = Boolean(
    canAccessModule('armamentos')
    && canAccessAction('visualizar_armamentos')
  );
  if (!autorizado) return false;
  if (hasItems(armamentos)) return true;
  if (isLoadingArmamentos) return true;
  return true;
}
