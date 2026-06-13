# Plano de Padronização: Posto/Graduação e Quadro

## 1. Definição dos Campos Oficiais
Os campos canônicos e únicos oficiais para armazenamento de posto/graduação e quadro na entidade `Militar` são:
- `Militar.posto_graduacao`
- `Militar.quadro`

## 2. Estratégia de Leitura (Fallback Temporário)
Para garantir a compatibilidade durante a transição, as leituras devem priorizar o campo oficial, usando aliases apenas como fallback:

```javascript
// Exemplo de leitura segura
const posto = militar.posto_graduacao || militar.posto_grad || militar.posto || 'Não informado';
const quadro = militar.quadro || militar.quadro_atual || militar.militar_quadro || 'Não informado';
```

## 3. Estratégia de Gravação (Centralização)
Todas as operações de escrita que afetem posto ou quadro devem obrigatoriamente utilizar a função central `atualizarCadastroMilitar` (localizada em `base44/functions/utils.ts`).

### Atualização da Função `atualizarCadastroMilitar`
A função será expandida para incluir todos os aliases identificados na auditoria:
- **Posto:** `posto_graduacao`, `posto_graduacao_atual`, `posto_grad`, `posto`, `graduacao`, `rank`, `cargo`.
- **Quadro:** `quadro`, `quadro_atual`, `quadroAtual`, `quadro_militar`, `militar_quadro`, `qbmp`.

## 4. Rotina de Saneamento e Migração
Será criada uma Edge Function de saneamento (`sanearCamposMilitar`) para:
1. Percorrer todos os registros da entidade `Militar`.
2. Identificar registros onde os campos oficiais estão vazios, mas existem dados nos aliases.
3. Consolidar os dados nos campos oficiais.
4. (Opcional) Limpar os aliases após a confirmação da migração em uma fase posterior.

## 5. Cronograma de Implementação
- **Fase 1 (Atual):** Auditoria e Planejamento.
- **Fase 2:** Atualização de `atualizarCadastroMilitar` e implementação da rotina de saneamento.
- **Fase 3:** Refatoração de módulos de baixo risco (Leituras -> Oficial com Fallback).
- **Fase 4:** Refatoração de módulos de alto risco (após validação extensiva).
- **Fase 5:** Remoção definitiva dos aliases do fluxo de gravação e, eventualmente, do esquema da entidade.

## 6. Módulos Sensíveis (Excluídos da Refatoração Inicial)
Os seguintes módulos não serão alterados sem uma rodada específica de testes e aprovação:
- Efetivo / Consulta Militar
- Promoções
- Antiguidade
- Medalhas
- Férias
- Livro e Publicações
- Geradores de Templates/Documentos
- Importações Legadas

## 7. Mapeamento de Aliases vs Campos Oficiais
| Aliases Posto/Graduação | Aliases Quadro | Campo Oficial Posto | Campo Oficial Quadro |
| :--- | :--- | :--- | :--- |
| posto_grad, postoGraduacao, posto_graduacao_atual, graduacao, rank, cargo, posto | quadro_atual, quadroAtual, quadro_militar, militar_quadro, qbmp | posto_graduacao | quadro |
