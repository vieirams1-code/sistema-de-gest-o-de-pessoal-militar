# Relatório de Auditoria P1.4-C.2 — Escopo e Segregação de Dados Médicos

Este documento apresenta os resultados da auditoria de escopo e segregação de dados realizada nos módulos de **Atestados** e **JISO**.

## 1. Mapeamento de Queries e Escopo

| Arquivo | Query / Operação | Escopo Aplicado | Escopo Esperado | Risco | Correção Sugerida |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/pages/VerAtestado.jsx` | `base44.entities.Atestado.filter({ id })` | **Nenhum** (Busca direta por ID via SDK) | Escopo Organizacional (Militar Alvo) | **Médio** | No `queryFn`, validar se o `militar_id` do registro retornado pertence ao conjunto de IDs permitidos do usuário (`useScopedMilitarIds`). |
| `src/pages/EditarJISO.jsx` | `base44.entities.Atestado.filter` / `JISO.filter` | **Nenhum** (Busca direta por ID via SDK) | Escopo Organizacional (Militar Alvo) | **Médio** | Bloquear a exibição do formulário caso o militar vinculado ao atestado/JISO não esteja no escopo organizacional do usuário logado. |
| `src/pages/Atestados.jsx` | `PublicacaoExOfficio.filter({ militar_id })` | **Nenhum** (Busca por militar_id) | Escopo Organizacional | **Baixo** | Embora a query não tenha filtro de escopo nativo, a ação é protegida por `validarEscopoMilitar`. Recomenda-se migrar para serviço escopado no backend futuramente. |
| `base44/functions/getScopedAtestadosBundle/entry.ts` | Filtro por `estruturaIds` e `militarIdsProprios` | Organizacional Consolidado | Organizacional Consolidado | **Baixo** | N/A (Implementação robusta e centralizada). |
| `base44/functions/getAtestadoAnexoSignedUrl/entry.ts` | Validação `inScope` via `getScopedAtestadosBundle` | Organizacional (Backend) | Organizacional | **Baixo** | N/A. |
| `base44/functions/gerarRelatorioDpDintelAtestados/entry.ts` | Validação `idsForaDoEscopo` via `AtestadosBundle` | Organizacional (Backend) | Organizacional | **Baixo** | N/A. |
| `base44/functions/gerarZipAnexosAtestados/entry.ts` | Validação `autorizadosIds` via `AtestadosBundle` | Organizacional (Backend) | Organizacional | **Baixo** | N/A. |

## 2. Diagnóstico Técnico

### Backend (Deno Functions)
As funções de backend (`getScopedAtestadosBundle`, `getScopedExtratoAtestados`, etc.) são a principal barreira de segurança. Elas resolvem corretamente o escopo do usuário (incluindo suporte a impersonação para admins) e filtram os registros de `Atestado` e `JISO` antes de qualquer processamento ou exportação.

### Frontend (Serviços e Hooks)
*   **useScopedMilitarIds.js / useUsuarioPodeAgirSobreMilitar.js**: Atuam como uma camada de defesa em profundidade, garantindo que botões de ação e navegações não permitidas sejam bloqueados.
*   **militarSaudeService.js**: É um motor de cálculo puro e não introduz riscos de exfiltração, pois opera sobre dados já filtrados.

### Vulnerabilidades Identificadas (Riscos Médios)
Identificamos um padrão de **"Acesso Direto por ID"** em telas de detalhes (`VerAtestado.jsx` e `EditarJISO.jsx`). Como o frontend consome `base44.entities.Atestado.filter({ id })` diretamente, um usuário mal-intencionado com acesso ao UUID de um atestado de outro setor poderia visualizá-lo simplesmente alterando o parâmetro na URL, pois a query do SDK não possui cláusula de escopo organizacional automática.

## 3. Classificação de Riscos

- **Baixo:** Queries auxiliares (Ex: verificação de publicações) que não expõem dados sensíveis diretamente ou estão protegidas por travas de ação subjacentes.
- **Médio:** Acesso de leitura a dados sensíveis (CID, Parecer JISO) via link direto em telas de detalhes, bypassando a hierarquia organizacional.

## 4. Recomendações de Segurança

1.  **Reforço em Detalhes:** Nas páginas `VerAtestado.jsx` e `EditarJISO.jsx`, adicionar uma verificação pós-carregamento: se o `militar_id` do registro não estiver no `useScopedMilitarIds`, redirecionar para `AccessDenied`.
2.  **Centralização de Consultas:** Evitar o uso de `base44.entities.X.filter` diretamente no frontend para entidades sensíveis, priorizando sempre as Deno Functions escopadas.

---
*Auditoria realizada como parte do requisito P1.4-C.2.*
