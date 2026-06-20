# Ranking de Módulos Sensíveis — SGP Militar (P1.5-A)

Este relatório apresenta o mapeamento de risco, maturidade e necessidade de granularização dos módulos sensíveis do SGP Militar, visando orientar as próximas fases de endurecimento (hardening) de segurança.

---

## Metodologia de Classificação

- **Prioridade/Risco**: Avalia o impacto de vazamento de dados, manipulação indevida de registros e reflexos jurídicos/financeiros.
- **Grau de Maturidade**:
    - **Alta**: Possui action keys granulares para fluxos específicos (ex: publicar, conceder, gerir cotas).
    - **Média**: Baseado em permissões de CRUD (Criar, Ler, Atualizar, Deletar) de módulo.
    - **Baixa**: Inheritance de outros módulos ou em estágio conceitual/MVP.

---

## 1. Publicações / RP (Registro de Publicações)
- **Permissões existentes**: `acesso_publicacoes`, `acesso_rp`, `perm_visualizar_publicacoes`, `perm_editar_publicacoes`, `perm_adicionar_publicacoes`, `perm_excluir_publicacoes`, `perm_publicar_bg`, `perm_tornar_sem_efeito_publicacao`, `perm_apostilar_publicacao`, `perm_publicar_ata_jiso`, `perm_publicar_homologacao`.
- **Operações sensíveis**: Efetivação de atos em Boletim Geral (BG), anulação de atos (sem efeito), apostilamento e publicação de decisões de saúde (JISO).
- **Dados sensíveis**: Atos administrativos que alteram a vida funcional e financeira; Pareceres médicos de JISO.
- **Grau de maturidade**: **Alta**.
- **Prioridade**: **Crítico**.
- **Justificativa**: É o módulo que garante a fé pública dos atos. Uma falha aqui permite alterar o status jurídico de qualquer militar no sistema.

## 2. Punições (Justiça e Disciplina)
- **Permissões existentes**: `acesso_punicoes`, `perm_visualizar_punicoes`, `perm_adicionar_punicoes`, `perm_editar_punicoes`, `perm_excluir_punicoes`.
- **Operações sensíveis**: Registro de sanções disciplinares (repreensão, detenção, prisão), alteração de datas de punição (afeta comportamento).
- **Dados sensíveis**: Histórico disciplinar desfavorável, descritivos de transgressões.
- **Grau de maturidade**: **Média**.
- **Prioridade**: **Crítico**.
- **Justificativa**: Impacto direto no comportamento (Excepcional/Mau) e, consequentemente, na promoção e antiguidade. Alto risco de judicialização por falta de fluxo de homologação granular.

## 3. Portal Militar (Autoatendimento)
- **Permissões existentes**: Mapeadas no MVP (`acesso_portal_militar`, `perm_visualizar_propria_ficha`, `perm_solicitar_atualizacao_cadastral`, `perm_gerar_documento_militar`).
- **Operações sensíveis**: Acesso a dados PII via Internet/Intranet, auto-emissão de certidões, solicitações de atualização.
- **Dados sensíveis**: Dados biográficos, residenciais e funcionais completos (PII).
- **Grau de maturidade**: **Baixa** (Módulo em definição/MVP).
- **Prioridade**: **Crítico**.
- **Justificativa**: Representa a maior expansão de superfície de ataque do sistema. O risco de "IDOR" (um militar acessar dados de outro mudando o ID na URL) exige validação rigorosa de escopo `proprio`.

## 4. Gratificação de Função (Financeiro)
- **Permissões existentes**: `acesso_gratificacoes_funcao`, `perm_visualizar_gratificacoes_funcao`, `perm_gerir_gratificacoes_funcao`, `perm_gerir_cotas_gratificacao_funcao`.
- **Operações sensíveis**: Nomeação/Exoneração de funções gratificadas, gestão de limites (cotas) financeiros por unidade.
- **Dados sensíveis**: Vínculos financeiros, histórico de remuneração extra-soldo.
- **Grau de maturidade**: **Alta**.
- **Prioridade**: **Alto**.
- **Justificativa**: Impacto financeiro direto e imediato. Requer segregação entre quem opera a gratificação e quem define as cotas.

