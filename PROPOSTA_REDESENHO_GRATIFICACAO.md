# Proposta de Redesenho Simplificado: Gratificação de Função

## 1. Veredito
**Simplificar.** O fluxo atual de 8 status, embora completo, adiciona fricção desnecessária para a realidade operacional do usuário, que busca um modelo de "registrar e acompanhar" similar ao de Contratos de Designação. A simplificação reduz a carga cognitiva e o tempo de treinamento, mantendo a integridade dos dados e o controle de cotas.

## 2. O que reaproveitar
- **Schemas:** A entidade `GratificacaoFuncao` já possui todos os campos necessários (snapshots de militar, dados de publicação, referências a tipos/cotas).
- **Cloud Functions:** As funções `getScopedPainelGratificacoesFuncao` e `getScopedCotasGratificacaoFuncao` permanecem como a espinha dorsal de leitura escopada.
- **Validações:** A lógica de verificação de disponibilidade de cotas e snapshots do militar em `gerirRascunhoGratificacaoFuncao` deve ser mantida.
- **Permissões:** Os sentinelas `gerir_gratificacoes_funcao` e `gerir_cotas_gratificacao_funcao` continuam válidos.

## 3. O que esconder/despriorizar na UI
- **Abas intermediárias:** Remover as abas "Rascunhos", "Aguardando Publicação" e "Dispensa em Andamento".
- **Fluxo de Envio:** Ocultar botões de "Enviar à DP" e transições manuais para status intermediários.
- **Modais fragmentados:** Eliminar os modais específicos de "Enviar DP" e "Registrar Publicação" em favor de um modal único.

## 4. Novo Fluxo Proposto

### Criação (Registro Direto)
1. Usuário clica em "Nova Gratificação".
2. Preenche os dados do militar e escolhe a cota (validação de disponibilidade em tempo real).
3. **Novidade:** O modal já exige os dados de publicação (Data DOEMS, Número, Início dos Efeitos).
4. Ao salvar, o registro é criado diretamente com status `nomeado_ativo`.
5. A cota é ocupada imediatamente.

### Finalização (Dispensa)
1. Na lista de "Ativas", o usuário seleciona a ação "Finalizar/Dispensar".
2. Um modal simplificado solicita a Data Fim dos Efeitos e os dados do ato de dispensa.
3. O status transita de `nomeado_ativo` para `dispensado`.
4. A cota é liberada automaticamente (cálculo de ocupação baseado apenas em `nomeado_ativo`).

## 5. Novo Desenho de Tela
- **Ativas (Tab Principal):** Lista clara com militares, funções e datas de efeitos. Similar à visualização de Contratos.
- **Histórico (Tab Secundária):** Registros com status `dispensado` ou `cancelado`.
- **Configurações (Área Secundária):** Gerenciamento de Tipos e Cotas (reaproveitando as tabelas existentes).
- **Pendências (Tab Temporária):** Exclusiva para visualização e resolução de registros que ficaram "presos" nos status antigos.

## 6. Tratamento de Registros Existentes
- Registros em `rascunho`, `solicitado_dp` ou `aguardando_publicacao_nomeacao` serão exibidos em uma aba especial de **"Pendências"**.
- Ações permitidas nas Pendências: "Completar Registro" (leva ao novo fluxo de ativação) ou "Cancelar".
- Uma vez processados, seguem o novo fluxo (Ativo ou Histórico).

## 7. Riscos da Simplificação
- **Perda de Rastreabilidade Processual:** O sistema não registrará formalmente o tempo em que o processo ficou "aguardando publicação" (embora esses dados raramente sejam usados para fins de pagamento).
- **Exigência de Dados Imediata:** O usuário não poderá "salvar para depois" sem os dados da publicação. *Mitigação: Manter a possibilidade de salvar como rascunho apenas localmente ou em uma área de rascunhos muito discreta.*

## 8. Plano de Implementação por Lotes

### Lote 1: Backend (Core)
- Atualizar `gerirRascunhoGratificacaoFuncao` para aceitar a operação `registrar_gratificacao_direta`.
- Implementar `finalizar_gratificacao` com as validações de data de término.

### Lote 2: UI - Visualização e Navegação
- Refatorar as abas em `GratificacoesFuncao.jsx`.
- Implementar a lógica de filtragem para a aba de Pendências.

### Lote 3: UI - Ações e Modais
- Unificar o `GratificacaoModal` com campos de publicação.
- Criar o `FinalizarGratificacaoModal`.

### Lote 4: Limpeza e Polimento
- Remover códigos mortos de transições de status antigas.
- Atualizar documentação e tooltips de ajuda.
