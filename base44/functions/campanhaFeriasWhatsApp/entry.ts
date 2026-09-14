import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  isEvolutionWhatsAppConfigured,
  normalizeWhatsAppNumber,
  sendEvolutionWhatsAppText,
} from '../../shared/messaging/evolutionWhatsAppProvider.ts';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

const texto = (value: unknown) => String(value ?? '').trim();
const normalizar = (value: unknown) => texto(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const MODELO_MENSAGEM = `Olá, {posto_graduacao} {nome_guerra}.

Está aberta a campanha de férias *{nome_campanha}*.

Você deverá acessar o Portal do Militar até *{data_limite}* para realizar seu recadastramento e cadastrar suas opções de férias.

Acesse o Portal do Militar:
{link_portal}

Prazo para preenchimento: *{data_limite}*.

Esta é uma mensagem automática do SGP Militar.`;

function formatarDataBR(value: unknown): string {
  const iso = texto(value).slice(0, 10);
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function validarLinkPortal(value: unknown): string {
  const raw = texto(value);
  if (!raw || raw.length > 500) throw new Error('Link do Portal do Militar inválido.');
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString();
  } catch {
    throw new Error('Link do Portal do Militar inválido.');
  }
}

function renderizarMensagem(militar: any, campanha: any, linkPortal: string): string {
  const posto = texto(militar?.posto_graduacao);
  const nomeGuerra = texto(militar?.nome_guerra) || texto(militar?.nome_completo) || 'Militar';
  const saudacao = [posto, nomeGuerra].filter(Boolean).join(' ');
  return MODELO_MENSAGEM
    .replace('{posto_graduacao} {nome_guerra}', saudacao)
    .replaceAll('{nome_campanha}', texto(campanha?.titulo) || 'Campanha de Férias')
    .replaceAll('{data_limite}', formatarDataBR(campanha?.data_fim_militar))
    .replaceAll('{link_portal}', linkPortal);
}

async function usuarioPodeEnviar(base44: any, user: any): Promise<boolean> {
  if (!user?.email) return false;
  if (normalizar(user.role) === 'admin') return true;
  try {
    const resposta = await base44.functions.invoke('getUserPermissions', {});
    const authz = resposta?.data ?? resposta ?? {};
    return authz?.actions?.admin_campanhas_ferias === true;
  } catch {
    return false;
  }
}

function vinculoGrupoValidoHoje(vinculo: any): boolean {
  if (vinculo?.ativo === false) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = texto(vinculo?.data_inicio).slice(0, 10);
  const fim = texto(vinculo?.data_fim).slice(0, 10);
  if (inicio && inicio > hoje) return false;
  if (fim && fim < hoje) return false;
  return true;
}

async function carregarMembrosPorGrupo(base44: any, campanha: any): Promise<Map<string, Set<string>>> {
  const ids = new Set<string>([
    ...(campanha?.escopo_grupos_ids || []),
    ...(campanha?.escopo_grupos_excluidos_ids || []),
  ].filter(Boolean).map((id: unknown) => String(id)));
  const resultado = new Map<string, Set<string>>();
  if (ids.size === 0) return resultado;

  let vinculos: any[] = [];
  try {
    vinculos = await base44.asServiceRole.entities.MembroGrupoEfetivo.list();
  } catch {
    vinculos = [];
  }

  for (const vinculo of vinculos || []) {
    const grupoId = String(vinculo?.grupo_id || '');
    const militarId = String(vinculo?.militar_id || '');
    if (!grupoId || !militarId || !ids.has(grupoId) || !vinculoGrupoValidoHoje(vinculo)) continue;
    if (!resultado.has(grupoId)) resultado.set(grupoId, new Set<string>());
    resultado.get(grupoId)!.add(militarId);
  }
  return resultado;
}

function militarNoEscopo(militar: any, campanha: any, membrosPorGrupo: Map<string, Set<string>>): boolean {
  if (!militar?.id) return false;
  const statusCadastro = normalizar(militar?.status_cadastro || militar?.status);
  if (['inativo', 'falecido'].includes(statusCadastro)) return false;

  const tipoEscopo = texto(campanha?.tipo_escopo || 'TODOS').toUpperCase();
  const gruposIds = (campanha?.escopo_grupos_ids || []).map((id: unknown) => String(id)).filter(Boolean);
  let baseEscopo = tipoEscopo === 'TODOS' || tipoEscopo === 'SEM_ESCOPO';

  // Segurança: SEM_ESCOPO representa "somente grupos". Sem grupo, não há público.
  if (tipoEscopo === 'SEM_ESCOPO' && gruposIds.length === 0) baseEscopo = false;

  if (tipoEscopo === 'SELECAO_MILITARES') {
    baseEscopo = (campanha?.escopo_militares_ids || [])
      .map((id: unknown) => String(id))
      .includes(String(militar.id));
  } else if (tipoEscopo === 'QUADROS') {
    baseEscopo = (campanha?.escopo_quadros || []).includes(militar?.quadro);
  } else if (tipoEscopo === 'UNIDADES' || tipoEscopo === 'UNIDADES_E_GRUPOS') {
    const alvos = (campanha?.escopo_unidades_ids || [])
      .map((id: unknown) => normalizar(id))
      .filter(Boolean);
    const valores = [
      militar?.lotacao_id,
      militar?.grupamento_id,
      militar?.estrutura_id,
      militar?.lotacao,
      militar?.estrutura_nome,
    ].map(normalizar).filter(Boolean);
    baseEscopo = alvos.some((alvo: string) =>
      valores.some((valor: string) => valor === alvo || valor.includes(alvo) || alvo.includes(valor))
    );
  } else if (!['TODOS', 'SEM_ESCOPO', 'UNIDADES_E_GRUPOS'].includes(tipoEscopo)) {
    baseEscopo = false;
  }

  const grupos = gruposIds.map((id: string) => membrosPorGrupo.get(id)).filter(Boolean);
  const pertenceGrupo = grupos.length === 0 || grupos.some((membros) => membros!.has(String(militar.id)));
  const excluidoPorMilitar = (campanha?.escopo_militares_excluidos_ids || [])
    .map((id: unknown) => String(id))
    .includes(String(militar.id));
  const excluidoPorGrupo = (campanha?.escopo_grupos_excluidos_ids || [])
    .some((id: unknown) => membrosPorGrupo.get(String(id))?.has(String(militar.id)));

  return baseEscopo && pertenceGrupo && !excluidoPorMilitar && !excluidoPorGrupo;
}

async function carregarCampanha(base44: any, campanhaId: string): Promise<any> {
  const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanhaId);
  if (!campanha || campanha.tipo !== 'PLANO_FERIAS') {
    throw Object.assign(new Error('Campanha de férias não encontrada.'), { status: 404 });
  }
  return campanha;
}

