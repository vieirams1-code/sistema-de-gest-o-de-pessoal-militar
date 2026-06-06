# UX Design: Portal do Militar (SGP)

Este documento detalha a experiência do usuário (UX) para o Portal do Militar, focando em acessibilidade mobile-first, transparência de dados e eficiência no autoatendimento.

## 1. Diretrizes de UX

- **Mobile-First**: Interface otimizada para smartphones (telas verticais, botões de toque amplos).
- **Transparência Passiva**: O militar deve visualizar sua situação sem precisar perguntar ao RH.
- **Carga Cognitiva Reduzida**: Uso de cards, barras de progresso e cores semânticas (verde para disponível, vermelho para alerta).
- **Navegação Intuitiva**: Menu inferior ou "Tab Bar" para troca rápida entre as seções principais.

---

## 2. Dashboard (`/portal`)

O centro de controle do militar. Exibe o "Resumo Executivo 360º" para uma visão instantânea da vida funcional.

### Componentes Principais:
- **Status Operacional**: Card com cor dinâmica (Verde: Disponível, Azul: Férias/Afastado, Amarelo: JISO).
- **Completude Cadastral**: Barra de progresso indicando o quão atualizado está o perfil.
- **Alertas de Próximos Eventos**: Cards para Perícias agendadas ou Férias próximas.
- **Atalhos Rápidos**: Botões flutuantes ou em grade para as ações mais comuns.

### Wireframe Textual:
```text
+---------------------------------------+
| [Militar Name]           [Sair]       |
+---------------------------------------+
|  +---------------------------------+  |
|  |       STATUS OPERACIONAL        |  |
|  |         [ DISPONÍVEL ]          |  | (Cor Verde)
|  |   "Pronto para o serviço"       |  |
|  +---------------------------------+  |
|                                       |
|  Completude Cadastral: [====---] 65%  |
|  (Clique para ver pendências)         |
|                                       |
|  +---------------------------------+  |
|  | ALERTAS (1)                     |  |
|  | [!] JISO agendada: 25/10        |  |
|  +---------------------------------+  |
|                                       |
|  +----------+ +----------+ +---------+|
|  | FICHA    | | SOLICITAR| | ESCALA  ||
|  | MILITAR  | | ATUALIZ. | | (Em brve)||
|  +----------+ +----------+ +---------+|
+---------------------------------------+
| [Home] [Perfil] [Férias] [Docs] [Menu]| (Tab Bar)
+---------------------------------------+
```

---

## 3. Meu Perfil (`/portal/perfil`)

Visão detalhada e somente leitura dos dados armazenados no SGP.

### Estrutura:
- **Cabeçalho**: Foto, Nome de Guerra, Posto/Graduação e Matrícula.
- **Tabs de Conteúdo**:
    - **Dados**: Pessoais (CPF, RG, Endereço) e Funcionais (Lotação, Função).
    - **Carreira**: Linha do tempo de promoções e tempo de serviço.
    - **Comportamento**: Evolução disciplinar e comportamento atual (Ex: "Excepcional").

### Wireframe Textual:
```text
+---------------------------------------+
| < Voltar         PERFIL               |
+---------------------------------------+
|   [ FOTO ]   CAP PM SANTOS            |
|              Matrícula: 123.456-7     |
|              Status: Ativo            |
+---------------------------------------+
| [ DADOS ] [ CARREIRA ] [ COMPORT. ]   |
+---------------------------------------+
| DADOS FUNCIONAIS:                     |
| Lotação: 1º BPM / 2ª CIA              |
| Função: Comandante de Pelotão         |
| Data Inclusão: 10/02/2015             |
|                                       |
| DADOS PESSOAIS:                       |
| CPF: ***.456.***-00  [Ver mais]       |
| Endereço: Rua das Flores, 123...      |
+---------------------------------------+
```

---

## 4. Meus Cursos (`/portal/cursos`)

