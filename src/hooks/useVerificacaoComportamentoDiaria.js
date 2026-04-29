/**
 * useVerificacaoComportamentoDiaria — Lote 1D-A
 * ----------------------------------------------------------------------------
 * EXECUÇÃO AUTOMÁTICA DESABILITADA NO LOTE 1D-A.
 *
 * Motivo da neutralização:
 * - O hook rodava globalmente no Layout e disparava, em uma única sessão:
 *     1) base44.entities.Militar.list()  — leitura geral, sem escopo de usuário
 *     2) PunicaoDisciplinar.filter({ militar_id })  — chamado por militar (N+1)
 *     3) criarPendenciaComportamentoSemDuplicidade(...)  — que internamente
 *        chama PendenciaComportamento.filter + .create
 * - Em cenário com ~200 militares, isso podia gerar centenas de requisições
 *   automáticas ao abrir o app, com risco real de rate limit e custo de leitura
 *   sem nenhum gating administrativo no backend.
 *
 * Estado atual deste hook (após Lote 1D-A):
 * - Mantém a exportação default com a MESMA assinatura para não quebrar o
 *   import existente em `layout.jsx`:
 *     useVerificacaoComportamentoDiaria({ enabled, incluirReabilitadas })
 * - Não faz NENHUMA chamada a entidades:
 *     • NÃO chama base44.entities.Militar.list
 *     • NÃO chama PunicaoDisciplinar.filter / .list
 *     • NÃO chama PendenciaComportamento.filter / .create
 * - Não cria pendências.
 * - Não lê localStorage para travas (a antiga chave `sgp_militar_comportamento_last_run`
 *   foi mantida intencionalmente no storage do navegador para evitar reexecução
 *   caso o hook volte a ser ativado em um próximo lote — não há gravação aqui).
 *
 * Próximo passo planejado (fora deste lote):
 * - Migrar toda a lógica para uma Deno Function `verificarComportamentoDiario`
 *   admin-only, executada sob demanda (ex.: botão administrativo) ou via
 *   automação agendada server-side. O cálculo (calcularComportamento,
 *   compararComportamentos, criarPendenciaComportamentoSemDuplicidade) será
 *   reaproveitado lá, mas com `base44.asServiceRole` e em uma única passada
 *   sem N+1.
 *
 * IMPORTANTE: Não remover este arquivo. Não alterar a forma de import em
 * `layout.jsx`. A neutralização precisa ser reversível em um único lote
 * (basta restaurar o corpo do useEffect quando a Deno Function estiver pronta).
 * ----------------------------------------------------------------------------
 */

// eslint-disable-next-line no-unused-vars
export default function useVerificacaoComportamentoDiaria({ incluirReabilitadas = false, enabled = true } = {}) {
  // No-op intencional. Ver bloco de documentação acima (Lote 1D-A).
  // Nenhuma chamada a entidades, nenhum useEffect, nenhuma criação de pendência.
  return undefined;
}