## 5. Contratos Designados (Inativos)
- **Permissões existentes**: `perm_visualizar_contratos_designacao`, `perm_criar_contrato_designacao`, `perm_encerrar_contrato_designacao`, `perm_cancelar_contrato_designacao`, `perm_excluir_contrato_designacao`, `perm_editar_metadados_contrato_designacao`, `perm_gerir_contratos_designacao`.
- **Operações sensíveis**: Reativação de militares inativos para serviço, gestão de prazos e metadados de pagamento.
- **Dados sensíveis**: Dados de inativos, períodos de vigência, status de contrato.
- **Grau de maturidade**: **Alta**.
- **Prioridade**: **Alto**.
- **Justificativa**: Erros ou fraudes aqui geram pagamentos indevidos a pessoal inativo e passivos trabalhistas.

## 6. Registro em Livro (Staging de Publicações)
- **Permissões existentes**: `acesso_livro`, `perm_visualizar_livro`, `perm_adicionar_livro`, `perm_editar_livro`, `perm_excluir_livro`.
- **Operações sensíveis**: Lançamento de fatos funcionais brutos (cursos, férias, licenças) antes da formalização.
- **Dados sensíveis**: Descrições de fatos administrativos, datas e militares citados.
- **Grau de maturidade**: **Média**.
- **Prioridade**: **Alto**.
- **Justificativa**: Embora pareça operacional, é a fonte primária para o módulo de Publicações. Inserções maliciosas aqui "sujam" o fluxo que vai para o Boletim.

## 7. Medalhas (Mérito)
- **Permissões existentes**: `acesso_medalhas`, `perm_visualizar_medalhas`, `perm_adicionar_medalhas`, `perm_editar_medalhas`, `perm_excluir_medalhas`, `perm_indicar_medalhas`, `perm_conceder_medalhas`, `perm_resetar_indicacoes_medalhas`, `perm_gerir_impedimentos_medalha`, `perm_gerir_dom_pedro_ii`, `perm_exportar_medalhas`.
- **Operações sensíveis**: Concessão de medalhas, bloqueio por impedimentos disciplinares, indicações políticas/institucionais.
- **Dados sensíveis**: Mérito militar, histórico de impedimentos.
- **Grau de maturidade**: **Alta**.
- **Prioridade**: **Médio**.
- **Justificativa**: Módulo bem protegido com ações granulares. O risco é reputacional e de currículo, com menor potencial de dano financeiro direto comparado aos anteriores.

## 8. Banco de Talentos (Estratégico)
- **Permissões existentes**: Não possui chaves exclusivas; herda de `acesso_militares` e `gerir_configuracoes` (tags).
- **Operações sensíveis**: Busca massiva por competências técnicas (especialistas, mergulhadores, instrutores).
- **Dados sensíveis**: Mapeamento de expertises da tropa.
- **Grau de maturidade**: **Baixa**.
- **Prioridade**: **Médio**.
- **Justificativa**: Módulo estratégico para mobilização. O risco principal é a exfiltração de dados sobre capacidades específicas da instituição para fins externos.

---

## Ranking Consolidado por Risco

1. **Publicações / RP** (Crítico - Fé Pública)
2. **Punições** (Crítico - Direitos e Comportamento)
3. **Portal Militar** (Crítico - Superfície PII)
4. **Gratificação de Função** (Alto - Financeiro)
5. **Contratos Designados** (Alto - Legal/Previdenciário)
6. **Registro em Livro** (Alto - Integridade de Dados)
7. **Medalhas** (Médio - Reputacional/Currículo)
8. **Banco de Talentos** (Médio - Estratégico)

---
*Relatório gerado em atendimento à tarefa P1.5-A.*
