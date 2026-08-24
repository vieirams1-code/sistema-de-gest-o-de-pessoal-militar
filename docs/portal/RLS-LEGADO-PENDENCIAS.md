# Dívida Técnica de Segurança: RLS das Entidades Legadas e Migração para Backend Functions

## 1. Contexto e Diagnóstico

Durante a auditoria da Fase 1.1 e 1.1.1, foi constatado que as entidades legadas do SGP Militar possuem políticas de Row Level Security (RLS) excessivamente permissivas no runtime Base44 ou carecem de declarações RLS explícitas em seus esquemas `.jsonc`.

### Achados por Entidade

| ENTIDADE | ARQUIVO SCHEMA | REGRA RLS ATUAL | RISCO IDENTIFICADO |
| :--- | :--- | :--- | :--- |
| **PeriodoAquisitivo** | `base44/entities/PeriodoAquisitivo.jsonc` | `"read": { "$or": [{ "role": "admin" }, {}] }` | **Leitura irrestrita:** A cláusula `{}` permite que qualquer usuário autenticado leia todos os registros de períodos aquisitivos de todo o efetivo militar. |
| **Ferias** | `base44/entities/Ferias.jsonc` | `"read": { "$or": [{ "role": "admin" }, {}] }` | **Leitura irrestrita:** Qualquer usuário autenticado no app consegue listar todas as férias cadastradas na base. |
| **Militar** | `base44/entities/Militar.jsonc` | Sem bloco `rls` declarado | Herda visibilidade padrão do BaaS (leitura aberta para qualquer usuário logado). |
| **UsuarioAcesso** | `base44/entities/UsuarioAcesso.jsonc` | Sem bloco `rls` declarado | Leitura aberta para usuários logados. |
| **PerfilPermissao** | `base44/entities/PerfilPermissao.jsonc` | Sem bloco `rls` declarado | Leitura aberta para usuários logados. |

---

## 2. Por que o RLS não pôde ser fechado imediatamente na Fase 1.2A?

Foram mapeadas mais de **50 páginas e componentes administrativos** no frontend que atualmente realizam chamadas diretas ao SDK (`base44.entities.<Entidade>.filter/get/list`), incluindo:

- `src/components/ferias/PeriodoAquisitivoGenerator.jsx`
- `src/components/ferias/recalcularPeriodoAquisitivo.js`
- `src/components/ferias/RegistroLivroModal.jsx`
- `src/components/militar/SolicitarAtualizacaoModal.jsx`
- `src/components/antiguidade/CarreiraAntiguidadePanel.jsx`
- `src/pages/CadastrarFerias.jsx`
- `src/pages/Atestados.jsx`
- `src/pages/PlanoAnualFerias.jsx`

Caso o bloco `rls` fosse alterado para restrito (`read: { role: 'admin' }`), todas essas telas para usuários restritos (chefes de setor, visualizadores de unidade) deixariam de carregar seus dados imediatamente.

---

## 3. Plano de Mitigação e Migração Segura

1. **Isolamento do Portal do Militar:**
   - O Portal do Militar é 100% blindado contra esse risco porque **não utiliza** chamadas diretas a `base44.entities.*`.
   - Toda comunicação passa por Deno Functions com o Session Guard (`requirePortalSession`), projeção DTO e validação de `militar_id` derivado.

2. **Plano de Migração do SGP Administrativo (Fases Futuras):**
   - Continuar a migração das telas administrativas para Deno Functions escopadas (ex: `getScopedFeriasBundle`, `getScopedAtestadosBundle`, `getScopedPeriodosAquisitivosBundle`), padrão já consolidado no Lote 1B com `getScopedMilitares` e `cudEscopado`.
   - Assim que todos os componentes administrativos estiverem utilizando as backend functions, fechar o RLS das entidades legadas para `{ read: { role: 'admin' }, write: { role: 'admin' } }`.
