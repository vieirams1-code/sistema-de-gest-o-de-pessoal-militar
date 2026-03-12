import { base44 } from '@/api/base44Client';
import { DIAS_BASE_PADRAO, obterDiasBase, obterDiasAjuste } from './periodoSaldoUtils';
import { filtrarFeriasDoPeriodo, validarAjusteDiasPeriodo } from './periodoSaldoUtils';
import { calcularStatusPeriodoAquisitivo } from './recalcularPeriodoAquisitivo';

const TIPO_AJUSTE = {
  ADICAO: 'adicao',
  DISPENSA_DESCONTO: 'dispensa_desconto',
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarQuantidade(quantidade) {
  return Math.max(0, toNumber(quantidade, 0));
}

function nowDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function gerarIdLocal() {
  try {
    return crypto.randomUUID();
  } catch {
    return `ajuste_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function carregarPeriodo(periodoId) {
  const list = await base44.entities.PeriodoAquisitivo.filter({ id: periodoId });
  return list[0] || null;
}

async function carregarFeriasDoMilitar(militarId) {
  if (!militarId) return [];
  return base44.entities.Ferias.filter({ militar_id: militarId });
}

function getNomeMilitar(periodo = {}) {
  return (
    periodo.militar_nome_guerra ||
    periodo.militar_nome ||
    periodo.nome_guerra ||
    periodo.militar_nome_completo ||
    'Militar não identificado'
  );
}

function getReferenciaPeriodo(periodo = {}) {
  return periodo.ano_referencia || periodo.referencia || periodo.periodo_aquisitivo_ref || 'Sem referência';
}

function serializarAjusteLocal(ajuste) {
  return {
    id: ajuste.id || gerarIdLocal(),
    periodo_aquisitivo_id: ajuste.periodo_aquisitivo_id,
    periodo_aquisitivo_ref: ajuste.periodo_aquisitivo_ref,
    militar_id: ajuste.militar_id || null,
    militar_nome: ajuste.militar_nome || null,
    militar_matricula: ajuste.militar_matricula || null,
    tipo: ajuste.tipo,
    quantidade: normalizarQuantidade(ajuste.quantidade),
    motivo: ajuste.motivo || null,
    observacao: ajuste.observacao || null,
    data: ajuste.data || nowDateOnly(),
    usuario: ajuste.usuario || null,
    publicacao_id: ajuste.publicacao_id || null,
    origem: ajuste.origem || 'manual',
    status: ajuste.status || 'ativo',
    invalidado_em: ajuste.invalidado_em || null,
    invalidado_por: ajuste.invalidado_por || null,
    invalidado_motivo: ajuste.invalidado_motivo || null,
    created_date: ajuste.created_date || new Date().toISOString(),
  };
}

async function listarAjustesPersistidos(periodo) {
  const locais = Array.isArray(periodo?.ajustes_admin)
    ? periodo.ajustes_admin.map(serializarAjusteLocal)
    : [];

  let remotos = [];
  try {
    remotos = await base44.entities.AjustePeriodoAquisitivo.filter({ periodo_aquisitivo_id: periodo.id }, '-created_date');
  } catch {
    remotos = [];
  }

  const map = new Map();
  [...remotos, ...locais].forEach((item) => {
    const normalizado = serializarAjusteLocal(item);
    map.set(normalizado.id, { ...(map.get(normalizado.id) || {}), ...normalizado });
  });

  return [...map.values()].sort((a, b) => new Date(b.created_date || b.data || 0) - new Date(a.created_date || a.data || 0));
}

function calcularResumoComAjustes({ periodo, feriasRelacionadas, ajustesAtivos }) {
  const dias_base = obterDiasBase(periodo) || DIAS_BASE_PADRAO;
  const dias_gozados = validarAjusteDiasPeriodo({ periodo, ferias: feriasRelacionadas, tipo: 'adicao', quantidade: 0 }).dias_gozados;
  const dias_previstos = validarAjusteDiasPeriodo({ periodo, ferias: feriasRelacionadas, tipo: 'adicao', quantidade: 0 }).dias_previstos;

  const dias_ajuste = ajustesAtivos.reduce((acc, item) => {
    const qtd = normalizarQuantidade(item.quantidade);
    return acc + (item.tipo === TIPO_AJUSTE.DISPENSA_DESCONTO ? -qtd : qtd);
  }, 0);

  const dias_total = dias_base + dias_ajuste;
  const dias_saldo = dias_total - dias_gozados - dias_previstos;

  return {
    dias_base,
    dias_ajuste,
    dias_total,
    dias_direito: dias_total,
    dias_gozados,
    dias_previstos,
    dias_saldo,
  };
}

function montarTextoPublicacao({ periodo, quantidade, motivo, observacao, data }) {
  const referencia = getReferenciaPeriodo(periodo);
  const nomeMilitar = getNomeMilitar(periodo);
  const posto = periodo.militar_posto ? `${periodo.militar_posto} ` : '';
  const matricula = periodo.militar_matricula ? `, matrícula ${periodo.militar_matricula}` : '';
  const dataFato = data || nowDateOnly();

  return [
    `O Comandante do 1º Grupamento de Bombeiros Militar torna público que foi concedida dispensa com desconto em férias ao ${posto}${nomeMilitar}${matricula}.`,
    `O desconto administrativo corresponde a ${quantidade} dia(s), vinculado ao período aquisitivo ${referencia}, com efeitos a contar de ${dataFato}.`,
    `Motivo: ${motivo}.`,
    observacao ? `Observação: ${observacao}.` : null,
  ].filter(Boolean).join(' ');
}

async function criarPublicacaoDispensaComDesconto({ periodo, quantidade, motivo, observacao, data }) {
  const dataPublicacao = data || nowDateOnly();
  const referencia = getReferenciaPeriodo(periodo);
  const texto_publicacao = montarTextoPublicacao({ periodo, quantidade, motivo, observacao, data: dataPublicacao });

  const publicacao = await base44.entities.PublicacaoExOfficio.create({
    militar_id: periodo.militar_id || '',
    militar_nome: periodo.militar_nome || periodo.militar_nome_completo || getNomeMilitar(periodo),
    militar_posto: periodo.militar_posto || '',
    militar_matricula: periodo.militar_matricula || '',
    tipo: 'Dispensa com Desconto em Férias',
    assunto: 'Dispensa com Desconto em Férias',
    data_publicacao: dataPublicacao,
    texto_base: texto_publicacao,
    texto_publicacao,
    observacoes: observacao || `Período aquisitivo ${referencia}. Motivo: ${motivo}.`,
    status: 'Aguardando Nota',
    periodo_aquisitivo_id: periodo.id,
    periodo_aquisitivo_ref: referencia,
    quantidade_desconto: quantidade,
    motivo_desconto: motivo,
    origem_ajuste: 'ferias_desconto',
  });

  return publicacao;
}

async function persistirHistoricoNoPeriodo(periodo, novoRegistro) {
  const historicoExistente = Array.isArray(periodo.ajustes_admin) ? periodo.ajustes_admin.map(serializarAjusteLocal) : [];
  const mapa = new Map(historicoExistente.map((item) => [item.id, item]));
  mapa.set(novoRegistro.id, serializarAjusteLocal(novoRegistro));
  const atualizado = [...mapa.values()].sort((a, b) => new Date(b.created_date || b.data || 0) - new Date(a.created_date || a.data || 0));
  await base44.entities.PeriodoAquisitivo.update(periodo.id, { ajustes_admin: atualizado });
  return atualizado;
}

export async function listarHistoricoAjustesPeriodo(periodoId) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) return [];
  return listarAjustesPersistidos(periodo);
}

export async function registrarAjustePeriodoAquisitivo({
  periodoId,
  tipo,
  quantidade,
  motivo,
  observacao,
  data,
  usuario,
  publicacao_id,
}) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado para ajuste.');

  const qtd = normalizarQuantidade(quantidade);
  if (!Object.values(TIPO_AJUSTE).includes(tipo)) {
    throw new Error('Tipo de ajuste inválido.');
  }

  const feriasMilitar = await carregarFeriasDoMilitar(periodo.militar_id);
  const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo, feriasMilitar);
  const validacao = validarAjusteDiasPeriodo({
    periodo,
    ferias: feriasRelacionadas,
    tipo,
    quantidade: qtd,
  });

  if (!validacao.ok) {
    throw new Error(validacao.mensagem || 'Não foi possível aplicar o ajuste neste período.');
  }

  const trilhaPayload = serializarAjusteLocal({
    id: gerarIdLocal(),
    periodo_aquisitivo_id: periodoId,
    periodo_aquisitivo_ref: getReferenciaPeriodo(periodo),
    militar_id: periodo.militar_id || null,
    militar_nome: getNomeMilitar(periodo),
    militar_matricula: periodo.militar_matricula || null,
    tipo,
    quantidade: qtd,
    motivo: motivo || null,
    observacao: observacao || null,
    data: data || nowDateOnly(),
    usuario: usuario || null,
    publicacao_id: publicacao_id || null,
    origem: publicacao_id ? 'publicacao' : 'manual',
    status: 'ativo',
  });

  const historicoAtualizado = await persistirHistoricoNoPeriodo(periodo, trilhaPayload);

  try {
    await base44.entities.AjustePeriodoAquisitivo.create(trilhaPayload);
  } catch {
    // fallback já persistido no próprio período
  }

  const ajustesAtivos = historicoAtualizado.filter((item) => item.status !== 'invalidado');
  const payloadAtualizacao = calcularResumoComAjustes({ periodo, feriasRelacionadas, ajustesAtivos });
  payloadAtualizacao.status = calcularStatusPeriodoAquisitivo({
    periodo,
    dias_previstos: payloadAtualizacao.dias_previstos,
    dias_gozados: payloadAtualizacao.dias_gozados,
    dias_saldo: payloadAtualizacao.dias_saldo,
  });

  await base44.entities.PeriodoAquisitivo.update(periodoId, payloadAtualizacao);

  if (publicacao_id) {
    try {
      await base44.entities.PublicacaoExOfficio.update(publicacao_id, {
        ajuste_periodo_id: trilhaPayload.id,
        observacoes: [
          `Ajuste administrativo vinculado: ${trilhaPayload.id}.`,
          `Período aquisitivo: ${trilhaPayload.periodo_aquisitivo_ref}.`,
          `Quantidade: ${trilhaPayload.quantidade} dia(s).`,
          trilhaPayload.motivo ? `Motivo: ${trilhaPayload.motivo}.` : null,
          trilhaPayload.observacao ? `Observação: ${trilhaPayload.observacao}.` : null,
        ].filter(Boolean).join(' '),
      });
    } catch {
      // ignore
    }
  }

  return { persistedIn: 'PeriodoAquisitivo.ajustes_admin', trilhaPayload };
}

export async function invalidarAjustePeriodoAquisitivo({ periodoId, ajusteId, motivo, usuario }) {
  const periodo = await carregarPeriodo(periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado.');

  const historico = await listarAjustesPersistidos(periodo);
  const alvo = historico.find((item) => item.id === ajusteId);
  if (!alvo) throw new Error('Ajuste administrativo não encontrado.');
  if (alvo.status === 'invalidado') return alvo;

  const motivoInval = motivo || 'Registro administrativo original excluído/inativado. Verificar a validade desta nota.';
  const atualizados = historico.map((item) => item.id !== ajusteId ? item : ({
    ...item,
    status: 'invalidado',
    invalidado_em: new Date().toISOString(),
    invalidado_por: usuario || null,
    invalidado_motivo: motivoInval,
  }));

  await base44.entities.PeriodoAquisitivo.update(periodoId, { ajustes_admin: atualizados });

  try {
    await base44.entities.AjustePeriodoAquisitivo.update(ajusteId, {
      status: 'invalidado',
      invalidado_em: new Date().toISOString(),
      invalidado_por: usuario || null,
      invalidado_motivo: motivoInval,
    });
  } catch {
    // ignore
  }

  const feriasMilitar = await carregarFeriasDoMilitar(periodo.militar_id);
  const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo, feriasMilitar);
  const ajustesAtivos = atualizados.filter((item) => item.status !== 'invalidado');
  const payloadAtualizacao = calcularResumoComAjustes({ periodo, feriasRelacionadas, ajustesAtivos });
  payloadAtualizacao.status = calcularStatusPeriodoAquisitivo({
    periodo,
    dias_previstos: payloadAtualizacao.dias_previstos,
    dias_gozados: payloadAtualizacao.dias_gozados,
    dias_saldo: payloadAtualizacao.dias_saldo,
  });
  await base44.entities.PeriodoAquisitivo.update(periodoId, payloadAtualizacao);

  if (alvo.publicacao_id) {
    try {
      const registros = await base44.entities.PublicacaoExOfficio.filter({ id: alvo.publicacao_id });
      const pub = registros[0];
      if (pub) {
        const textoAtual = pub.texto_publicacao || '';
        const obsAtual = pub.observacoes || '';
        const aviso = motivoInval;
        await base44.entities.PublicacaoExOfficio.update(alvo.publicacao_id, {
          status: 'Inválida',
          observacoes: [obsAtual, aviso].filter(Boolean).join(' '),
          texto_publicacao: textoAtual,
        });
      }
    } catch {
      // ignore
    }
  }

  return { ...alvo, status: 'invalidado', invalidado_motivo: motivoInval };
}

export async function reverterAjustesPorPublicacao(publicacaoId) {
  if (!publicacaoId) return null;

  let ajuste = null;
  try {
    const encontrados = await base44.entities.AjustePeriodoAquisitivo.filter({ publicacao_id: publicacaoId });
    ajuste = encontrados[0] || null;
  } catch {
    ajuste = null;
  }

  if (!ajuste) {
    const periodos = await base44.entities.PeriodoAquisitivo.list();
    const periodoComAjuste = periodos.find((periodo) => Array.isArray(periodo.ajustes_admin) && periodo.ajustes_admin.some((item) => item.publicacao_id === publicacaoId));
    const ajusteLocal = periodoComAjuste?.ajustes_admin?.find((item) => item.publicacao_id === publicacaoId);
    if (!periodoComAjuste || !ajusteLocal) return null;
    ajuste = { ...ajusteLocal, periodo_aquisitivo_id: periodoComAjuste.id };
  }

  return invalidarAjustePeriodoAquisitivo({
    periodoId: ajuste.periodo_aquisitivo_id,
    ajusteId: ajuste.id,
    motivo: 'Publicação originária excluída/inativada. Desconto revertido automaticamente.',
  });
}

export async function aplicarAjustePositivo(payload) {
  return registrarAjustePeriodoAquisitivo({ ...payload, tipo: TIPO_AJUSTE.ADICAO });
}

export async function prepararDispensaComDesconto(payload) {
  const periodo = await carregarPeriodo(payload?.periodoId);
  if (!periodo) throw new Error('Período aquisitivo não encontrado para dispensa com desconto.');

  const publicacao = await criarPublicacaoDispensaComDesconto({
    periodo,
    quantidade: payload.quantidade,
    motivo: payload.motivo,
    observacao: payload.observacao,
    data: payload.data,
  });

  return registrarAjustePeriodoAquisitivo({
    ...payload,
    tipo: TIPO_AJUSTE.DISPENSA_DESCONTO,
    publicacao_id: publicacao?.id || null,
  });
}
