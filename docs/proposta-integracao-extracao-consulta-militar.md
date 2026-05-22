# Proposta — Integrar “Extração” dentro da Consulta Militar

## 1) Diagnóstico do problema atual

A implementação atual de Extração do Efetivo é um fluxo paralelo completo (rota própria, menu próprio, permissões próprias, catálogo próprio, log próprio), separado da tela de Consulta Militar.

### Sintomas observáveis no código

- Existe uma página dedicada `ExtracaoEfetivo` com lógica extensa (filtros, grade, KPIs, exportação e auditoria), enquanto a consulta principal está em `Militares`. Isso duplica experiência de consulta em dois lugares. 
- O menu principal mantém duas entradas distintas (“Consulta Militar” e “Extração”), reforçando bifurcação de jornada do usuário.
- O módulo de permissões contém ações exclusivas de Extração (visualizar/exportar), diferentes do módulo de militares.
- Há infraestrutura própria para auditoria de exportação da extração (`ExtracaoEfetivoExportLog` + function `registrarAuditoriaExportacaoEfetivo`), aumentando superfície de manutenção.

### Impacto prático

- Carga cognitiva: usuário precisa decidir “onde consultar” vs “onde extrair”.
- Custo técnico: filtros, regras de escopo e evolução de tabela tendem a divergir entre módulos.
- Risco de inconsistência funcional: mesmas colunas e regras podem se comportar diferente em cada tela.

---

## 2) Novo fluxo proposto (UX)

**Princípio:** manter a tabela da Consulta Militar como centro da experiência; adicionar personalização incremental por modal simples.

### Fluxo do usuário

1. Usuário abre **Consulta Militar** (página `Militares`) normalmente.
2. Usuário clica em botão **“Colunas”** (ou “Personalizar tabela”).
3. Abre modal simples com grupos de colunas (Identificação, Carreira, Situação, Lotação, Contatos etc.).
4. Usuário marca/desmarca colunas visíveis.
5. Ao aplicar, a tabela passa a renderizar apenas colunas selecionadas.
6. Colunas “filtráveis” ganham filtro pontual e contextual (somente quando a coluna estiver visível e for categoria padronizada).
7. Em fase posterior, botão de exportação usa **exatamente** o subconjunto visível + filtros ativos.

### Diretrizes de interface

- Sem “builder” de relatório.
- Modal com checklist agrupado + busca por nome de coluna.
- Presets rápidos: “Padrão”, “Operacional”, “RH”, “Limpar tudo”.
- Indicador leve acima da grade: “X colunas ativas”.

---

## 3) Arquitetura sugerida (incremental, sem refatoração grande)

## 3.1 Camada de configuração de colunas (frontend)

Criar catálogo local de colunas permitido, por exemplo em:

- `src/pages/militares/consultaColumnsCatalog.js` (novo)

Estrutura sugerida:

```js
{
  key: 'posto_graduacao',
  label: 'Posto/Graduação',
  group: 'Carreira',
  defaultVisible: true,
  filterType: 'multiSelect', // none | multiSelect | text | lotacaoTree
  exportable: true,
  accessor: (militar) => militar.posto_graduacao || '—',
  widthClass: 'col-span-2',
}
```

**Regras importantes:**

- Apenas colunas whitelisted no catálogo podem ser mostradas/exportadas.
- Colunas sensíveis podem ter `requiresAction` (ex.: ação de permissão específica) para aparecer no modal.
- A tabela atual deixa de ser “hardcoded fixa” e passa a derivar do catálogo + seleção do usuário.

## 3.2 Estado da personalização

Criar hook simples:

- `src/pages/militares/useConsultaColumnsConfig.js` (novo)

Responsabilidades:

- Inicializar seleção com colunas padrão.
- Persistir preferência no `localStorage` (chave versionada, ex.: `militares:columns:v1`).
- Sanitizar seleção contra catálogo atual (evitar coluna inválida após deploy).

## 3.3 Componente de modal

Criar:

- `src/components/militar/ConsultaColumnsModal.jsx` (novo)

Responsabilidades:

- Exibir colunas por grupo.
- Ações “marcar grupo”, “restaurar padrão”, “aplicar”.
- Renderização desacoplada da lógica de dados.

## 3.4 Filtros por coluna (sem poluir UI)

- Reusar os filtros já existentes da tela `Militares` como base.
- Evolução: montar “filtros ativos” dinamicamente a partir de `filterType` do catálogo, mas com escopo limitado às colunas suportadas agora.
- Para este ciclo, manter filtros globais no topo e apenas exibir/ocultar filtros conforme colunas ativas (não criar filtro no cabeçalho da grade ainda).

## 3.5 Dados e escopo (reaproveitamento obrigatório)

Manter carregamento via:

- `fetchScopedMilitares` (`src/services/getScopedMilitaresClient.js`)
- `fetchScopedLotacoes` (`src/services/getScopedLotacoesClient.js`)

Sem usar `Militar.list()` na consulta principal.

### Estratégia

- Backend continua paginado e escopado como já está.
- Colunas adicionais devem ser limitadas ao que já vem no payload atual.
- Se faltar campo indispensável no payload, registrar “gap” para fase posterior (sem backend change agora, salvo estritamente necessário).

## 3.6 Preparação para exportação futura

Sem implementar agora, mas preparar contrato interno:

- Função `buildVisibleDataset({ militares, visibleColumns, activeFilters })`
- Função `buildExportAuditPayload(...)` (reuso de abordagem de auditoria sanitizada existente)

