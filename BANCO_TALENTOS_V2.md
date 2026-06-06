# Estratégia Técnica: Banco de Talentos V2

Este documento detalha a evolução do Banco de Talentos para o SGP Militar, focando na localização, ranqueamento e integração de perfis especializados sem a necessidade de alterações no código-fonte atual ou no esquema do banco de dados.

## 1. Como Localizar Perfis Específicos

A localização de talentos baseia-se no motor de busca da tela `Militares.jsx`, utilizando o sistema de **Tags** e **Funções** como metadados dinâmicos.

### Taxonomia de Busca sugerida:

*   **Especialistas**:
    *   **Método**: Filtrar por `TagGrupo: "Especialidades"` ou busca textual por tags específicas (ex: "Especialista em Comunicações", "Especialista em Motociclismo").
    *   **Identificação**: Utilizar o enriquecimento do `grupos_tags` para destacar militares que possuem expertise técnica certificada.
*   **Instrutores**:
    *   **Método**: Filtrar por tags do grupo `"Capacitação e Instrução"`.
    *   **Identificação**: Buscar por nomes de tags padronizados como "Instrutor de Tiro", "Instrutor de Educação Física" ou "Monitor de [Curso]".
*   **Mergulhadores**:
    *   **Método**: Busca por `Tag: "Mergulhador"` ou `Tag: "Curso de Mergulho Autônomo"`.
    *   **Identificação**: Vínculo ativo na entidade `MilitarTag`.
*   **PP (Pronto Pagamento / Proteção de Pessoas)**:
    *   **Método**: Filtro por tag `"PP"` ou `"Curso de Proteção de Pessoas"`.
    *   **Contexto**: Muitas vezes associado a funções específicas em unidades de segurança institucional.
*   **Operadores**:
    *   **Método**: Cruzamento de `Tag` (ex: "Operador de Drone", "Operador de Rádio") com `Função` (ex: "Operador de Central de Videomonitoramento").
    *   **Filtro**: Utilizar o filtro de "Função Ativa" no painel de efetivo.

## 2. Como Ranquear Candidatos

O ranqueamento para missões, promoções ou seleções internas deve seguir uma lógica de filtragem sucessiva (funil) baseada em critérios objetivos já calculados pelo sistema:

1.  **Antiguidade (Critério Institucional)**:
    *   A ordenação segue a regra definida em `docs/antiguidade-militar.md`: `Posto/Graduação` > `Quadro` > `Data de Promoção` > `Referência de Ordem`.
    *   *Uso*: Identificar o mais antigo entre os qualificados.
2.  **Comportamento Disciplinar**:
    *   Utilizar o `comportamento` calculado em `src/utils/calcularComportamento.js`.
    *   *Ranking*: `Excepcional` > `Ótimo` > `Bom`. Candidatos em comportamento `Insuficiente` ou `Mau` devem ser automaticamente desqualificados.
3.  **Completude Cadastral (Confiabilidade)**:
    *   Utilizar o `score` de completude do `militarAuditoriaService.js`.
    *   *Uso*: Priorizar militares com dados 100% atualizados, garantindo que as informações de contato e funcionais são fidedignas.
4.  **Experiência Acumulada**:
    *   Contagem de tempo em funções correlatas (via histórico de funções) e multiplicidade de tags técnicas.

## 3. Integração com Ficha 360º

A Ficha 360º (`VerMilitar.jsx`) atua como o currículo consolidado do militar. A integração ocorre via serviços agregadores:

*   **Agregação de Dados**: O `militar360Service.js` fornece o `resumoExecutivo`. As tags de talento devem ser injetadas neste bundle através do `enriquecerMilitaresComFuncoesETags.js`.
*   **Visualização de Especialidades**:
    *   As "Tags de Talento" (Cursos/Habilidades) são exibidas no componente `TagsMilitarSection`.
    *   A "Função Principal" e o histórico de funções (Carreira) validam a aplicação prática do talento.
*   **Indicadores de Prontidão**:
    *   O `statusOperacional` (Disponível, Férias, Afastado) integrado à Ficha 360º permite saber se o "Talento" localizado está apto para emprego imediato.

## 4. Manutenção (Zero Code)

Para manter este sistema operando:
1.  **Gestão de Catálogo**: Administradores devem manter o cadastro de `TagGrupo` e `Tag` no módulo de "Configurações" (`Tags.jsx`).
2.  **Atribuição em Lote**: Utilizar o `MilitarTagsBulkPanel` para registrar cursos e habilidades para turmas inteiras de uma só vez, alimentando o banco de talentos de forma massiva.
