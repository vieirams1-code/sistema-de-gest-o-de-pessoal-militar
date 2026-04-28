import { base44 } from '@/api/base44Client';

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeText = (value = '') => String(value || '').toLowerCase().trim();

export const diffInDays = (dateString) => {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / DAY_MS);
};

export const computeProcedureStatus = (procedimento = {}) => {
  if (['Concluído', 'Encerrado', 'Arquivado'].includes(procedimento.status)) return procedimento.status;
  const dias = diffInDays(procedimento.prazo_final);
  if (dias !== null && dias < 0) return 'Vencido';
  return procedimento.status || 'Em andamento';
};

export async function carregarProcedimentosProcessos() {
  const [procedimentos, envolvidos, pendencias, viaturas, historicoPrazos] = await Promise.all([
    base44.entities.ProcedimentoProcesso?.list?.('-created_date') || base44.entities.ProcedimentoProcesso.filter({}),
    base44.entities.ProcedimentoEnvolvido?.filter({}) || [],
    base44.entities.ProcedimentoPendencia?.filter({}) || [],
    base44.entities.ProcedimentoViatura?.filter({}) || [],
    base44.entities.ProcedimentoPrazoHistorico?.filter({}) || [],
  ]);

  const envolvidosPorProcedimento = envolvidos.reduce((acc, item) => {
    if (!item.procedimento_id) return acc;
    acc[item.procedimento_id] = acc[item.procedimento_id] || [];
    acc[item.procedimento_id].push(item);
    return acc;
  }, {});

  const pendenciasPorProcedimento = pendencias.reduce((acc, item) => {
    if (!item.procedimento_id) return acc;
    acc[item.procedimento_id] = acc[item.procedimento_id] || [];
    acc[item.procedimento_id].push(item);
    return acc;
  }, {});

  const viaturasPorProcedimento = viaturas.reduce((acc, item) => {
    if (!item.procedimento_id) return acc;
    acc[item.procedimento_id] = acc[item.procedimento_id] || [];
    acc[item.procedimento_id].push(item);
    return acc;
  }, {});

  const historicoPorProcedimento = historicoPrazos.reduce((acc, item) => {
    if (!item.procedimento_id) return acc;
    acc[item.procedimento_id] = acc[item.procedimento_id] || [];
    acc[item.procedimento_id].push(item);
    return acc;
  }, {});

  return (procedimentos || []).map((procedimento) => {
    const diasRestantes = diffInDays(procedimento.prazo_final);
    const statusCalculado = computeProcedureStatus(procedimento);
    return {
      ...procedimento,
      dias_restantes: diasRestantes,
      status_calculado: statusCalculado,
      envolvidos: envolvidosPorProcedimento[procedimento.id] || [],
      pendencias: pendenciasPorProcedimento[procedimento.id] || [],
      viaturas: viaturasPorProcedimento[procedimento.id] || [],
      prazos: (historicoPorProcedimento[procedimento.id] || []).sort((a, b) => (a.created_date < b.created_date ? 1 : -1)),
    };
  });
}

function matchesPrazoFilter(procedimento, prazoFilter) {
  const dias = procedimento.dias_restantes;
  if (!prazoFilter || prazoFilter === 'todos') return true;
  if (dias === null) return false;
  if (prazoFilter === 'vencidos') return dias < 0;
  if (prazoFilter === 'vencem7') return dias >= 0 && dias <= 7;
  if (prazoFilter === 'vencem30') return dias >= 0 && dias <= 30;
  return true;
}

export function filtrarProcedimentos(procedimentos, filters) {
  const termo = normalizeText(filters.textoLivre);

  return procedimentos.filter((item) => {
    if (filters.tipo && filters.tipo !== 'todos' && item.tipo_procedimento !== filters.tipo) return false;
    if (filters.status && filters.status !== 'todos' && item.status_calculado !== filters.status) return false;
    if (filters.responsavel && normalizeText(item.responsavel_nome) !== normalizeText(filters.responsavel)) return false;
    if (filters.unidade && normalizeText(item.unidade) !== normalizeText(filters.unidade)) return false;
    if (!matchesPrazoFilter(item, filters.prazo)) return false;

    if (!termo) return true;
    const blob = [
      item.tipo_procedimento,
      item.numero_procedimento,
      item.numero_portaria,
      item.objeto,
      item.responsavel_nome,
      item.unidade,
      item.autoridade_instauradora,
      ...item.envolvidos.map((env) => env.nome),
    ].map(normalizeText).join(' ');

    return blob.includes(termo);
  });
}

export function calcularDashboard(procedimentos) {
  const nowMonth = new Date().toISOString().slice(0, 7);
  const totalAndamento = procedimentos.filter((p) => ['Em andamento', 'Suspenso', 'Vencido'].includes(p.status_calculado)).length;
  const vencidos = procedimentos.filter((p) => p.dias_restantes !== null && p.dias_restantes < 0 && !['Concluído', 'Encerrado', 'Arquivado'].includes(p.status)).length;
  const vencem7 = procedimentos.filter((p) => p.dias_restantes !== null && p.dias_restantes >= 0 && p.dias_restantes <= 7).length;
  const concluidosMes = procedimentos.filter((p) => (p.status === 'Concluído' || p.status === 'Encerrado') && String(p.updated_date || p.created_date || '').slice(0, 7) === nowMonth).length;

  const porResponsavel = procedimentos.reduce((acc, item) => {
    const key = item.responsavel_nome || 'Não definido';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const porTipo = procedimentos.reduce((acc, item) => {
    const key = item.tipo_procedimento || 'Não definido';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return { totalAndamento, vencidos, vencem7, concluidosMes, porResponsavel, porTipo };
}
