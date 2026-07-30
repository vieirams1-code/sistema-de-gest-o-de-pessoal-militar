# Auditoria de Oportunidades de Automação

Esta auditoria identifica fluxos repetitivos e manuais no sistema que possuem alto potencial de automação, visando reduzir a carga operacional e minimizar erros humanos.

## 1. Geração Automática de Publicações

Atualmente, muitos atos administrativos exigem que o usuário navegue até o módulo de Publicações após realizar um cadastro.

*   **Atestados Médicos:**
    *   *Oportunidade:* Para atestados ≤ 15 dias com fluxo "Comandante", gerar automaticamente a minuta de publicação *Ex Officio* ao salvar o atestado.
    *   *Ganhos:* Elimina o retrabalho de preencher novamente os dados do militar e do afastamento no módulo de publicações.
*   **Punições Disciplinares:**
    *   *Oportunidade:* Ao registrar uma punição em `CadastrarPunicao.jsx`, oferecer a opção de gerar automaticamente o extrato para publicação em Boletim Geral.
*   **Férias (Interrupção e Retorno):**
    *   *Oportunidade:* Eventos de interrupção ou retorno antecipado registrados no módulo de Férias deveriam gerar minutas de publicação automaticamente.
*   **Gratificação de Função:**
    *   *Oportunidade:* A confirmação da nomeação ou dispensa pelo DP poderia disparar a criação automática da publicação correspondente, vinculando o ID do processo.

## 2. Sincronização Automática com Histórico (Livro)

Vários módulos dependem da "Folha de Alterações" (Registro de Livro) para compor a ficha do militar.

*   **Pós-Conciliação de Boletim:**
    *   *Oportunidade:* Ao confirmar a conciliação em `ConciliacaoBoletim.jsx`, o sistema deve garantir que o evento (Atestado, Promoção, Medalha) seja inserido automaticamente no histórico do militar com o número do BG correspondente.
    *   *Ganhos:* Garante integridade absoluta entre o que foi publicado e o que consta na ficha do militar.
*   **Promoções Efetivadas:**
    *   *Oportunidade:* Ao mudar o status de uma promoção para "Publicada", gerar o registro histórico de alteração de grau hierárquico automaticamente.

## 3. Inteligência em Pendências e Alertas

Expandir a `Central de Pendências` para atuar proativamente sobre inconsistências.

*   **Alertas de Comportamento:**
    *   *Oportunidade:* Notificar 30 dias antes de um militar completar o interstício para melhoria de comportamento (ex: de "Bom" para "Ótimo"), permitindo que a seção de pessoal prepare a avaliação.
*   **Recorrência de Atestados:**
    *   *Oportunidade:* Criar pendência automática de "Acompanhamento Especial" para militares que apresentem mais de X dias de atestado no mesmo semestre ou CID recorrente.
*   **Cadeia de Promoções:**
    *   *Oportunidade:* Detectar automaticamente "buracos" na antiguidade quando uma promoção é registrada fora de ordem ou quando um militar é esquecido em uma turma de mesma data.

## 4. Preenchimento Automático de Documentos (Templates)

Aproveitar o motor de templates (`documentoMilitarTemplateService.js`) para automatizar a burocracia documental.

*   **Encaminhamento JISO:**
    *   *Oportunidade:* Gerar automaticamente o ofício de encaminhamento para a Junta de Inspeção de Saúde ao salvar um atestado que necessite de homologação.
*   **Certificados de Medalha:**
    *   *Oportunidade:* Geração em lote de diplomas de medalhas de tempo de serviço a partir da tela de `ApuracaoMedalhasTempoServico.jsx`.
*   **Folha de Alterações Consolidada:**
    *   *Oportunidade:* Automação da montagem do PDF da Folha de Alterações, consolidando dados de comportamento, punições, férias e elogios em um único documento formatado.

## 5. Processamento em Lote (Bulk Operations)

Expandir a capacidade de ações em massa para evitar cliques individuais exaustivos.

*   **Aprovação de Medalhas:**
    *   *Oportunidade:* Permitir a indicação e concessão em lote na tela de Apuração de Medalhas, em vez de exigir cliques individuais por militar/faixa.
*   **Finalização de Gratificações:**
    *   *Oportunidade:* Implementar a dispensa em lote de gratificações para casos de reestruturação de unidades ou trocas de comando.

---
**Resultado Esperado:** Redução estimada de 40% no tempo gasto em tarefas burocráticas e garantia de 100% de sincronia entre os registros operacionais e os históricos.
