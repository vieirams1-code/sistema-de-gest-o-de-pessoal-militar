const texto = (v: unknown) => String(v ?? '').trim();
const chave = (v: unknown) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[°º]/g, 'o').replace(/[-–—.]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const postos = ['Soldado','Cabo','3º Sargento','2º Sargento','1º Sargento','Subtenente','Aspirante a Oficial','2º Tenente','1º Tenente','Capitão','Major','Tenente-Coronel','Coronel'];
const indice = (v: unknown) => postos.findIndex(p => chave(p) === chave(v === 'Aspirante' ? 'Aspirante a Oficial' : v));
const dia = (v: unknown) => texto(v).split('T')[0];
const hojeMS = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Campo_Grande', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;

export interface UpdateMilitarResult {
  militar_id: string;
  matricula: string;
  success: boolean;
  updates: Array<{campo:string; anterior:string; esperado:string; apos_releitura:string; confirmado:boolean}>;
  erro_api?: string;
  rollback_completo?: boolean;
}

export async function atualizarCadastroMilitar(
  base44: any, militarId: string,
  dados: {posto_graduacao:string; quadro:string},
  contexto: {executado_por:string; origem:string; historico_id?:string}
): Promise<UpdateMilitarResult> {
  const E = base44.asServiceRole.entities;
  const antes = await E.Militar.get(militarId);
  if (!antes) throw new Error('militar_nao_encontrado');
  const h = contexto.historico_id ? await E.HistoricoPromocaoMilitarV2.get(contexto.historico_id) : null;
  if (!h || texto(h.militar_id) !== militarId || texto(h.status_registro) !== 'ativo') throw new Error('historico_oficial_invalido');
  if (chave(h.posto_graduacao_novo) !== chave(dados.posto_graduacao) || chave(h.quadro_novo) !== chave(dados.quadro) || !texto(dados.quadro)) throw new Error('destino_divergente_historico');
  const data = dia(h.data_promocao);
  if (!dataValida(data) || data > hojeMS()) throw new Error('promocao_sem_vigencia');
  if (dia(antes.data_promocao_atual) > data) throw new Error('cadastro_possui_promocao_posterior');
  const novo = indice(dados.posto_graduacao), atual = indice(antes.posto_graduacao);
  if (novo < 0 || atual < 0 || novo <= atual) throw new Error('atualizacao_sem_avanco_hierarquico');
  if (!texto(h.promocao_id)) throw new Error('historico_sem_promocao_oficial');
  const [pai, itens, cadeia] = await Promise.all([
    E.Promocao.get(h.promocao_id),
    E.PromocaoMilitar.filter({promocao_id:h.promocao_id}, undefined, 5000),
    E.HistoricoPromocaoMilitarV2.filter({militar_id:militarId, status_registro:'ativo'}, undefined, 5000),
  ]);
  const oficial = ['publicada','publicada_parcial','publicado','consolidada','consolidado','ativa','ativo','historica','homologada'];
  if (!pai || (!oficial.includes(texto(pai.status)) && contexto.origem !== 'publicacao_oficial_promocao')) throw new Error('promocao_nao_publicada');
  if (chave(pai.posto_graduacao) !== chave(dados.posto_graduacao) || chave(pai.quadro) !== chave(dados.quadro) || dia(pai.data_promocao) !== data) throw new Error('historico_divergente_promocao');
  if (!itens.some((i:any) => texto(i.militar_id) === militarId && texto(i.historico_promocao_v2_id) === texto(h.id) && i.publicado === true && texto(i.status) === 'publicado')) throw new Error('vinculo_publicado_nao_confirmado');
  if (cadeia.some((r:any) => texto(r.id) !== texto(h.id) && dia(r.data_promocao) <= hojeMS() && (dia(r.data_promocao) > data || (dia(r.data_promocao) === data && (chave(r.posto_graduacao_novo) !== chave(h.posto_graduacao_novo) || chave(r.quadro_novo) !== chave(h.quadro_novo)))))) throw new Error('historico_posterior_ou_conflitante');

  const payload: Record<string,string> = {};
  const original: Record<string,string> = {};
  for (const campo of ['posto_graduacao','posto_graduação','posto_graduacao_atual','posto_grad','posto','graduacao','quadro','quadro_atual','militar_quadro']) {
    if (['posto_graduacao','quadro'].includes(campo) || Object.hasOwn(antes,campo)) {
      payload[campo] = campo.startsWith('quadro') || campo === 'militar_quadro' ? dados.quadro : dados.posto_graduacao;
      original[campo] = antes[campo] ?? '';
    }
  }
  // Persistir o estado anterior antes de qualquer alteração cadastral.
  const log = await E.AssistenteLog.create({
    tipo:'sincronizacao_promocao', acao:'atualizacao_militar_iniciada',
    descricao:'Aplicação de promoção com vínculo confirmado e vigência verificada.',
    metadata:{militar_id:militarId,historico_id:h.id,executado_por:contexto.executado_por,origem:contexto.origem,dados_anteriores:original,dados_novos:payload}
  });
  const vinculo = itens.find((i:any) => texto(i.militar_id) === militarId && texto(i.historico_promocao_v2_id) === texto(h.id));
  await E.PromocaoMilitar.update(vinculo.id,{cadastro_anterior_promocao:original});
  const relido = await E.Militar.get(militarId);
  if (Object.keys(original).some(k => texto(relido[k]) !== texto(original[k]))) throw new Error('cadastro_alterado_durante_publicacao');
  let erro = '';
  try { await E.Militar.update(militarId,payload); } catch (e:any) { erro = e.message || String(e); }
  let depois: any;
  try { depois = await E.Militar.get(militarId); } catch (e:any) { erro = erro || e.message; }
  const updates = Object.keys(payload).map(campo => ({campo,anterior:original[campo],esperado:payload[campo],apos_releitura:texto(depois?.[campo]),confirmado:!!depois && texto(depois[campo]) === payload[campo]}));
  // Uma resposta perdida não deve transformar gravação confirmada em falha.
  const success = updates.every(u => u.confirmado);
  let rollback = false;
  if (!success) {
    try {
      const atualRollback = await E.Militar.get(militarId);
      if (Object.keys(payload).some(k => texto(atualRollback[k]) !== payload[k] && texto(atualRollback[k]) !== texto(original[k]))) throw new Error('rollback_bloqueado_alteracao_concorrente');
      await E.Militar.update(militarId, original);
      const restaurado = await E.Militar.get(militarId);
      rollback = Object.keys(original).every(k => texto(restaurado[k]) === texto(original[k]));
    } catch (e:any) { erro += '; ' + (e.message || String(e)); }
  }
  // Falha no log final não invalida uma gravação já confirmada.
  try { await E.AssistenteLog.update(log.id,{acao:success ? 'atualizar_militar_confirmado' : 'atualizacao_militar_falhou',metadata:{militar_id:militarId,historico_id:h.id,dados_anteriores:original,dados_novos:payload,updates,rollback_completo:rollback,erro}}); } catch (e) { console.error('Falha ao concluir log de promoção', log.id); }
  return {militar_id:militarId,matricula:texto(antes.matricula),success,updates,erro_api:success ? undefined : erro || 'releitura_divergente',rollback_completo:rollback};
}
