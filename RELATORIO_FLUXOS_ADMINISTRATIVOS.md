# Relatório de Diagnóstico: Fluxos Administrativos SGP Militar

## Objetivo
Identificar fluxos operacionais com excesso de cliques, etapas redundantes e complexidade desnecessária para fins de futura simplificação UX.

## Critérios de Avaliação
- **Telas**: Quantidade de navegações entre URLs diferentes.
- **Modais**: Quantidade de janelas sobrepostas para conclusão de etapas.
- **Abas**: Quantidade de subdivisões dentro de uma mesma tela.
- **Confirmações**: Diálogos de alerta ou confirmação antes da persistência.
- **Passos**: Sequência lógica total até a finalização do registro.

---

## Mapeamento por Módulo

### 1. Férias
O módulo de Férias apresenta um ciclo de vida longo com forte dependência do rastro documental (Livro).
- **Registrar**: Requer navegação para tela específica, seleção de militar e período, além de escolha de fracionamento. (1 tela, ~6 cliques).
- **Operacionalizar (Início/Término)**: Feito via Dropdown na listagem principal que abre o `RegistroLivroModal`. Exige preenchimento de datas e dados de BG para cada perna operacional. (1 modal por etapa, ~4 cliques cada).
- **Interromper/Retomar**: Segue o mesmo padrão de modal, aumentando a profundidade da "família" de registros.
- **Consultar Histórico**: Disponível via painel lateral "Rastro da Família", que centraliza a cadeia mas não permite edições rápidas sem o "Modo Admin".

### 2. Atestados
O fluxo de Atestados é linear no cadastro, mas fragmentado na homologação.
- **Registrar**: Tela de cadastro robusta com seletor de CRM/CID. (1 tela, ~10 campos).
- **Acompanhar**: Listagem com cartões categorizados (Vigentes/Encerrados).
- **Homologar**: Se >15 dias, exige trâmite externo (JISO) que não é concluído na mesma tela, gerando uma quebra de fluxo.
- **Finalizar**: Automático por data ou via status manual, mas a exclusão é bloqueada se houver publicação vinculada, exigindo navegação para o módulo de Publicações para desfazer o vínculo antes.

### 3. Gratificações de Função
Fluxo com forte dependência de modais sequenciais e estados intermediários.
- **Registrar**: Começa como rascunho. Requer modal dedicado para cada transição (Enviar DP -> Aguardando Publicação -> Registrar Publicação). Cada passo exige preenchimento de campos similares (data, documento).
- **Acompanhar**: Abas "Ativas" e "Histórico" separam bem os estados, mas a ação de "Finalizar" é outro modal com ~8 campos obrigatórios.
- **Excluir**: Exige digitação de string de confirmação "EXCLUIR GRATIFICAÇÃO" no Modo Admin, um fluxo de 3 cliques + digitação.

### 4. Publicações e Registro em Livro (RP/Livro)
Fluxo centralizado no `CadastrarRegistroRP` que funciona como um "Wizard" de 4 passos.
- **Wizard de Cadastro**: (1) Tipo -> (2) Militar -> (3) Dados do Registro -> (4) Texto/BG.
- **Redundância**: O módulo de RP espelha o de Publicações, criando confusão mental sobre qual usar (ambos acessam as mesmas entidades `RegistroLivro` e `PublicacaoExOfficio`).
- **Conciliação de Boletim**: Tela complexa que exige Upload de PDF + "Etapa 1: Ler" + "Etapa 2: Conciliar" + Vínculo Manual individual por item, gerando uma carga cognitiva e de cliques elevadíssima para lotes grandes.

### 5. Promoções e Antiguidade
Gerenciamento de turmas com alta dependência de ordenação manual.
- **Registrar Turma**: Cria-se a promoção (1 tela), depois abre-se o Detalhe para adicionar militares um a um ou via busca (múltiplos cliques).
- **Ordenação**: Requer acionamento manual do botão "Ordenar" (via Antiguidade Anterior ou Lista Atual). O sistema não mantém a ordem "viva" automaticamente durante adições.
- **Publicar**: Ação definitiva que exige que todos os campos do rascunho estejam perfeitos; qualquer erro exige reabertura via admin (reversão), um fluxo punitivo em cliques.

