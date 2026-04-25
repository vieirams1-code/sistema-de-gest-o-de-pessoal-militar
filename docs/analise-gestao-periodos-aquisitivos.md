# Análise da sistemática de gestão de períodos aquisitivos

## Contexto observado
A tela atual de **Períodos Aquisitivos** concentra, em um único fluxo:
- geração automática de períodos,
- filtros analíticos detalhados,
- gestão de status,
- edição de datas,
- exclusão/inativação com regras de segurança,
- e leitura de frações relacionadas.

Isso traz poder operacional, mas também aumenta a carga cognitiva para o usuário que só quer responder: **“quem precisa de ação agora?”**.

---

## Principais pontos de complexidade

1. **Muitos filtros simultâneos no topo** (militar, período, status e busca), que exigem decisão prévia antes da ação.
2. **Dois níveis de navegação por expansão** (militar > cartões de período), com bastante informação por cartão.
3. **Modal de gestão com múltiplos objetivos** (edição, status e exclusão), o que mistura operações de frequência diferente.
4. **Geração automática separada da rotina diária**, apesar de ser um processo de manutenção de base.
5. **Regra de alerta e status distribuída em várias funções**, dificultando explicar “por que isso está crítico?” em linguagem direta para o operador.

---

## Proposta de simplificação (modelo de gestão em 2 camadas)

## 1) Camada Operacional (padrão)
Objetivo: resolver o dia a dia em poucos cliques.

### Visão padrão por “Fila de ação”
Trocar a abertura padrão da página para 3 filas prontas:
- **Críticos (vence em até 90 dias ou vencido)**
- **Sem previsão de gozo**
- **Com pendência de ajuste cadastral** (inconsistência de datas/status)

Cada linha deve exibir apenas:
- Militar,
- Referência,
- Dias para vencimento,
- Status resumido,
- **Ação primária única** (ex.: “Programar férias” ou “Ajustar período”).

### Redução de escolhas iniciais
- Manter busca global.
- Esconder filtros avançados por padrão em um botão “Mais filtros”.
- Exibir contadores por fila (comportamento de inbox).

---

## 2) Camada Administrativa (avançada)
Objetivo: preservar poder de gestão sem poluir a rotina.

- Manter o modelo atual de cartões, modal completo e ajustes finos.
- Acesso via botão **“Abrir gestão avançada”**.
- Permitir operações destrutivas apenas nessa camada.

---

## Regras de negócio simplificadas para o usuário (sem perder consistência)

## Regra A — Status derivado automaticamente
Status operacional deve ser **calculado** (saldo + previsão + vencimento), e não escolhido manualmente na rotina padrão.

## Regra B — Ações guiadas por contexto
Ao invés de “alterar status”, o sistema deve oferecer ação contextual:
- sem previsão válida → “Programar gozo”
- vencido → “Justificar e regularizar”
- saldo zerado → “Concluir período”

## Regra C — Exclusão vira exceção administrativa
No fluxo padrão, nunca mostrar “Excluir”. Apenas “Inativar” (quando aplicável) e com justificativa.

---

## Plano de implementação sugerido

## Fase 1 (rápida, baixo risco)
1. Criar visão padrão por filas (Crítico / Atenção / Em dia com pendência).
2. Ocultar filtros avançados por padrão.
3. Substituir card detalhado por item compacto na visão padrão.
4. Adicionar texto explicativo de “motivo do alerta” em linguagem simples.

## Fase 2 (estrutural)
1. Separar `Gestão Operacional` e `Gestão Administrativa` em componentes/páginas distintas.
2. Transformar atualização de status em consequência de ação (não campo livre).
3. Introduzir trilha de auditoria para ações críticas (inativação/ajustes retroativos).

## Fase 3 (automação)
1. Rodar geração/reconciliação automática diária.
2. Exibir apenas exceções para intervenção humana.
3. Notificar comando/chefia por severidade e prazo.

---

## Indicadores de sucesso da simplificação

- Redução de tempo médio para resolver uma pendência.
- Redução de cliques até “programar férias” para um período crítico.
- Queda de erros de edição manual de status.
- Aumento de períodos regularizados antes do vencimento.

---

## Conclusão
A simplificação recomendada não remove capacidade do sistema; ela **separa rotina de exceção**.

Em resumo:
- operação diária com fila e ação única,
- gestão avançada para casos complexos,
- status mais automático e menos manual.

Esse desenho reduz treinamento necessário, acelera resposta operacional e mantém governança.

---

## Impacto no módulo de Créditos Extraordinários

A simplificação da gestão de períodos aquisitivos impacta diretamente o módulo de créditos extraordinários em 4 frentes:

1. **Priorização operacional**
   - Na visão por fila (críticos/sem previsão), os créditos passam a ser usados como mecanismo de regularização rápida de saídas de férias.
   - Resultado esperado: aumento de uso de créditos em casos próximos do vencimento concessivo.

2. **Integração orientada por ação**
   - A ação “Programar gozo” deve abrir o fluxo já com seleção de créditos elegíveis do militar.
   - Isso evita troca de tela e reduz erro de vinculação manual.

3. **Governança de status dos créditos**
   - Como o status do período ficará mais automático, o controle humano precisa se concentrar no ciclo do crédito (`DISPONIVEL` → `USADO`/`CANCELADO`) e no vínculo com o gozo.
   - A trilha de auditoria deve registrar quem vinculou, quando, e em qual evento de saída.

4. **Indicadores cruzados para gestão**
   - Criar métricas combinadas: “períodos críticos regularizados com crédito”, “créditos disponíveis por unidade” e “dias extras concedidos por tipo de crédito”.
   - Essas métricas ajudam a antecipar pressão de vencimento e padronizar decisões administrativas.

### Ajustes recomendados no desenho funcional

- Exibir, na fila operacional, um resumo curto de créditos disponíveis por militar (ex.: `+3d disponíveis`).
- No fluxo de saída de férias, manter validações atuais (pertencimento, cancelamento, uso prévio), mas com mensagens mais diretas no contexto da pendência.
- Padronizar política de desvinculação: quando gozo for cancelado/interrompido com reversão, retornar crédito para `DISPONIVEL` automaticamente quando aplicável.
- Evitar criação/edição de crédito a partir da tela de período; manter cadastro de crédito em módulo próprio e apenas consumo no fluxo operacional.

Em síntese, a simplificação dos períodos tende a **aumentar a importância do módulo de Créditos Extraordinários como alavanca de regularização**, exigindo mais integração contextual e melhores indicadores de acompanhamento.
