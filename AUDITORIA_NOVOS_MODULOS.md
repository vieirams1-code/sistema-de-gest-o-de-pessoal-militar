# Auditoria de Novos Módulos - Visão Product Manager Militar

Esta auditoria identifica oportunidades de expansão do ecossistema, indo além da gestão de pessoal e entrando na esfera operacional e logística, visando transformar o sistema em um ERP Militar completo.

## 1. Módulos que ainda não existem (Gaps Estratégicos)

### A. Gestão de Procedimentos (IPM / Sindicância / ISO / PAD)
* **Situação Atual:** Existem entidades de backend (`ProcedimentoProcesso`, `ProcedimentoEnvolvido`, `ProcedimentoPendencia`, `ProcedimentoPrazoHistorico`) e constantes em `src/utils/procedimentos/procedimentosConstants.js` (incluindo Inquérito Técnico e Suprimento de Fundos), mas não há interface de usuário implementada.
* **Funcionalidades Necessárias:** Lançamento de portarias, controle automatizado de prazos (30/40/60 dias), alertas de vencimento na Home, histórico de prorrogações e fluxo de arquivamento.
* **Valor:** Garantir o cumprimento dos prazos legais e centralizar a "folha corrida" disciplinar/administrativa.

### B. Gestão de Escalas de Serviço
* **Situação Atual:** Inexistente.
* **Funcionalidades Necessárias:** Gerador de escalas (ordinárias e extraordinárias), controle de interstício (descanso obrigatório), trocas de serviço digitais e integração com Férias/Atestados para impedir escalação indevida.
* **Valor:** Redução drástica de erros manuais e aumento da percepção de justiça na tropa.

### C. Gestão de Cursos e Certificações
* **Situação Atual:** Registros esparsos no Livro/RP e campo de habilidades no Militar, sem estrutura de validade ou gestão de certificados.
* **Funcionalidades Necessárias:** Cadastro de cursos operacionais (CMAUT, Tiro, Mergulho), controle de validade (reciclagem) e mapeamento de requisitos para promoções.
* **Valor:** Prontidão operacional garantida por pessoal devidamente habilitado.

### D. Logística de Carga e EPI (Institutional Equipment)
* **Situação Atual:** Módulo de Armamentos foca apenas em armas particulares.
* **Funcionalidades Necessárias:** Gestão de inventário da unidade, controle de cautelas (entrega/devolução de material para serviço) e rastreamento de EPIs (coletes, capacetes) com data de validade.
* **Valor:** Controle patrimonial e segurança do militar em serviço.

### E. Gestão de Frota e Viaturas
* **Situação Atual:** Entidade `ProcedimentoViatura` existe, mas não há gestão de frota.
* **Funcionalidades Necessárias:** Prontuário da viatura, controle de manutenção (preventiva/corretiva), controle de quilometragem/combustível e vínculo com motoristas habilitados (CNH).
* **Valor:** Disponibilidade de meios de transporte e economia de recursos.

## 2. Oportunidades de Expansão

* **Banco de Talentos:** Cruzamento de `habilidades` + `cursos` + `formação acadêmica` para busca rápida de perfis em situações de crise ou preenchimento de funções técnicas.
* **Saúde e TAF:** Expansão do módulo de Atestados para incluir resultados de Testes de Aptidão Física (TAF) e exames periódicos, gerando um índice de aptidão operacional.
* **Inspeções e Visitas:** Módulo para registro de inspeções em quartéis, depósitos e viaturas, com geração de relatórios de conformidade.

## 3. Integrações entre Módulos

* **Rastreador de Prontidão (Home):** Painel que cruza Efetivo + Escalas + Atestados + Cursos para dizer, em tempo real: "Quantos militares temos aptos para a missão X agora?".
* **Justiça + Promoções:** Bloqueio automático de promoções para militares com procedimentos de IPM/PAD ativos (além das punições já registradas).
* **Escalas + Logística:** Ao escalar um militar para motorista, o sistema já verifica se a CNH está válida e se a viatura designada está com a manutenção em dia.
* **Publicações + Assinatura Digital:** Integração das notas de BG (Boletim Geral) com fluxo de assinatura digital para portarias e despachos.

---
**Resultado da Auditoria:** O sistema possui uma excelente base de dados de pessoal. O próximo salto evolutivo deve focar em **Operações (Escalas/Cursos)** e **Recursos (Logística/Viaturas)**.
