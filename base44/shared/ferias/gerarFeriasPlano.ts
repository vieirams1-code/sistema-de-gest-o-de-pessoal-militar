import { listarTodos, filtrarEscopo } from './listarEscalaPlano.ts';

const text = value => String(value || '').trim();
const approved = new Set(['Escala_Salva', 'Opcao_1_Aprovada', 'Opcao_2_Aprovada', 'Opcao_3_Aprovada', 'Ajustado_Pelo_Gestor', 'Homologado_Unidade']);
const impact = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Gozada', 'Interrompida']);
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const overlap = (a, b) => a.data_inicio <= b.data_fim && b.data_inicio <= a.data_fim;
async function fingerprint(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function prepare(op, pa, ferias, ajustes, ano, calcularResumoPeriodoPlano, planoId) {
  const item = { opcao_id: op.id, militar_id: op.militar_id, militar_nome: op.militar_nome, militar_posto: op.militar_posto, militar_matricula: op.militar_matricula, periodo_ref: pa?.ano_referencia || '', parcelas: [], motivo: '', versao: op.updated_date || '' };
  const block = motivo => ({ ...item, motivo });
  if (!pa || pa.militar_id !== op.militar_id || pa.inativo || pa.status === 'Inativo') return block('Período aquisitivo inexistente, inativo ou de outro militar.');
  let saved;
  try { saved = JSON.parse(op.decisao_camada_1_detalhes || '[]'); } catch { return block('Definição inválida; revise a escala.'); }
  if (!Array.isArray(saved) || !saved.length) return block('Não há parcelas aprovadas.');
  // Na efetivação, considera o saldo operacional completo, inclusive férias de outros planos.
  const summary = calcularResumoPeriodoPlano(pa, ferias, ajustes, ano);
  const parcelas = saved.map((p, i) => {
    const mes = text(p?.mes || p?.data_inicio?.slice(5, 7));
    const rule = summary.meses_elegiveis.find(m => m.mes === mes);
    const dias = Number(p?.dias);
    const inicio = rule?.permitido ? rule.data_inicio : '';
    return { etapa: i + 1, mes, dias, data_inicio: inicio, data_fim: inicio && Number.isInteger(dias) && dias > 0 ? addDays(inicio, dias - 1) : '', data_retorno: inicio && Number.isInteger(dias) && dias > 0 ? addDays(inicio, dias) : '' };
  }).sort((a,b) => a.data_inicio.localeCompare(b.data_inicio)).map((p,i) => ({ ...p, etapa:i+1 }));
  if (parcelas.some(p => !p.data_inicio || !p.data_fim || !Number.isInteger(p.dias) || p.dias <= 0)) return block('Datas indisponíveis ou quantidade de dias inválida.');
  if (new Set(parcelas.map(p => p.mes)).size !== parcelas.length) return block('Há meses repetidos entre as parcelas.');
  const total = parcelas.reduce((s,p) => s + p.dias, 0);
  if (total !== Number(op.dias_direito) || total > summary.dias_sem_previsao) return block(`A definição soma ${total} dia(s); saldo operacional disponível: ${summary.dias_sem_previsao} dia(s).`);
  const atuais = ferias.filter(f => impact.has(f.status));
  if (parcelas.some((p,i) => atuais.some(f => overlap(p,f)) || parcelas.slice(i+1).some(f => overlap(p,f)))) return block('Sobreposição com férias existentes ou entre parcelas; nenhuma duplicação será criada.');
  return { ...item, parcelas, saldo_disponivel: summary.dias_sem_previsao, periodo_id:pa.id, plano_id:planoId || text(op.plano_ferias_institucional_id), campanha_id:text(op.campanha_id), summary };
}

export async function gerarFeriasPlano({ base44, user, payload, acao, calcularResumoPeriodoPlano, consolidarOpcoesPlano, registrarAuditoriaFerias, corsHeaders }) {
  const reply = (body, status = 200) => Response.json(body, { status, headers:corsHeaders });
  const entities = base44.asServiceRole.entities;
  const preview = payload.somente_previa === true;
  const v2 = payload.origem_painel_v2 === true;
  if (v2 && payload.modo_admin !== true) return reply({ error:'Ative o Modo Admin para gerar férias.' }, 403);
  if (v2 && !preview && !text(payload.previa_assinatura)) return reply({ error:'Confira a prévia antes de confirmar a geração.' }, 400);
  const planoId = text(payload.plano_id);
  let plano = null, campanha = null, all;
  if (acao === 'PLANO_INSTITUCIONAL_GERAR_FERIAS') {
    if (!planoId) return reply({ error:'Informe o Plano de Férias.' }, 400);
    plano = await entities.PlanoFeriasInstitucional.get(planoId);
    if (!plano) return reply({ error:'Plano não encontrado.' }, 404);
    if (plano.status !== 'ATIVO') return reply({ error:'Somente planos ativos podem gerar férias.' }, 409);
    const campaigns = await listarTodos(entities.CampanhaPortal, { plano_ferias_institucional_id:planoId, tipo:'PLANO_FERIAS' });
    all = await listarTodos(entities.OpcaoFeriasMilitar, { $or:[{ plano_ferias_institucional_id:planoId }, { campanha_id:{ $in:campaigns.map(c => c.id) } }] });
    all = consolidarOpcoesPlano(all);
  } else {
    if (!payload.campanha_id) return reply({ error:'Informe a campanha.' }, 400);
    campanha = await entities.CampanhaPortal.get(payload.campanha_id);
    if (!campanha || campanha.tipo !== 'PLANO_FERIAS') return reply({ error:'Campanha de férias não encontrada.' }, 404);
    if (campanha.plano_ferias_institucional_id) return reply({ error:'Gere as férias pelo plano consolidado, não pela campanha isolada.' }, 409);
    all = await listarTodos(entities.OpcaoFeriasMilitar, { campanha_id:campanha.id });
  }
  const militares = await listarTodos(entities.Militar, { id:{ $in:[...new Set(all.map(o => o.militar_id))] } });
  const scoped = await filtrarEscopo(base44, user, militares);
  const scopedIds = new Set(scoped.map(m => m.id));
  all = all.filter(op => scopedIds.has(op.militar_id));
  const jaGeradas = all.filter(op => op.gerado_ferias_efetivas).length;
  const candidates = all.filter(op => !op.gerado_ferias_efetivas && approved.has(op.status_camada_1) && op.decisao_camada_1_opcao !== 'NAO_CONTEMPLADO' && op.status_camada_2 !== 'Rejeitado_Para_Revisao');
  const ano = Number(plano?.ano_referencia || campanha?.ano_referencia);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2200) return reply({ error:'Ano de referência inválido.' }, 400);
  const load = async op => {
    const [pa, ferias, ajustes] = await Promise.all([
      entities.PeriodoAquisitivo.get(op.periodo_aquisitivo_id),
      listarTodos(entities.Ferias, { militar_id:op.militar_id }),
      listarTodos(entities.AjusteSaldoFerias, { militar_id:op.militar_id, status:'ativo' }),
    ]);
    return prepare(op, pa, ferias, ajustes, ano, calcularResumoPeriodoPlano, planoId);
  };
  const items = [];
  for (const op of candidates) {
    const militar = scoped.find(m => m.id === op.militar_id);
    const item = await load(op);
    if (['inativo','falecido'].includes(text(militar?.status_cadastro || militar?.status).toLowerCase())) item.motivo = 'Militar inativo.';
    items.push(item);
  }
  const serialize = item => { const { summary, ...safe } = item; return safe; };
  const ready = items.filter(i => !i.motivo);
  const blocked = items.filter(i => i.motivo);
  const signature = await fingerprint({ plano_id:planoId, ano, user_id:user.id, itens:items.map(serialize).sort((a,b) => a.opcao_id.localeCompare(b.opcao_id)) });
  if (preview) return reply({ ok:true, somente_previa:true, assinatura:signature, itens:ready.map(serialize), bloqueados:blocked.map(serialize), total_escalas:ready.length, total_parcelas:ready.reduce((s,i) => s+i.parcelas.length,0), ja_geradas:jaGeradas, pendentes:all.length-jaGeradas-candidates.length });
  if (v2 && signature !== payload.previa_assinatura) return reply({ error:'Os dados mudaram desde a conferência. Atualize a prévia antes de gerar.' }, 409);
  const geradas = [], falhas = blocked.map(serialize);
  for (const prepared of ready) {
    const op = await entities.OpcaoFeriasMilitar.get(prepared.opcao_id);
    if (op.gerado_ferias_efetivas) continue;
    if (!approved.has(op.status_camada_1) || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO' || op.status_camada_2 === 'Rejeitado_Para_Revisao') { falhas.push({ ...serialize(prepared), motivo:'A aprovação foi alterada; revise a escala.' }); continue; }
    const item = await load(op);
    if (item.motivo || JSON.stringify(item.parcelas) !== JSON.stringify(prepared.parcelas)) { falhas.push({ ...serialize(item), motivo:item.motivo || 'A definição mudou; atualize a prévia.' }); continue; }
    const ids = [];
    try {
      for (const p of item.parcelas) {
        const created = await entities.Ferias.create({ militar_id:op.militar_id, militar_nome:op.militar_nome, militar_posto:op.militar_posto, militar_matricula:op.militar_matricula, periodo_aquisitivo_id:item.periodo_id, periodo_aquisitivo_ref:item.periodo_ref, plano_ferias_id:item.plano_id, campanha_id:item.campanha_id, tipo:'Férias Regulares', status:'Prevista', data_inicio:p.data_inicio, data_fim:p.data_fim, data_retorno:p.data_retorno, dias:p.dias, dias_base:p.dias, fracionamento:item.parcelas.length > 1 ? `${p.etapa}ª Fração` : 'Integral' });
        ids.push(created.id);
      }
      await entities.PeriodoAquisitivo.update(item.periodo_id, { dias_previstos:item.summary.dias_previstos_calculados + item.parcelas.reduce((s,p) => s+p.dias,0), dias_gozados:item.summary.dias_gozados_calculados, status:item.summary.dias_gozados_calculados > 0 ? 'Parcialmente Gozado' : 'Previsto' });
      await entities.OpcaoFeriasMilitar.update(op.id, { gerado_ferias_efetivas:true, data_geracao_ferias:new Date().toISOString(), ferias_ids_geradas:ids });
      geradas.push({ opcao_id:op.id, ferias_ids:ids });
      await registrarAuditoriaFerias(base44,user,'FERIAS_GERADAS_PLANO',{ ...op, plano_id:item.plano_id, opcao_id:op.id },{ ferias_ids:ids, parcelas:item.parcelas });
    } catch (error) {
      // Não apaga férias já criadas: informa o resultado parcial e a próxima prévia bloqueia sobreposição.
      falhas.push({ ...serialize(item), motivo:`Falha na gravação; ${ids.length} parcela(s) criada(s). Confira o módulo de férias antes de repetir.`, ferias_ids:ids });
      console.error('Falha na geração de férias', op.id, error.message);
      break;
    }
  }
  if (plano && geradas.length) {
    await entities.PlanoFeriasInstitucional.updateMany({ id:plano.id }, { $set:{ data_ultima_geracao:new Date().toISOString() }, $inc:{ total_gerados_acumulado:geradas.length, quantidade_geracoes:1 } });
  } else if (campanha && geradas.length && !falhas.length) await entities.CampanhaPortal.update(campanha.id,{ status:'Encerrada' });
  return reply({ ok:true, total_geradas:geradas.length, geradas, bloqueados:falhas, message:`${geradas.length} escala(s) gerada(s) como Prevista.${falhas.length ? ` ${falhas.length} escala(s) exige(m) revisão.` : ''}` });
}