async function carregarPublico(base44: any, campanha: any): Promise<any[]> {
  const [militares, membrosPorGrupo] = await Promise.all([
    base44.asServiceRole.entities.Militar.list(),
    carregarMembrosPorGrupo(base44, campanha),
  ]);
  return (militares || []).filter((militar: any) => militarNoEscopo(militar, campanha, membrosPorGrupo));
}

function resumoPublico(publico: any[]) {
  const comTelefone = publico.filter((militar) => normalizeWhatsAppNumber(militar?.telefone));
  return {
    total: publico.length,
    com_telefone: comTelefone.length,
    sem_telefone: publico.length - comTelefone.length,
  };
}

async function criarEmLotes(items: any[], creator: (item: any) => Promise<any>, tamanho = 25) {
  for (let i = 0; i < items.length; i += tamanho) {
    await Promise.all(items.slice(i, i + tamanho).map(creator));
  }
}

async function atualizarEmLotes(items: any[], updater: (item: any) => Promise<any>, tamanho = 20) {
  for (let i = 0; i < items.length; i += tamanho) {
    await Promise.all(items.slice(i, i + tamanho).map(updater));
  }
}

async function listarDestinatarios(base44: any, envioId: string): Promise<any[]> {
  return await base44.asServiceRole.entities.EnvioMensagemDestinatario.filter({ envio_id: envioId }) || [];
}

async function recalcularEnvio(base44: any, envio: any) {
  const destinatarios = await listarDestinatarios(base44, String(envio.id));
  const totalEnviados = destinatarios.filter((item) => item.status === 'ENVIADO').length;
  const totalFalhas = destinatarios.filter((item) => item.status === 'FALHA').length;
  const totalSemContato = destinatarios.filter((item) => item.status === 'SEM_CONTATO').length;
  const totalPendentes = destinatarios.filter((item) => ['PENDENTE', 'ENVIANDO'].includes(item.status)).length;
  const concluido = totalPendentes === 0;
  const status = concluido
    ? (totalFalhas > 0 || totalSemContato > 0 ? 'CONCLUIDO_COM_FALHAS' : 'CONCLUIDO')
    : 'EM_PROCESSAMENTO';
  const patch: any = {
    status,
    total_destinatarios: destinatarios.length,
    total_enviaveis: destinatarios.length - totalSemContato,
    total_enviados: totalEnviados,
    total_falhas: totalFalhas,
    total_sem_contato: totalSemContato,
  };
  if (concluido) patch.concluido_em = new Date().toISOString();
  return await base44.asServiceRole.entities.EnvioMensagem.update(envio.id, patch);
}

