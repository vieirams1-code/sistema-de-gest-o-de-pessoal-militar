import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// procedimentosEscopado — backend do módulo Procedimentos Administrativos
// ---------------------------------------------------------------------
// Centraliza leitura e escrita das entidades:
//   - ProcedimentoProcesso
//   - ProcedimentoEnvolvido
//   - ProcedimentoPrazoHistorico
//
// As entidades têm RLS fechada: todo acesso passa por aqui, após validar
// autenticação e permissão funcional (módulo Controle de Processos e
// Procedimentos). As operações usam asServiceRole somente depois disso.
//
// Ações:
//   listar          → procedimentos + envolvidos
//   obter           → procedimento + envolvidos + prazos
//   criar           → cria procedimento, envolvidos e prazo inicial
//   atualizar       → atualiza dados e (quando enviado) envolvidos
//   registrarPrazo  → registra prorrogação e recalcula prazo final
//   excluir         → remove procedimento, envolvidos e prazos
// =====================================================================

const CAMPOS_PROCEDIMENTO = [
  'tipo_procedimento', 'numero_procedimento', 'numero_portaria', 'data_portaria',
  'data_instauracao', 'prazo_inicial_dias', 'prazo_final', 'autoridade_instauradora',
  'encarregado_id', 'encarregado_nome', 'encarregado_posto', 'encarregado_quadro',
  'encarregado_matricula', 'unidade', 'objeto', 'sigiloso', 'prioridade_risco',
  'status', 'data_solucao', 'resultado_solucao', 'observacoes',
];

const STATUS_ENCERRADOS = ['Solucionado', 'Arquivado', 'Cancelado'];
const TIPO_INSTAURACAO = 'Portaria de Instauração de Procedimento';
const TIPO_DESIGNACAO = 'Designação de Encarregado de PAD';
const TIPO_PRORROGACAO = 'Prorrogação de Prazo de Procedimento';
const TIPO_SOLUCAO = 'Solução de Procedimento';
const TIPOS_DE_PUBLICACAO = [TIPO_INSTAURACAO, TIPO_DESIGNACAO, TIPO_PRORROGACAO, TIPO_SOLUCAO];

const hojeIso = () => new Date().toISOString().slice(0, 10);

function addDias(base, dias) {
  const valor = String(base || '').slice(0, 10);
  if (!valor) return '';
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return '';
  data.setUTCDate(data.getUTCDate() + Number(dias || 0));
  return data.toISOString().slice(0, 10);
}

function limparProcedimento(data = {}) {
  const saida = {};
  CAMPOS_PROCEDIMENTO.forEach((campo) => {
    if (data[campo] !== undefined && data[campo] !== null) saida[campo] = data[campo];
  });
  return saida;
}

function limparEnvolvido(envolvido = {}, procedimentoId) {
  return {
    procedimento_id: procedimentoId,
    militar_id: String(envolvido.militar_id || ''),
    nome: String(envolvido.nome || ''),
    posto: String(envolvido.posto || ''),
    quadro: String(envolvido.quadro || ''),
    matricula: String(envolvido.matricula || ''),
    papel: String(envolvido.papel || 'Investigado'),
    observacao: String(envolvido.observacao || ''),
  };
}

