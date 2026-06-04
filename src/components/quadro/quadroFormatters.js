export function buildChecklistResumo(items = []) {
  const total = items.length;
  const concluidos = items.filter((item) => item.concluido).length;
  return `${concluidos}/${total}`;
}