async function registrarAuditoria(base44: any, user: any, campanha: any, acao: string, detalhes: any) {
  try {
    await base44.asServiceRole.entities.AuditoriaFerias.create({
      acao,
      resultado: 'SUCESSO',
      usuario_id: String(user?.id || ''),
      usuario_email: user?.email || '',
      usuario_nome: user?.full_name || user?.name || user?.email || 'Usuário',
      plano_id: String(campanha?.plano_ferias_institucional_id || ''),
      campanha_id: String(campanha?.id || ''),
      detalhes: JSON.stringify(detalhes || {}),
      data_hora: new Date().toISOString(),
    });
  } catch {
    // A auditoria complementar não pode impedir o disparo.
  }
}

async function historico(base44: any, campanhaId: string, envioId = '') {
  const envios = await base44.asServiceRole.entities.EnvioMensagem.filter({
    contexto_tipo: 'CAMPANHA_FERIAS',
    contexto_id: campanhaId,
  }) || [];
  const ordenados = [...envios].sort((a, b) => {
    const da = Date.parse(a?.created_date || a?.inicio_em || '') || 0;
    const db = Date.parse(b?.created_date || b?.inicio_em || '') || 0;
    return db - da;
  });
  const alvo = envioId || ordenados[0]?.id || '';
  const destinatarios = alvo ? await listarDestinatarios(base44, String(alvo)) : [];
  return {
    envios: ordenados.slice(0, 10),
    envio_atual: ordenados.find((item) => String(item.id) === String(alvo)) || null,
    destinatarios: destinatarios.sort((a, b) => texto(a?.militar_nome).localeCompare(texto(b?.militar_nome), 'pt-BR')),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const acao = texto(payload?.acao).toUpperCase();
    const campanhaId = texto(payload?.campanha_id);
    if (!campanhaId) return json({ error: 'Campanha não informada.' }, 400);

    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);
    if (!(await usuarioPodeEnviar(base44, user))) {
      return json({ error: 'Usuário sem permissão para disparar mensagens de campanhas de férias.' }, 403);
    }

    const campanha = await carregarCampanha(base44, campanhaId);

    if (acao === 'PREVIEW') {
      const publico = await carregarPublico(base44, campanha);
      const resumo = resumoPublico(publico);
      const linkPortal = validarLinkPortal(payload?.link_portal);
      const exemplo = publico[0]
        ? renderizarMensagem(publico[0], campanha, linkPortal)
        : MODELO_MENSAGEM
          .replace('{posto_graduacao} {nome_guerra}', 'Militar')
          .replaceAll('{nome_campanha}', texto(campanha?.titulo) || 'Campanha de Férias')
          .replaceAll('{data_limite}', formatarDataBR(campanha?.data_fim_militar))
          .replaceAll('{link_portal}', linkPortal);
      const hist = await historico(base44, campanhaId);
      return json({
        ok: true,
        campanha: {
          id: campanha.id,
          titulo: campanha.titulo,
          status: campanha.status,
          data_fim_militar: campanha.data_fim_militar,
        },
        publico: resumo,
        mensagem_exemplo: exemplo,
        link_portal: linkPortal,
        whatsapp_configurado: isEvolutionWhatsAppConfigured(),
        historico: hist.envios,
      });
    }

    if (acao === 'HISTORICO') {
      const hist = await historico(base44, campanhaId, texto(payload?.envio_id));
      return json({ ok: true, ...hist, whatsapp_configurado: isEvolutionWhatsAppConfigured() });
    }

    if (acao === 'CRIAR_ENVIO') {
      if (normalizar(campanha.status) !== 'aberta_coleta') {
        return json({ error: 'O disparo inicial só pode ser criado enquanto a campanha estiver em coleta.' }, 409);
      }
      if (!texto(campanha.data_fim_militar)) {
        return json({ error: 'A campanha não possui prazo final para os militares.' }, 409);
      }
      if (!isEvolutionWhatsAppConfigured()) {
        return json({ error: 'A integração de WhatsApp não está configurada nos secrets da aplicação.' }, 503);
      }

      const existentes = await base44.asServiceRole.entities.EnvioMensagem.filter({
        contexto_tipo: 'CAMPANHA_FERIAS',
        contexto_id: campanhaId,
      }) || [];
      const emAndamento = existentes.find((item: any) => ['EM_PREPARACAO', 'EM_PROCESSAMENTO'].includes(item?.status));
      if (emAndamento) {
        return json({
          error: 'Já existe um envio em processamento para esta campanha.',
          envio_id: emAndamento.id,
        }, 409);
      }

      const linkPortal = validarLinkPortal(payload?.link_portal);
      const publico = await carregarPublico(base44, campanha);
      const resumo = resumoPublico(publico);
      if (resumo.total === 0) return json({ error: 'A campanha não possui militares no público-alvo atual.' }, 409);

      const envio = await base44.asServiceRole.entities.EnvioMensagem.create({
        canal: 'WHATSAPP',
        contexto_tipo: 'CAMPANHA_FERIAS',
        contexto_id: campanhaId,
        titulo: `Campanha de Férias - ${texto(campanha.titulo)}`,
        mensagem_modelo: MODELO_MENSAGEM,
        link_destino: linkPortal,
        prazo: texto(campanha.data_fim_militar).slice(0, 10),
        status: 'EM_PREPARACAO',
        total_destinatarios: resumo.total,
        total_enviaveis: resumo.com_telefone,
        total_enviados: 0,
        total_falhas: 0,
        total_sem_contato: resumo.sem_telefone,
        solicitado_por_id: String(user?.id || ''),
        solicitado_por_email: user?.email || '',
        solicitado_por_nome: user?.full_name || user?.name || user?.email || 'Usuário',
      });

      try {
        await criarEmLotes(publico, async (militar) => {
          const telefoneNormalizado = normalizeWhatsAppNumber(militar?.telefone);
          return await base44.asServiceRole.entities.EnvioMensagemDestinatario.create({
            envio_id: String(envio.id),
            contexto_id: campanhaId,
            militar_id: String(militar.id),
            militar_nome: texto(militar.nome_completo) || texto(militar.nome_guerra) || 'Militar',
            posto_graduacao: texto(militar.posto_graduacao),
            nome_guerra: texto(militar.nome_guerra),
            telefone: texto(militar.telefone),
            telefone_normalizado: telefoneNormalizado || '',
            mensagem_renderizada: renderizarMensagem(militar, campanha, linkPortal),
            status: telefoneNormalizado ? 'PENDENTE' : 'SEM_CONTATO',
            tentativas: 0,
            ultimo_erro: telefoneNormalizado ? '' : 'Telefone ausente ou inválido no cadastro do militar.',
            provider: 'evolution_api',
          });
        });
      } catch (error: any) {
        await base44.asServiceRole.entities.EnvioMensagem.update(envio.id, {
          status: 'FALHOU',
          ultimo_erro: 'Falha ao preparar a fila de destinatários.',
        });
        throw error;
      }

      const preparado = await base44.asServiceRole.entities.EnvioMensagem.update(envio.id, {
        status: resumo.com_telefone > 0 ? 'EM_PROCESSAMENTO' : 'CONCLUIDO_COM_FALHAS',
        inicio_em: new Date().toISOString(),
        concluido_em: resumo.com_telefone > 0 ? undefined : new Date().toISOString(),
      });
      await registrarAuditoria(base44, user, campanha, 'WHATSAPP_CAMPANHA_CRIAR_ENVIO', {
        envio_id: envio.id,
        total_destinatarios: resumo.total,
        total_enviaveis: resumo.com_telefone,
        total_sem_contato: resumo.sem_telefone,
      });
      return json({ ok: true, envio: preparado, publico: resumo }, 201);
    }

    if (acao === 'PROCESSAR_LOTE') {
      const envioId = texto(payload?.envio_id);
      if (!envioId) return json({ error: 'Envio não informado.' }, 400);
      if (!isEvolutionWhatsAppConfigured()) {
        return json({ error: 'A integração de WhatsApp não está configurada nos secrets da aplicação.' }, 503);
      }
      const envio = await base44.asServiceRole.entities.EnvioMensagem.get(envioId);
      if (!envio || envio.contexto_tipo !== 'CAMPANHA_FERIAS' || String(envio.contexto_id) !== campanhaId) {
        return json({ error: 'Envio não encontrado para esta campanha.' }, 404);
      }

      let destinatarios = await listarDestinatarios(base44, envioId);
      const agora = Date.now();
      const travados = destinatarios.filter((item) => {
        if (item.status !== 'ENVIANDO') return false;
        const ultima = Date.parse(item.ultima_tentativa_em || '') || 0;
        return !ultima || agora - ultima > 120000;
      });
      if (travados.length) {
        await atualizarEmLotes(travados, (item) =>
          base44.asServiceRole.entities.EnvioMensagemDestinatario.update(item.id, { status: 'PENDENTE' })
        );
        destinatarios = await listarDestinatarios(base44, envioId);
      }

      const tamanhoSolicitado = Number(payload?.tamanho_lote || 8);
      const tamanhoLote = Math.max(1, Math.min(10, Number.isFinite(tamanhoSolicitado) ? tamanhoSolicitado : 8));
      const lote = destinatarios.filter((item) => item.status === 'PENDENTE').slice(0, tamanhoLote);

      if (lote.length === 0) {
        const finalizado = await recalcularEnvio(base44, envio);
        return json({ ok: true, envio: finalizado, processados: 0, ha_pendentes: false });
      }

      await base44.asServiceRole.entities.EnvioMensagem.update(envio.id, {
        status: 'EM_PROCESSAMENTO',
        inicio_em: envio.inicio_em || new Date().toISOString(),
      });

      await Promise.all(lote.map(async (destinatario) => {
        const tentativaEm = new Date().toISOString();
        const tentativas = Number(destinatario.tentativas || 0) + 1;
        await base44.asServiceRole.entities.EnvioMensagemDestinatario.update(destinatario.id, {
          status: 'ENVIANDO',
          tentativas,
          ultima_tentativa_em: tentativaEm,
          ultimo_erro: '',
        });

        const resultado = await sendEvolutionWhatsAppText({
          to: destinatario.telefone_normalizado || destinatario.telefone,
          text: destinatario.mensagem_renderizada,
        });
        if (resultado.success) {
          await base44.asServiceRole.entities.EnvioMensagemDestinatario.update(destinatario.id, {
            status: 'ENVIADO',
            provider: resultado.provider,
            provider_message_id: resultado.messageId || '',
            enviado_em: new Date().toISOString(),
            ultimo_erro: '',
          });
        } else {
          await base44.asServiceRole.entities.EnvioMensagemDestinatario.update(destinatario.id, {
            status: 'FALHA',
            provider: resultado.provider,
            ultimo_erro: resultado.error || 'Falha não identificada no envio.',
          });
        }
      }));

      const atualizado = await recalcularEnvio(base44, envio);
      const restantes = await listarDestinatarios(base44, envioId);
      const haPendentes = restantes.some((item) => ['PENDENTE', 'ENVIANDO'].includes(item.status));
      return json({
        ok: true,
        envio: atualizado,
        processados: lote.length,
        ha_pendentes: haPendentes,
      });
    }

    if (acao === 'REENVIAR_FALHAS') {
      if (!isEvolutionWhatsAppConfigured()) {
        return json({ error: 'A integração de WhatsApp não está configurada nos secrets da aplicação.' }, 503);
      }
      if (normalizar(campanha.status) !== 'aberta_coleta') {
        return json({ error: 'Falhas só podem ser reenviadas enquanto a campanha estiver em coleta.' }, 409);
      }
      const envioId = texto(payload?.envio_id);
      if (!envioId) return json({ error: 'Envio não informado.' }, 400);
      const envio = await base44.asServiceRole.entities.EnvioMensagem.get(envioId);
      if (!envio || envio.contexto_tipo !== 'CAMPANHA_FERIAS' || String(envio.contexto_id) !== campanhaId) {
        return json({ error: 'Envio não encontrado para esta campanha.' }, 404);
      }
      const destinatarios = await listarDestinatarios(base44, envioId);
      const falhas = destinatarios.filter((item) => item.status === 'FALHA');
      if (falhas.length === 0) return json({ ok: true, envio, reenfileirados: 0 });

      await atualizarEmLotes(falhas, (item) =>
        base44.asServiceRole.entities.EnvioMensagemDestinatario.update(item.id, {
          status: 'PENDENTE',
          ultimo_erro: '',
        })
      );
      const atualizado = await base44.asServiceRole.entities.EnvioMensagem.update(envio.id, {
        status: 'EM_PROCESSAMENTO',
        concluido_em: undefined,
        ultimo_erro: '',
      });
      await registrarAuditoria(base44, user, campanha, 'WHATSAPP_CAMPANHA_REENVIAR_FALHAS', {
        envio_id: envioId,
        quantidade: falhas.length,
      });
      return json({ ok: true, envio: atualizado, reenfileirados: falhas.length });
    }

    return json({ error: 'Ação não reconhecida.' }, 400);
  } catch (error: any) {
    console.error('[campanhaFeriasWhatsApp]', error?.message || error);
    return json({ error: error?.message || 'Erro interno ao processar comunicação da campanha.' }, error?.status || 500);
  }
});
