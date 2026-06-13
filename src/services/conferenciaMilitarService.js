import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado, bulkEscopado } from './cudEscopadoClient';

/**
 * Service para gestão do módulo "Conferência Cadastral de Militar".
 */

export const conferenciaMilitarService = {
  /**
   * Lista as conferências com base nos filtros fornecidos.
   */
  async listarConferencias(filtros = {}) {
    const { militarId, tipoConferencia, status, unidadeId, dataInicio, dataFim } = filtros;

    let query = base44.entities.ConferenciaMilitar.query();

    if (militarId) query = query.where('militar_id', '==', militarId);
    if (tipoConferencia && tipoConferencia !== 'null') query = query.where('tipo_conferencia', '==', tipoConferencia);
    if (status && status !== 'null') query = query.where('status', '==', status);
    if (unidadeId) query = query.where('unidade_id', '==', unidadeId);

    if (dataInicio) query = query.where('created_date', '>=', `${dataInicio}T00:00:00Z`);
    if (dataFim) query = query.where('created_date', '<=', `${dataFim}T23:59:59Z`);

    const resp = await query.orderBy('created_date', 'desc').get();
    return Array.isArray(resp) ? resp : (resp?.data || []);
  },

  /**
   * Obtém os detalhes de uma conferência e seus itens.
   */
  async obterConferenciaDetalhada(conferenciaId) {
    if (!conferenciaId) throw new Error('ID da conferência é obrigatório.');

    const rawConferencia = await base44.entities.ConferenciaMilitar.get(conferenciaId);
    if (!rawConferencia) throw new Error('Conferência não encontrada.');

    const conferencia = rawConferencia?.data || rawConferencia;

    const rawItens = await base44.entities.ItemConferenciaMilitar.query()
      .where('conferencia_id', '==', conferenciaId)
      .orderBy('ordem', 'asc')
      .get();

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
    if (!militar?.id) throw new Error('Militar é obrigatório.');
    if (!tipo_conferencia) throw new Error('Tipo de conferência é obrigatório.');

    const payload = {
      militar_id: militar.id,
      militar_nome: militar.nome_completo || militar.nome,
      militar_matricula: militar.matricula,
      militar_posto_graduacao: militar.posto_graduacao,
      tipo_conferencia,
      status: 'pendente',
      data_inicio_referencia,
      data_fim_referencia,
      data_abertura: new Date().toISOString(),
      unidade_id: usuario?.unidade_id || militar.estrutura_id,
      unidade_nome: usuario?.unidade_nome || militar.estrutura_nome,
      responsavel_id: usuario?.id,
      responsavel_nome: usuario?.full_name,
      observacao_geral,
      progresso_percentual: 0
    };

    const novaConferencia = await criarEscopado('ConferenciaMilitar', payload);

    await this.gerarItensPadraoConferencia(novaConferencia.id, tipo_conferencia, militar.id);

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
      militar_id: militarId,
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
  }
};
