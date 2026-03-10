function getPrimeiroValor(item, campos = []) {
  for (const campo of campos) {
    const valor = item?.[campo];
    if (valor !== undefined && valor !== null && `${valor}`.trim() !== '') return valor;
  }
  return '';
}

function normalizarBoolean(valor) {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  if (typeof valor === 'string') {
    const v = valor.trim().toLowerCase();
    return ['true', '1', 'sim', 'yes'].includes(v);
  }
  return false;
}

export function toDateKey(valor) {
  if (!valor) return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = `${valor}`.trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const data = new Date(str);
  if (Number.isNaN(data.getTime())) return null;

  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatarDataBR(valor) {
  const key = toDateKey(valor);
  if (!key) return 'Sem data';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function normalizarStatusTexto(status) {
  return (status || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isConcluidaAcao(acao) {
  if (normalizarBoolean(acao?.concluida)) return true;

  const candidatos = [acao?.status, acao?.situacao, acao?.estado]
    .map(normalizarStatusTexto)
    .filter(Boolean);

  return candidatos.some((valor) => ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado'].includes(valor));
}

export function statusCanonicoAcao(acao) {
  if (isConcluidaAcao(acao)) return 'Concluída';

  const candidatos = [acao?.status, acao?.situacao, acao?.estado]
    .map((valor) => (valor || '').toString().trim())
    .filter(Boolean);

  return candidatos[0] || 'Pendente';
}

export function normalizarAcao(acao) {
  const status = statusCanonicoAcao(acao);

  return {
    ...acao,
    titulo: getPrimeiroValor(acao, ['titulo', 'nome', 'title']) || 'Ação sem título',
    data_prevista: toDateKey(getPrimeiroValor(acao, ['data_prevista', 'data', 'prazo', 'data_acao']) || null),
    status,
    concluida: status === 'Concluída',
  };
}

export function montarPayloadAcao(payload) {
  const titulo = payload.titulo?.trim() || '';
  const dataPrevista = toDateKey(payload.data_prevista) || null;
  const status = payload.status || 'Pendente';
  const concluida = statusCanonicoAcao({ ...payload, status }) === 'Concluída';

  return {
    ...payload,
    ...(titulo ? { titulo, nome: titulo, title: titulo } : {}),
    data_prevista: dataPrevista,
    data: dataPrevista,
    prazo: dataPrevista,
    data_acao: dataPrevista,
    status,
    situacao: status,
    estado: status,
    concluida,
  };
}
