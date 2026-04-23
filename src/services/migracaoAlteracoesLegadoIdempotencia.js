function limparTexto(valor) {
  return String(valor ?? '').trim();
}

function compactarEspacos(valor) {
  return limparTexto(valor).replace(/\s+/g, ' ');
}

export function normalizarTextoDeterministico(valor) {
  return compactarEspacos(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDataDeterministica(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ano = value.getUTCFullYear();
    const mes = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(value.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const txt = limparTexto(value);
  if (!txt) return null;
  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function somenteNumeros(valor) {
  return limparTexto(valor).replace(/\D/g, '');
}

function normalizarTrecho(valor) {
  return normalizarTextoDeterministico(valor).replace(/\bLEGADO\b/g, '').replace(/\s+/g, ' ').trim();
}

async function sha256Hex(valor) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(valor ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function gerarChaveOrigemLinhaDeterministica(transformado = {}) {
  const base = [
    somenteNumeros(transformado.matricula_legado),
    normalizarTextoDeterministico(transformado.nome_completo_legado || transformado.nome_guerra_legado),
    normalizarTextoDeterministico(transformado.materia_legado),
    normalizarTextoDeterministico(transformado.numero_bg || transformado.nota_id_legado),
    parseDataDeterministica(transformado.data_bg || transformado.data_publicacao || ''),
    normalizarTrecho(transformado.conteudo_trecho_legado || transformado.materia_legado),
  ].join('|');
  return sha256Hex(base);
}

export async function gerarHashLotePorTabelaDeterministico(tabela = []) {
  const linhas = tabela
    .map((row) => row.map((item) => {
      if (item instanceof Date) return parseDataDeterministica(item) || '';
      if (typeof item === 'number') return String(item);
      return normalizarTextoDeterministico(item);
    }))
    .filter((row) => row.some(Boolean));
  return sha256Hex(JSON.stringify(linhas));
}

export function resolverEstadoReutilizado(estadoAtual, estadoAnterior) {
  if (!estadoAnterior?.transformado) return estadoAtual;
  const anterior = estadoAnterior.transformado;
  return {
    ...estadoAtual,
    tipo_publicacao_confirmado: anterior.tipo_publicacao_confirmado || estadoAtual.tipo_publicacao_confirmado,
    destino_final: anterior.destino_final || estadoAtual.destino_final,
    motivo_destino: anterior.motivo_destino || estadoAtual.motivo_destino,
  };
}