Quando exportar chegar:

- Excel/PDF usam exatamente a matriz produzida por `buildVisibleDataset`.
- Garantir correspondência 1:1 com o que o usuário está vendo/filtrando.

---

## 4) Arquivos prováveis de remoção/desativação do módulo Extração

## 4.1 Desativar navegação/rota (primeiro passo)

- `src/Layout.jsx` — remover item de menu “Extração”.
- `src/pages.config.js` — retirar rota `ExtracaoEfetivo`.

## 4.2 Desativar permissão específica (após migração funcional)

- `src/config/permissionStructure.js` — remover bloco `acesso_extracao_efetivo` e ações associadas.
- `src/App.jsx` — revisar mapeamento de ações para `ExtracaoEfetivo`.

## 4.3 Limpeza de página/componentes (fase final)

- `src/pages/ExtracaoEfetivo.jsx`
- `src/pages/extracaoEfetivo/catalogoCamposEfetivo.*`
- `src/pages/extracaoEfetivo/extracaoState.*`
- `src/pages/extracaoEfetivo/components/*`

## 4.4 Infra de auditoria exportação de extração (somente quando nova exportação estiver pronta)

- `entities/ExtracaoEfetivoExportLog.json`
- `base44/entities/ExtracaoEfetivoExportLog.jsonc`
- `base44/functions/registrarAuditoriaExportacaoEfetivo/entry.ts`

> Recomendação: não remover auditoria antiga até exportação da Consulta Militar estar em produção com trilha equivalente.

---

## 5) Arquivos da Consulta Militar a alterar

- `src/pages/Militares.jsx` (principal: toolbar, modal, render de colunas dinâmica, vínculo de filtros).
- `src/components/militar/MultiSelectFiltro.jsx` (apenas se precisar adaptação leve para uso dinâmico).
- `src/components/militar/HierarchicalLotacaoSelect.jsx` (somente se filtro de lotação for plugável por catálogo).
- `src/services/getScopedMilitaresClient.js` (somente se precisar aceitar filtros padronizados extras sem quebrar contrato atual).
- `src/services/matriculaMilitarViewService.*` (somente se alguma coluna depender de normalização já existente).

Novos sugeridos:

- `src/pages/militares/consultaColumnsCatalog.js`
- `src/pages/militares/useConsultaColumnsConfig.js`
- `src/components/militar/ConsultaColumnsModal.jsx`
- `src/pages/militares/consultaFiltersAdapter.js` (opcional, para isolar regras de filtro por tipo de coluna)

---

## 6) Riscos e mitigação

## 6.1 Permissões/escopo

Risco:

- Coluna sensível aparecer para perfil sem acesso.

Mitigação:

- Catálogo com `requiresAction`/`requiresModule` por coluna.
- Filtro final de colunas pelo `canAccessAction` antes de renderizar modal/tabela/export.

## 6.2 Performance

Risco:

- Colunas dinâmicas com muitos cálculos por linha degradarem render.

Mitigação:

- `useMemo` para colunas ativas e renderizadores.
- Não recalcular listas de opções de filtros sem necessidade.
- Manter paginação backend existente (`PAGE_SIZE`, `offset`, `hasMore`).

## 6.3 Consistência visual

Risco:

- Grid atual usa `col-span` fixo; colunas dinâmicas podem quebrar alinhamento.

Mitigação:

- Trocar gradualmente para modelo de largura por coluna no catálogo.
- Primeiro lote: limitar colunas customizáveis a subconjunto de largura previsível.

## 6.4 Regressão funcional

Risco:

- Quebrar filtros já estáveis da consulta.

Mitigação:

- Feature flag local (`enableConsultaColumnsV1`) para rollout progressivo.
- Testes de regressão dos filtros existentes antes de remover Extração.

---

## 7) Plano recomendado em pequenos lotes

## Lote 0 — Diagnóstico + flag (sem mudar UX final)

- Introduzir catálogo de colunas + hook de seleção (sem modal visível).
- Manter tabela atual funcional.

## Lote 1 — Modal de colunas (sem novos filtros)

- Adicionar botão “Colunas”.
- Permitir ocultar/exibir colunas básicas.
- Persistência local de preferência.

## Lote 2 — Filtros condicionais por coluna

- Exibir filtros apenas para colunas ativas com `filterType` suportado.
- Reusar componentes de filtro atuais.

## Lote 3 — Desativar módulo Extração na navegação

- Remover menu e rota de Extração.
- Comunicar migração em release note interno.

## Lote 4 — Exportação integrada (Excel/PDF)

- Implementar export respeitando colunas visíveis e filtros ativos.
- Adicionar auditoria equivalente à atual, agora vinculada à Consulta Militar.

## Lote 5 — Limpeza definitiva do legado

- Remover arquivos da antiga Extração.
- Remover permissões/entidades/functions obsoletas.

---

## 8) Recomendação final

O melhor caminho é **migração incremental dentro de `Militares.jsx`**, com catálogo de colunas + modal simples + filtros condicionais, preservando o carregamento escopado já existente (`fetchScopedMilitares`/`fetchScopedLotacoes`) e sem tocar backend neste primeiro momento.

Isso atende às diretrizes de UX (simplicidade, baixa carga cognitiva, tabela como protagonista), reduz duplicidade entre módulos e prepara exportação futura consistente com o que o usuário vê.

A estratégia de menor risco é: **introduzir personalização primeiro, desligar Extração depois** — nunca o inverso.