async function resolverAutorizacao(base44) {
  const resposta = await base44.functions.invoke('getUserPermissions', {});
  return resposta?.data ?? resposta ?? {};
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth
      .me()
      .catch((e) => ([401, 400].includes(e?.status ?? e?.response?.status) ? null : Promise.reject(e)));
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || '').trim();
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const id = payload?.id ? String(payload.id) : null;

    const authz = await resolverAutorizacao(base44).catch(() => ({}));
    const isAdmin = authz?.isAdmin === true;
    const actions = authz?.actions || {};
    const modules = authz?.modules || {};
    const can = (chave) => isAdmin || actions[chave] === true;
    const podeModulo = isAdmin
      || (modules['controle_processos'] === true && actions['visualizar_controle_processos'] === true);

    if (!podeModulo) {
      return Response.json({ error: 'Acesso negado: sem permissão no módulo de Procedimentos.' }, { status: 403 });
    }

    const Procedimentos = base44.asServiceRole.entities.ProcedimentoProcesso;
    const Envolvidos = base44.asServiceRole.entities.ProcedimentoEnvolvido;
    const Prazos = base44.asServiceRole.entities.ProcedimentoPrazoHistorico;
    const Publicacoes = base44.asServiceRole.entities.PublicacaoExOfficio;

    switch (action) {
      case 'listar': {
        const procedimentos = await Procedimentos.list('-data_instauracao', 1000);
        const ids = (procedimentos || []).map((p) => p.id);
        const envolvidos = ids.length
          ? await Envolvidos.filter({ procedimento_id: { $in: ids } }, undefined, 2000, 0)
          : [];
        return Response.json({ ok: true, procedimentos: procedimentos || [], envolvidos: envolvidos || [] });
      }

      case 'obter': {
        if (!id) return Response.json({ error: 'ID do procedimento é obrigatório.' }, { status: 400 });
        const procedimento = await Procedimentos.get(id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (!procedimento) return Response.json({ error: 'Procedimento não encontrado.' }, { status: 404 });
        const [envolvidos, prazos, registrosRP] = await Promise.all([
          Envolvidos.filter({ procedimento_id: id }, undefined, 500, 0),
          Prazos.filter({ procedimento_id: id }, '-data_fim', 200, 0),
          Publicacoes.filter({ procedimento_id: id }, '-created_date', 200, 0),
        ]);
        const publicacoes = (registrosRP || []).map(({ id, tipo, status, nota_para_bg, numero_bg, data_bg, procedimento_prazo_id }) =>
          ({ id, tipo, status, nota_para_bg, numero_bg, data_bg, procedimento_prazo_id }));
        return Response.json({ ok: true, procedimento, envolvidos: envolvidos || [], prazos: prazos || [], publicacoes });
      }

      case 'validarPublicacao': {
        if (!can('adicionar_publicacoes')) {
          return Response.json({ error: 'Sem permissão para criar publicação.' }, { status: 403 });
        }
        const tipo = String(data.tipo || '');
        const prazoId = String(data.procedimento_prazo_id || '');
        if (!id || !TIPOS_DE_PUBLICACAO.includes(tipo) || (tipo === TIPO_PRORROGACAO) !== Boolean(prazoId)) {
          return Response.json({ error: 'Informe um procedimento e um ato válidos.' }, { status: 400 });
        }

        const procedimento = await Procedimentos.get(id);
        if (!procedimento || procedimento.sigiloso || !procedimento.numero_portaria) {
          return Response.json({ error: 'Procedimento indisponível para publicação no RP.' }, { status: 409 });
        }
        if (tipo === TIPO_DESIGNACAO && (procedimento.tipo_procedimento !== 'PAD' || !procedimento.encarregado_id
          || procedimento.encarregado_id !== data.militar_id)) {
          return Response.json({ error: 'Selecione o encarregado que consta na ficha do PAD.' }, { status: 400 });
        }
        if (prazoId) {
          const prazo = await Prazos.get(prazoId);
          if (!prazo || prazo.procedimento_id !== id || prazo.tipo !== 'Prorrogação') {
            return Response.json({ error: 'A prorrogação selecionada não pertence ao procedimento.' }, { status: 400 });
          }
        }
        const registros = await Publicacoes.filter({
          procedimento_id: id,
          tipo,
          ...(prazoId ? { procedimento_prazo_id: prazoId } : {}),
        }, undefined, 1, 0);
        if (registros.length) {
          return Response.json({ error: 'Já existe uma publicação vinculada para este ato.' }, { status: 409 });
        }
        return Response.json({ ok: true });
      }

      case 'criar': {
        if (!can('criar_processo_controle')) {
          return Response.json({ error: 'Ação negada: permissão necessária para criar procedimento.' }, { status: 403 });
        }
        const limpo = limparProcedimento(data);
        if (!limpo.tipo_procedimento) {
          return Response.json({ error: 'Informe o tipo do procedimento.' }, { status: 400 });
        }
        const dias = Number(limpo.prazo_inicial_dias || 0);
        if (!limpo.prazo_final && limpo.data_instauracao && dias > 0) {
          limpo.prazo_final = addDias(limpo.data_instauracao, dias);
        }
        if (!limpo.status) limpo.status = 'Instaurado';

        const procedimento = await Procedimentos.create({
          ...limpo,
          prorrogacoes_count: 0,
          sigiloso: limpo.sigiloso === true,
        });

        const envolvidos = Array.isArray(data.envolvidos) ? data.envolvidos : [];
        if (envolvidos.length) {
          await Envolvidos.bulkCreate(envolvidos.map((e) => limparEnvolvido(e, procedimento.id)));
        }

        if (limpo.data_instauracao && limpo.prazo_final) {
          await Prazos.create({
            procedimento_id: procedimento.id,
            tipo: 'Instauração',
            dias,
            data_inicio: limpo.data_instauracao,
            data_fim: limpo.prazo_final,
            motivo: 'Prazo inicial de instauração',
            criado_por_email: authUser.email || '',
          });
        }

        return Response.json({ ok: true, procedimento });
      }

      case 'atualizar': {
        if (!can('editar_processo_controle')) {
          return Response.json({ error: 'Ação negada: permissão necessária para editar procedimento.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'ID do procedimento é obrigatório.' }, { status: 400 });
        const atual = await Procedimentos.get(id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (!atual) return Response.json({ error: 'Procedimento não encontrado.' }, { status: 404 });

        const limpo = limparProcedimento(data);
        if (limpo.status === 'Solucionado' && !limpo.data_solucao && !atual.data_solucao) {
          limpo.data_solucao = hojeIso();
        }
        const procedimento = await Procedimentos.update(id, limpo);

        if (Array.isArray(data.envolvidos)) {
          await Envolvidos.deleteMany({ procedimento_id: id });
          if (data.envolvidos.length) {
            await Envolvidos.bulkCreate(data.envolvidos.map((e) => limparEnvolvido(e, id)));
          }
        }

        return Response.json({ ok: true, procedimento });
      }

      case 'registrarPrazo': {
        if (!can('editar_processo_controle')) {
          return Response.json({ error: 'Ação negada: permissão necessária para gerir prazos.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'ID do procedimento é obrigatório.' }, { status: 400 });
        const atual = await Procedimentos.get(id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (!atual) return Response.json({ error: 'Procedimento não encontrado.' }, { status: 404 });

        const dias = Number(data.dias || 0);
        if (!dias || dias <= 0) {
          return Response.json({ error: 'Informe a quantidade de dias da prorrogação.' }, { status: 400 });
        }

        const base = String(data.data_inicio || atual.prazo_final || atual.data_instauracao || '').slice(0, 10);
        if (!base) {
          return Response.json({ error: 'Procedimento sem prazo base para prorrogar.' }, { status: 400 });
        }
        const novaDataFinal = addDias(base, dias);

        const prazo = await Prazos.create({
          procedimento_id: id,
          tipo: 'Prorrogação',
          dias,
          data_inicio: base,
          data_fim: novaDataFinal,
          motivo: String(data.motivo || ''),
          criado_por_email: authUser.email || '',
        });

        const procedimento = await Procedimentos.update(id, {
          prazo_final: novaDataFinal,
          prorrogacoes_count: Number(atual.prorrogacoes_count || 0) + 1,
          status: STATUS_ENCERRADOS.includes(atual.status) ? atual.status : 'Prorrogado',
        });

        return Response.json({ ok: true, procedimento, prazo });
      }

      case 'excluir': {
        if (!can('excluir_processo_controle')) {
          return Response.json({ error: 'Ação negada: permissão necessária para excluir procedimento.' }, { status: 403 });
        }
        if (!id) return Response.json({ error: 'ID do procedimento é obrigatório.' }, { status: 400 });
        await Envolvidos.deleteMany({ procedimento_id: id });
        await Prazos.deleteMany({ procedimento_id: id });
        await Procedimentos.delete(id);
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: 'Ação não suportada.' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error?.message || 'Erro ao processar procedimentos.' }, { status: 500 });
  }
}