### 6. Efetivo e Quadro Operacional
Foco em visualização e ações em lote (bulk).
- **Gestão de Tags/Funções**: O fluxo "Bulk" em Militares é eficiente (barra de seleção), mas o seletor de colunas é um modal denso com dezenas de checkboxes, dificultando a personalização rápida da visualização.
- **Quadro Operacional (Trello)**: Exige cliques individuais para abrir detalhes de cada card. A movimentação entre colunas gera comentários automáticos, mas a criação de novos cards exige o preenchimento de modais com seletor de militar, título e preset de checklist.
- **Ficha 360 (VerMilitar)**: Embora consolide dados, a navegação entre as ~9 abas (Comportamento, Dados, Férias, etc.) para consultar detalhes exige cliques repetitivos e recarregamento de contexto visual.

---

## Ranking dos 20 Fluxos Mais Complexos

| Pos | Fluxo | Problema Identificado | Impacto Operacional | Simplificação Sugerida |
|:---:|:---|:---|:---|:---|
| 1 | **Conciliação de Boletim** | Exige Upload + Ler + Conciliar + Vínculo Manual. | Lento para grandes volumes de BG. | Auto-vínculo mais agressivo e UI de drag-drop. |
| 2 | **Ciclo de Nomeação de Gratificação** | 3 modais sequenciais e 4 transições de status. | Excesso de interrupções e cliques. | Fluxo em linha (inline) ou Wizard de passo único. |
| 3 | **Wizard de Cadastro RP** | 4 passos obrigatórios para qualquer tipo de registro. | Cansaço do usuário em tarefas simples. | Modo "Express" para tipos comuns. |
| 4 | **Início de Férias (Operacional)** | Modal `RegistroLivroModal` com dados redundantes. | Atrasa a liberação diária de militares. | Botão de "Início Rápido" na listagem. |
| 5 | **Adição de Turma em Promoção** | Adição individual de militares via modal de busca. | Inviável para turmas com +50 militares. | Importação via planilha ou seleção múltipla. |
| 6 | **Ordenação de Turma** | Ordenação manual via botão em vez de automática. | Risco de erro na classificação oficial. | Ordenação viva (real-time) conforme adição. |
| 7 | **Finalização de Gratificação** | Modal denso com ~8 campos para uma dispensa. | Burocracia excessiva no encerramento. | Simplificar para Data + Motivo, PDF opcional. |
| 8 | **Reversão de Promoção** | Exige digitação de frase e motivo (fluxo admin). | Punitivo para correções rápidas. | Confirmação simples por senha ou biometria. |
| 9 | **Homologação de Atestados** | Fragmentação entre cadastro e envio para JISO. | Militar fica em "limbo" administrativo. | Automação de envio baseada na duração do dias. |
| 10 | **Gestão de Colunas (Efetivo)** | Modal de checkboxes enorme sem filtro/busca. | Dificulta a personalização da consulta. | Seletor com busca e presets (RH, Saúde, etc). |
| 11 | **Interrupção de Férias** | Cálculo manual de saldo e gozo dentro do modal. | Alta probabilidade de erro de contagem. | Calculadora automática em tempo real no modal. |
| 12 | **Vínculo de Dias Adicionais** | Exige seleção manual de créditos no Início. | Esquecimento gera erro no saldo final. | Auto-sugestão de uso de créditos disponíveis. |
| 13 | **Exclusão de Gratificação** | Fluxo de segurança exagerado (frase manual). | Bloqueia a agilidade do administrador. | Substituir por confirmação padrão de sistema. |
| 14 | **Criação de Cards no Quadro** | Modal lento com seletor de militar e presets. | Desestimula o uso do Trello operacional. | Atalho de criação rápida (só título/militar). |
| 15 | **Navegação na Ficha 360** | ~9 abas para dados que poderiam estar em grid. | Excesso de cliques para ver perfil completo. | Layout Dashboard (uma tela, vários widgets). |
| 16 | **Cadastro de Nova Matrícula** | Escondido em "Ação Administrativa" na Edição. | Difícil descoberta por novos usuários. | Promover a "Nova Matrícula" na barra lateral. |
| 17 | **Solicitação de Correção** | Exige navegação profunda até a ficha do militar. | Reduz a qualidade do dado cadastral. | Atalho "Reportar Erro" em todas as tabelas. |
| 18 | **Término de Férias** | Exige modal e confirmação de retorno manual. | Gera atraso no status de prontidão. | Término automático com confirmação opcional. |
| 19 | **Geração de Documento** | Seleção -> Template -> Preview -> PDF. | Lento para demandas repetitivas. | Botão "Gerar Padrão" direto na linha da tabela. |
| 20 | **Histórico de Comportamento** | Scroll longo e troca de abas para ver evolução. | Dificulta a análise de justiça/disciplina. | Integrar gráfico e timeline na visão principal. |
