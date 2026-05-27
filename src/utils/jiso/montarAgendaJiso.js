const STATUS_FINALIZADO = new Set(['Realizada', 'Cancelada']);

const toDate = (isoDate) => {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toKey = (value) => (value === null || value === undefined ? '' : String(value));

export function montarAgendaJiso({ atestados = [], jisos = [], hoje = new Date() }) {
  const hojeRef = new Date(hoje);
  hojeRef.setHours(0, 0, 0, 0);

  const formaisPorAtestado = new Map();

  for (const jiso of Array.isArray(jisos) ? jisos : []) {
    const dataJiso = toDate(jiso?.data_jiso);
    if (!dataJiso || dataJiso < hojeRef) continue;

    const status = (jiso?.status || '').trim();
    if (STATUS_FINALIZADO.has(status)) continue;

    const atestadoKey = toKey(jiso?.atestado_id || jiso?.id);
    if (!atestadoKey) continue;

    formaisPorAtestado.set(atestadoKey, jiso);
  }

  const fallbacks = [];
  for (const atestado of Array.isArray(atestados) ? atestados : []) {
    if (!atestado?.necessita_jiso) continue;

    const dataAgendada = toDate(atestado?.data_jiso_agendada);
    if (!dataAgendada || dataAgendada < hojeRef) continue;

    const atestadoKey = toKey(atestado?.id);
    if (!atestadoKey || formaisPorAtestado.has(atestadoKey)) continue;

    fallbacks.push({
      id: `fallback-${atestado.id}`,
      atestado_id: atestado.id,
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: atestado.militar_matricula,
      militar_matricula_atual: atestado.militar_matricula_atual,
      militar_matricula_label: atestado.militar_matricula_label,
      tipo_afastamento: atestado.tipo_afastamento,
      dias: atestado.dias,
      data_inicio: atestado.data_inicio,
      data_jiso: atestado.data_jiso_agendada,
      status: 'Aguardando Registro',
    });
  }

  return [...formaisPorAtestado.values(), ...fallbacks]
    .sort((a, b) => toDate(a?.data_jiso) - toDate(b?.data_jiso));
}

export default montarAgendaJiso;
