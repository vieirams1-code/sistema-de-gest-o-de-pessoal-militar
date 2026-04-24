# Auditoria de Permissões SGP Militar (24/04/2026)

## Escopo auditado
- `src/Layout.jsx`
- `src/App.jsx`
- `src/pages.config.js`
- `src/config/permissionStructure.js`
- páginas de `src/pages`
- componentes e telas com ações críticas (criar/editar/excluir/importar/publicar/resetar)

## Lacunas encontradas

### 1) Módulo de migração fora da matriz principal
- As páginas de migração estavam protegidas por `isAdmin` sem módulo/permissões próprias na matriz.
- O menu de Migração no `Layout` usava `adminOnly`, sem granularidade por ação.

### 2) Ações CRUD sem separação por módulo em telas principais
- `Militares`: botão **Novo Militar** e ações de **Editar/Excluir** não tinham chaves CRUD específicas de matriz.
- `Atestados`: botão **Novo Atestado** e ação **Editar** não tinham chave de ação específica; exclusão já tinha (`perm_excluir_atestado`).
- `Armamentos`: botão **Novo Registro** sem chave específica de ação.
- `Publicações`: criação dependia de `editar_publicacoes` (sem `adicionar_publicacoes`); exclusão atrelada apenas a `admin_mode`.

### 3) Páginas sem cobertura explícita no `moduleGuardByPage` do App
- `PerfisPermissao`
- `PermissoesUsuarios`
- `PlanoAnualFerias`
- `Processos`
- `Punicoes`
- `TemplatesTexto`
- `VerMilitar`

> Observação: parte dessas páginas já faz validação interna por `useCurrentUser`, mas não está explicitamente mapeada no guard central do App.

## Situação dos módulos solicitados (pedido)

- Migração de Militares → lacuna encontrada e tratada.
- Histórico de Importações → lacuna encontrada e tratada.
- Migração Alterações Legado → lacuna encontrada e tratada.
- Classificação Pendentes Legado → lacuna encontrada e tratada.
- Revisão de Duplicidades → lacuna encontrada e tratada.
- Limpeza pré-publicação/reset operacional → chave já existente e mantida sensível.
- Créditos Extraordinários, Medalhas, Publicações/RP, Férias, Atestados/JISO, Quadro Operacional, Armamentos, Lotação, Estrutura Organizacional → presentes, porém ainda com pontos de evolução para padronização completa CRUD/exportar/publicar/resetar.

## Padrão de matriz proposto
- `visualizar_<modulo>`
- `adicionar_<modulo>`
- `editar_<modulo>`
- `excluir_<modulo>`
- `importar_<modulo>`
- `exportar_<modulo>`
- `publicar_<modulo>`
- `resetar_<modulo>`
- `gerir_<modulo>` (apenas administração ampla)

## Chaves adicionadas nesta entrega

### Módulo Migração
- `acesso_migracao`
- `perm_importar_militares`
- `perm_ver_historico_importacoes`
- `perm_migrar_alteracoes_legado`
- `perm_classificar_legado`
- `perm_revisar_duplicidades`
- `perm_reset_operacional` (mantida sensível)

### Militares
- `perm_visualizar_militares`
- `perm_adicionar_militares`
- `perm_editar_militares`
- `perm_excluir_militares`

### Atestados
- `perm_visualizar_atestados`
- `perm_adicionar_atestados`
- `perm_editar_atestados`
- `perm_excluir_atestado` (já existente)

### Armamentos
- `perm_visualizar_armamentos`
- `perm_adicionar_armamentos`
- `perm_editar_armamentos`
- `perm_excluir_armamentos`

### Publicações
- `perm_adicionar_publicacoes`
- `perm_excluir_publicacoes`
- (`perm_editar_publicacoes` já existente)

## Implementações realizadas (seguras e de baixo risco)

### Migração priorizada
- Migração passou a ter controle por módulo + ações específicas em páginas e menu.
- Páginas:
  - `MigracaoMilitares`: exige `acesso_migracao` + `perm_importar_militares`.
  - `HistoricoImportacoesMilitares`: exige `acesso_migracao` + `perm_ver_historico_importacoes`.
  - `MigracaoAlteracoesLegado`: exige `acesso_migracao` + `perm_migrar_alteracoes_legado`.
  - `ClassificacaoPendentesLegado`: exige `acesso_migracao` + `perm_classificar_legado`.
  - `RevisaoDuplicidadesMilitar`: exige `acesso_migracao` + `perm_revisar_duplicidades`.

### Menu com permissão de acesso/ação
- Grupo Migração no `Layout` deixou de ser `adminOnly` puro e passou para:
  - visibilidade do grupo por `acesso_migracao`
  - visibilidade de cada subitem por action key específica.

### Botões CRUD priorizados
- `Militares`
  - **Novo Militar** só aparece com `adicionar_militares`.
  - **Editar/Excluir** no card só aparecem com `editar_militares`/`excluir_militares`.
- `Atestados`
  - **Novo Atestado** só aparece com `adicionar_atestados`.
  - **Editar/Excluir** no card só aparecem com `editar_atestados`/`excluir_atestado`.
- `Armamentos`
  - **Novo Registro** só aparece com `adicionar_armamentos`.
- `Publicações`
  - **Nova publicação** usa `adicionar_publicacoes` (com fallback para permissões legadas de edição/admin).
  - exclusão passou a considerar `excluir_publicacoes` + `modoAdmin`.

## Checklist final
- [x] Auditoria dos arquivos centrais de layout/rotas/matriz.
- [x] Identificação de módulos/páginas fora da matriz.
- [x] Migração convertida para módulo próprio com permissões granulares.
- [x] Ajustes de visibilidade de menu por acesso.
- [x] Ajustes de botões sensíveis e CRUD prioritários.
- [x] Admin mantém capacidade crítica por comportamento já existente no `useCurrentUser`.
- [ ] Evolução completa de todos os módulos para padrão CRUD/importe/exporte/publicar/resetar (fase seguinte recomendada).
