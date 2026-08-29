# Auditoria de Governança e Segurança Operacional

Este documento apresenta o resultado da auditoria realizada para identificar locais onde usuários podem causar inconsistências no sistema, falhas de integridade de dados ou falta de rastreabilidade.

## 1. Ranking de Riscos

| Risco | Nível | Localização Principal | Descrição | Impacto |
| :--- | :---: | :--- | :--- | :--- |
| **Escrita Direta em Militar** | 🔴 Crítico | `SolicitacoesAtualizacao.jsx` | Execução de `base44.entities.Militar.update` diretamente no frontend ao aprovar solicitações. | Alteração de dados cadastrais sensíveis sem validação centralizada no backend ou registro de auditoria imutável. |
| **Exclusão de Estrutura** | 🟠 Alto | `Configuracoes.jsx` | Permite exclusão direta (`delete`) de `Lotacao` e `Funcao` via frontend. | Risco de deixar registros órfãos (militares vinculados a lotações inexistentes) e perda de integridade referencial. |
| **Gestão de Promoções** | 🟠 Alto | `Promocoes.jsx`, `DetalhePromocao.jsx` | Manipulação direta de `Promocao` e `PromocaoMilitar` via CUD no frontend. | Inconsistências na cadeia de antiguidade e no Histórico V2 em caso de falhas parciais ou desvio de regras de negócio. |
| **Templates de Texto** | 🟡 Médio | `TemplatesTexto.jsx` | CUD direto de templates que regem a fé pública dos documentos gerados. | Alterações não auditadas em templates podem mudar indevidamente o teor de atos oficiais publicados. |
| **Quadro Operacional** | 🟡 Médio | `QuadroOperacional.jsx` | Gerenciamento de colunas e cards (JISO, Punições) via frontend. | Possibilidade de reordenar ou mover cards sensíveis sem um log de auditoria robusto e centralizado. |
| **Exclusões sem Proteção** | 🟡 Médio | Diversas páginas | Uso generalizado de `.delete()` físico em vez de marcação lógica (`Soft Delete`). | Perda definitiva de dados e impossibilidade de rastreio histórico de exclusões acidentais. |

---

## 2. Pontos de Atenção Específicos

### 2.1 CUD Perigosos (Frontend-side)
Muitas páginas executam operações de criação, atualização e deleção diretamente nas entidades via SDK no navegador. Isso ignora o princípio de "Backend as the source of truth" para regras de negócio complexas.
- **Exemplo Crítico:** `SolicitacoesAtualizacao.jsx:67` atualiza o cadastro militar diretamente após aprovação manual.

### 2.2 Ausência de Auditoria e Logs
Embora algumas funções (como as de Medalhas) incluam um helper `adicionarAuditoriaMedalha`, a maioria das operações de escrita não registra o usuário executor (`userEmail`) de forma consistente no payload enviado ao banco de dados.

### 2.3 Alterações sem Confirmação ou Histórico
- **Configurações:** A criação de lotações e funções ocorre sem confirmação adicional.
- **Quadro Operacional:** A movimentação de cards gera um comentário automático, mas a alteração da estrutura de colunas não possui histórico de quem a modificou.

---

## 3. Lista de Melhorias de Governança (Roadmap)

### Curto Prazo (Correções Críticas)
1. **Migração para Funções de Backend:** Transformar a aprovação de `SolicitacaoAtualizacao` em uma chamada de função (`base44.functions.invoke`), movendo a lógica de `Militar.update` para um ambiente controlado (Deno).
2. **Expansão do `cudEscopado`:** Migrar as chamadas de `TemplateTexto`, `Lotacao` e `Funcao` para o cliente `cudEscopadoClient.js`, garantindo validação de escopo mínima no backend.

### Médio Prazo (Padronização)
1. **Soft Delete Nativo:** Implementar o campo `ativa: boolean` ou `deleted_at` em todas as entidades estruturais, substituindo o método `.delete()` por `.update({ ativa: false })`.
2. **Interceptores de Auditoria:** Configurar o `base44Client.js` para incluir automaticamente metadados de auditoria (`updated_by`, `updated_at`) em todos os payloads de escrita se o usuário estiver autenticado.

### Longo Prazo (Arquitetura)
1. **Immutable Logs:** Implementar uma tabela de `AuditLog` no backend que registre cada operação de CUD bem-sucedida, capturando o estado anterior e posterior do registro (Diff).
2. **UI de Confirmação:** Substituir todos os `window.confirm` nativos por componentes `AlertDialog` padronizados, garantindo que o usuário compreenda o impacto sistêmico de suas ações (ex: exclusão de uma função usada por 50 militares).

---
*Relatório gerado por Jules em auditoria de Governança e Segurança Operacional.*
