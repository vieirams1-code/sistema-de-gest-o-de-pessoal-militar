import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado, bulkEscopado, excluirEscopado } from './cudEscopadoClient';

/**
 * Service para gestão do módulo "Conferência Cadastral de Militar".
 */

/**
 * Helper seguro para extrair o ID do militar de diferentes possíveis campos.
 */
export const getMilitarId = (militar) => {
  if (!militar) return null;
  const id = militar.id || militar._id || militar.militar_id;
  return id ? String(id) : null;
};

export const conferenciaMilitarService = {
  /**
   * Lista as conferências com base nos filtros fornecidos.
   */
  async listarConferencias(filtros = {}) {
    const { militarId, tipoConferencia, status, unidadeId, dataInicio, dataFim } = filtros;

    const where = {};
    if (militarId) where.militar_id = militarId;
    if (tipoConferencia && tipoConferencia !== 'null') where.tipo_conferencia = tipoConferencia;
    if (status && status !== 'null') {
      if (Array.isArray(status)) {
        where.status = { $in: status };
      } else if (typeof status === 'object' && status['$in']) {
        where.status = { $in: status['$in'] };
      } else {
        where.status = status;
      }
    }
    if (unidadeId) where.unidade_id = unidadeId;
    if (dataInicio) where.created_date = { ...(where.created_date || {}), $gte: `${dataInicio}T00:00:00Z` };
    if (dataFim) where.created_date = { ...(where.created_date || {}), $lte: `${dataFim}T23:59:59Z` };

    const resp = await base44.entities.ConferenciaMilitar.filter(where, '-created_date');
    return Array.isArray(resp) ? resp : (resp?.data || []);
  },

  /**
   * Busca conferência aberta (pendente ou em_andamento) para evitar duplicidades de tipos específicos.
   */
  async buscarConferenciaAberta(militarId) {
    if (!militarId) return null;

    const tiposBloqueantes = ['ingresso', 'reativacao', 'retorno_transferencia'];

    const conferencias = await base44.entities.ConferenciaMilitar.filter({ militar_id: militarId });

    const lista = Array.isArray(conferencias) ? conferencias : (conferencias?.data || []);

    return lista.find(c =>
      ['pendente', 'em_andamento'].includes(c.status) &&
      tiposBloqueantes.includes(c.tipo_conferencia)
    ) || null;
  },

  /**
   * Obtém os detalhes de uma conferência e seus itens.
   */
  async obterConferenciaDetalhada(conferenciaId) {
    if (!conferenciaId) throw new Error('ID da conferência é obrigatório.');

    const rawConferencia = await base44.entities.ConferenciaMilitar.get(conferenciaId);
    if (!rawConferencia) throw new Error('Conferência não encontrada.');

    const conferencia = rawConferencia?.data || rawConferencia;

    const rawItens = await base44.entities.ItemConferenciaMilitar.filter({ conferencia_id: conferenciaId }, 'ordem');

    const itens = Array.isArray(rawItens) ? rawItens : (rawItens?.data || []);

    return {
      ...conferencia,
      itens
    };
  },

  /**
   * Cria uma nova conferência militar.
   */
  async criarConferenciaMilitar({ militar, tipo_conferencia, data_inicio_referencia, data_fim_referencia, observacao_geral, usuario }) {
    const militar_id = getMilitarId(militar);
    console.log('[conferenciaMilitarService] militar_id recebido:', militar_id);

    if (!militar_id) throw new Error('ID do militar é obrigatório para criar conferência.');
    if (!tipo_conferencia) throw new Error('Tipo de conferência é obrigatório.');

    // Validação de campos obrigatórios do militar para o snapshot da conferência
    const militar_nome = militar.nome_completo || militar.nome;
    const militar_matricula = militar.matricula;
    const militar_posto_graduacao = militar.posto_graduacao;

    if (!militar_nome) throw new Error('Nome do militar é obrigatório para o snapshot da conferência.');
    if (!militar_matricula) throw new Error('Matrícula do militar é obrigatória para o snapshot da conferência.');
    if (!militar_posto_graduacao) throw new Error('Posto/Graduação do militar é obrigatório para o snapshot da conferência.');

    const payload = {
      militar_id,
      militar_nome,
      militar_matricula,
      militar_posto_graduacao,
      tipo_conferencia,
      status: 'pendente',
      data_inicio_referencia,
      data_fim_referencia,
      data_abertura: new Date().toISOString(),
      unidade_id: usuario?.unidade_id || militar.estrutura_id || militar.subgrupamento_id,
      unidade_nome: usuario?.unidade_nome || militar.estrutura_nome || militar.subgrupamento_nome,
      responsavel_id: usuario?.id,
      responsavel_nome: usuario?.full_name,
      observacao_geral,
      progresso_percentual: 0
    };

    const novaConferencia = await criarEscopado('ConferenciaMilitar', payload);
    console.log('[conferenciaMilitarService] conferencia criada:', novaConferencia.id);

    await this.gerarItensPadraoConferencia(novaConferencia.id, tipo_conferencia, militar_id);

    return novaConferencia;
  },

  /**
   * Atualiza um item da conferência.
   */
  async atualizarItemConferencia(itemId, dados, usuario) {
    const updatePayload = {
      ...dados,
      responsavel_id: usuario?.id,
      responsavel_nome: usuario?.full_name,
      data_conferencia: new Date().toISOString()
    };

    const itemAtualizado = await atualizarEscopado('ItemConferenciaMilitar', itemId, updatePayload);

    await this.atualizarStatusConferencia(itemAtualizado.conferencia_id);

    return itemAtualizado;
  },

  /**
   * Gerar itens padrão com base no tipo.
   */
  async gerarItensPadraoConferencia(conferenciaId, tipo_conferencia, militarId) {
    const itensIngresso = [
      { categoria: 'Cadastro', titulo: 'Conferir dados funcionais básicos', descricao: 'Validar nome, matrícula, posto/graduação, unidade e dados pessoais no SGP.', obrigatorio: true },
      { categoria: 'Carreira', titulo: 'Conferir histórico de promoções', descricao: 'Verificar se todas as promoções históricas estão lançadas.', obrigatorio: true },
      { categoria: 'Carreira', titulo: 'Conferir medalhas e condecorações', descricao: 'Validar medalhas de tempo de serviço e honrarias especiais.', obrigatorio: true },
      { categoria: 'Disciplina', titulo: 'Conferir punições e elogios', descricao: 'Verificar lançamentos de punições disciplinares e elogios.', obrigatorio: true },
      { categoria: 'Afastamentos', titulo: 'Conferir férias e períodos aquisitivos', descricao: 'Validar períodos aquisitivos e gozos de férias.', obrigatorio: true },
      { categoria: 'Afastamentos', titulo: 'Conferir afastamentos, atestados e JISO', descricao: 'Verificar registros de saúde e licenças.', obrigatorio: true },
      { categoria: 'Capacitação', titulo: 'Conferir cursos e formações', descricao: 'Validar cursos de formação e especialização.', obrigatorio: true },
      { categoria: 'Função', titulo: 'Conferir funções, designações e gratificações', descricao: 'Validar funções gratificadas e designações.', obrigatorio: true },
      { categoria: 'Documentação', titulo: 'Conferir documentos obrigatórios', descricao: 'Verificar se RG, CPF, CNH e diplomas estão anexados.', obrigatorio: true },
      { categoria: 'Publicações', titulo: 'Conferir publicações relevantes em BG, BR ou DOEMS', descricao: 'Verificar se todas as alterações possuem publicação correspondente.', obrigatorio: true },
    ];

    const itensRetorno = [
      { categoria: 'Cadastro', titulo: 'Conferir alterações funcionais no período de ausência', descricao: 'Validar mudanças de unidade ou funções durante o período.', obrigatorio: true },
      { categoria: 'Carreira', titulo: 'Conferir promoções ocorridas no período de ausência', descricao: 'Verificar promoções publicadas enquanto o militar estava fora.', obrigatorio: true },
      { categoria: 'Carreira', titulo: 'Conferir medalhas concedidas no período de ausência', descricao: 'Verificar concessões de medalhas no período.', obrigatorio: true },
      { categoria: 'Disciplina', titulo: 'Conferir punições/elogios no período de ausência', descricao: 'Lançar eventuais alterações disciplinares ocorridas fora da unidade.', obrigatorio: true },
      { categoria: 'Afastamentos', titulo: 'Conferir férias e afastamentos no período de ausência', descricao: 'Lançar gozos de férias ou licenças ocorridas no período.', obrigatorio: true },
      { categoria: 'Capacitação', titulo: 'Conferir cursos realizados no período de ausência', descricao: 'Cadastrar cursos e especializações concluídas.', obrigatorio: true },
      { categoria: 'Função', titulo: 'Conferir funções/designações/gratificações no período de ausência', descricao: 'Validar histórico de funções no período.', obrigatorio: true },
      { categoria: 'Documentação', titulo: 'Conferir documentos e publicações do período de ausência', descricao: 'Anexar publicações de atos ocorridos na ausência.', obrigatorio: true },
      { categoria: 'Situação', titulo: 'Validar situação atual do militar após retorno', descricao: 'Confirmar se o militar está com status Ativo e situação correta.', obrigatorio: true },
    ];

    const template = (tipo_conferencia === 'ingresso' || tipo_conferencia === 'saneamento_manual')
      ? itensIngresso
      : itensRetorno;

    const itensParaCriar = template.map((item, index) => ({
      ...item,
      conferencia_id: conferenciaId,
      militar_id: String(militarId),
      status: 'pendente',
      ordem: (index + 1) * 10
    }));

    return await bulkEscopado('ItemConferenciaMilitar', itensParaCriar);
  },

  /**
   * Recalcula progresso e atualiza status da conferência.
   */
  async atualizarStatusConferencia(conferenciaId) {
    const det = await this.obterConferenciaDetalhada(conferenciaId);
    const { itens, status: statusAtual } = det;

    if (!itens || itens.length === 0) return;

    const totalItens = itens.length;
    const itensNaoPendentes = itens.filter(i => i.status !== 'pendente').length;
    const progresso = Math.round((itensNaoPendentes / totalItens) * 100);

    const updatePayload = {
      progresso_percentual: progresso
    };

    if (statusAtual === 'pendente' && itensNaoPendentes > 0) {
      updatePayload.status = 'em_andamento';
    }

    await atualizarEscopado('ConferenciaMilitar', conferenciaId, updatePayload);
  },

  /**
   * Conclui a conferência validando itens obrigatórios.
   */
  async concluirConferencia(conferenciaId) {
    const { itens } = await this.obterConferenciaDetalhada(conferenciaId);

    const itensObrigatoriosPendentes = itens.filter(i => i.obrigatorio && (i.status === 'pendente' || i.status === 'em_andamento'));

    if (itensObrigatoriosPendentes.length > 0) {
      throw new Error(`Não é possível concluir: existem ${itensObrigatoriosPendentes.length} itens obrigatórios pendentes ou em andamento.`);
    }

    const possuiPendenciasResiduais = itens.some(i => ['revisar', 'nao_localizado', 'pendente_justificado'].includes(i.status));

    const novoStatus = possuiPendenciasResiduais ? 'concluida_com_pendencias' : 'concluida';

    return await atualizarEscopado('ConferenciaMilitar', conferenciaId, {
      status: novoStatus,
      data_conclusao: new Date().toISOString()
    });
  },

  /**
   * Reabre uma conferência concluída ou cancelada.
   */
  async reabrirConferencia(conferenciaId) {
    return await atualizarEscopado('ConferenciaMilitar', conferenciaId, {
      status: 'em_andamento',
      data_conclusao: null
    });
  },

  /**
   * Cancela uma conferência.
   */
  async cancelarConferencia(conferenciaId) {
    return await atualizarEscopado('ConferenciaMilitar', conferenciaId, {
      status: 'cancelada'
    });
  },

  /**
   * Exclui definitivamente uma conferência e todos os itens vinculados.
   */
  async excluirConferencia(conferenciaId) {
    if (!conferenciaId) throw new Error('ID da conferência é obrigatório.');

    const rawConferencia = await base44.entities.ConferenciaMilitar.get(conferenciaId);
    const conferencia = rawConferencia?.data || rawConferencia;
    if (!conferencia) throw new Error('Conferência não encontrada.');

    const rawItens = await base44.entities.ItemConferenciaMilitar.filter({ conferencia_id: conferenciaId });
    const itens = Array.isArray(rawItens) ? rawItens : (rawItens?.data || []);

    for (const item of itens) {
      await excluirEscopado('ItemConferenciaMilitar', item.id || item._id);
    }

    await excluirEscopado('ConferenciaMilitar', conferenciaId);

    return { success: true };
  }
};