Mapeamento de competências e especializações registradas via sistema de Tags.

### Componentes:
- **Cursos Formais**: CAS, CFC, CFS, Graduações.
- **Habilidades/Tags**: Especializações técnicas (Motorista, Armeiro, TI).
- **Projetos/Grupos**: Participação em grupos de trabalho ou comissões.

### Wireframe Textual:
```text
+---------------------------------------+
| < Voltar         MEUS CURSOS          |
+---------------------------------------+
| FORMAL:                               |
| [CAS] Curso de Aperfeiçoamento (2023) |
| [CFO] Curso de Formação (2015)        |
|                                       |
| ESPECIALIZAÇÕES:                      |
| (Tag) Operador de Drone               |
| (Tag) Instrutor de Tiro               |
|                                       |
| [ + Sugerir Novo Curso / Diploma ]    |
+---------------------------------------+
```

---

## 5. Minhas Férias (`/portal/ferias`)

Gestão simplificada de períodos aquisitivos e gozos.

### Componentes:
- **Saldo Atual**: Dias disponíveis para gozo imediato.
- **Períodos Aquisitivos**: Lista com status (Vencido, No Prazo, Gozado).
- **Histórico de Gozos**: Datas de quando o militar esteve afastado.

### Wireframe Textual:
```text
+---------------------------------------+
| < Voltar         MINHAS FÉRIAS        |
+---------------------------------------+
| SALDO TOTAL: 45 DIAS                  |
+---------------------------------------+
| PERÍODOS AQUISITIVOS:                 |
| [ 2023/2024 ]  Saldo: 30 dias         |
|                Vence em: 10/05/2025   |
|                                       |
| [ 2022/2023 ]  Saldo: 15 dias         |
|                (Parcialmente gozado)  |
|                                       |
| HISTÓRICO:                            |
| 15 dias - 01/01/24 a 15/01/24         |
+---------------------------------------+
```

---

## 6. Meus Documentos (`/portal/documentos`)

Repositório unificado de tudo que foi publicado sobre o militar.

### Componentes:
- **Busca e Filtro**: Por tipo (Publicação, Registro de Livro, Medalha) ou ano.
- **Timeline de Documentos**: Lista cronológica de atos administrativos.
- **Gerador de PDF**: Botão para emitir a Ficha Funcional oficial ou Certidões.

### Wireframe Textual:
```text
+---------------------------------------+
| < Voltar         DOCUMENTOS           |
+---------------------------------------+
| [ Filtro: Todos v ] [ Busca...     ]  |
+---------------------------------------+
| [PDF] FICHA MILITAR (Gerar agora)     |
+---------------------------------------+
| SET/2024                              |
| - Publicação: Elogio Individual       |
| - Registro: Alteração de Endereço     |
|                                       |
| AGO/2024                              |
| - Medalha: Tempo de Serviço 10 Anos   |
+---------------------------------------+
```

---

## 7. Solicitações (`/portal/solicitacoes`)

Canal direto de interação com o RH para correções e pedidos.

### Fluxo:
- **Nova Solicitação**: Abre o `SolicitarAtualizacaoModal`.
- **Acompanhamento**: Lista de pedidos com tags de status (Pendente, Em Análise, Deferido, Indeferido).
- **Transparência**: Motivo da recusa caso o RH negue a atualização.

### Wireframe Textual:
```text
+---------------------------------------+
| < Voltar         SOLICITAÇÕES         |
+---------------------------------------+
| [ + NOVA SOLICITAÇÃO DE CORREÇÃO ]    |
+---------------------------------------+
| EM ANÁLISE:                           |
| #123 - Correção de Telefone           |
| Criado em: 15/09/2024                 |
|                                       |
| FINALIZADAS:                          |
| [DEFERIDO] #110 - Inclusão de Curso   |
| [RECUSADO] #105 - Mudança de Quadro   |
| Motivo: "Documentação insuficiente"   |
+---------------------------------------+
```
