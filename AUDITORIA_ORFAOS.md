# 3. AUDITORIA DE MÓDULOS ÓRFÃOS

Este documento detalha o resultado da auditoria realizada para identificar código e funcionalidades não utilizadas no sistema SGP Militar.

## 1. Páginas Órfãs (Arquivos sem Registro)

Arquivos localizados no diretório `./pages/` que não estão registrados no `pages.config.js` e, portanto, são inacessíveis via roteamento:

- **CentralPendencias.jsx**: Página de centralização de pendências administrativa.
  - *Arquivos associados*:
    - `src/hooks/central-pendencias/useCentralPendencias.js`
    - `src/components/central-pendencias/*` (7 componentes)
- **ExtracaoEfetivo.jsx**: Funcionalidade de extração de dados do efetivo.
  - *Arquivos associados*:
    - `src/pages/extracaoEfetivo/` (testes e utilitários)

## 2. Páginas Escondidas (Registradas mas sem Acesso)

Páginas que estão registradas no `pages.config.js` e `App.jsx`, mas não possuem links no menu lateral (`Layout.jsx`) ou referências em outras funcionalidades:

- **Processos.jsx**: Substituído pelo Quadro Operacional (conforme comentário interno no arquivo).
- **ClassificacaoPendentesLegado.jsx**: Referenciado apenas pelo hook órfão `useCentralPendencias.js`.
- **RevisaoDuplicidadesMilitar.jsx**: Registrada e protegida por permissão, mas sem entrada no menu.
- **AntiguidadeImportarPromocoes.jsx**: Funcionalidade de administração de antiguidade sem link direto no menu.

## 3. Componentes Sem Uso

Componentes que não possuem referências de importação ativa no diretório `src/`:

### Funcionais
- `src/components/ProtectedRoute.jsx`: Substituído pela lógica de `RequireAdmin` e `RequireModuleAccess`.
- `src/components/admin/SaneamentoPromocaoDivergenteDialog.jsx`
- `src/components/admin/SaneamentoQbmptQptbmDialog.jsx`
- `src/components/militar/MilitaresDistribuicaoView.jsx`
- `src/components/militar/EfetivoFuncoesTagsCompactas.jsx`
- `src/components/militar/HistoricoComportamentoModal.jsx`
- `src/components/militar/LotacaoSelector.jsx`
- `src/components/militar/MapaDeLotacao.jsx`

### UI (Shadcn/UI)
Bibliotecas de interface instaladas mas não consumidas por nenhuma feature:
- `src/components/ui/carousel.jsx`
- `src/components/ui/chart.jsx`
- `src/components/ui/drawer.jsx`
- `src/components/ui/context-menu.jsx`
- `src/components/ui/hover-card.jsx`
- `src/components/ui/input-otp.jsx`
- `src/components/ui/menubar.jsx`
- `src/components/ui/navigation-menu.jsx`
- `src/components/ui/pagination.jsx`
- `src/components/ui/progress.jsx`
- `src/components/ui/radio-group.jsx`
- `src/components/ui/resizable.jsx`
- `src/components/ui/sidebar.jsx`
- `src/components/ui/slider.jsx`
- `src/components/ui/toggle-group.jsx`

## 4. Serviços e Utilitários Órfãos

- `src/services/gerarZipAnexosAtestadosClient.js`
- `src/components/assistente-procedimentos/assistenteProcedimentosService.js`

## 5. Entidades Não Utilizadas

Entidades registradas em `main.jsx` (mantidas para sincronização de bundle) mas sem lógica de negócio ou interface no frontend:

- **ProcedimentoProcesso**
- **ProcedimentoEnvolvido**
- **ProcedimentoPendencia**
- **ProcedimentoViatura**
- **ProcedimentoPrazoHistorico**
- **BaseConhecimentoProcedimento**
- **AssistenteLog**

## 6. Permissões Mortas

Permissões listadas em `permissionStructure.js` que não são validadas em nenhum ponto do código (`App.jsx` ou `Layout.jsx`):

- `perm_aplicar_transicao_legado_ativa`
- `perm_reset_operacional`
- `perm_gerir_permissoes` (Legado)

## Resultado da Auditoria
A identificação destes módulos permite uma limpeza futura segura, reduzindo a dívida técnica e o custo de manutenção do bundle. Recomenda-se a remoção gradual destes arquivos após validação com as equipes de produto.
