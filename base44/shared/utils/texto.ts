export function texto(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizar(value: unknown): string {
  return texto(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}