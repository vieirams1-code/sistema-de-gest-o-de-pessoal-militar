# Estudo Técnico: Módulo de Cursos e Certificações

Este documento apresenta a análise para a implementação do módulo de Cursos e Certificações, visando integrar o histórico de capacitação ao perfil 360º do militar e ao Banco de Talentos.

## 1. Análise da Estrutura Atual

O sistema já possui uma entidade "dormente" no backend chamada `CursoMilitar` (localizada em `base44/entities/CursoMilitar.jsonc`), que contém:
- `militar_id`, `nome_curso`, `tipo` (Militar/Civil), `data_realizacao`, `carga_horaria` e `observacoes`.

No entanto, para um módulo completo, faltam mecanismos de padronização, controle de validade e gestão de documentos.

## 2. Reutilização de Componentes e Lógicas

### 2.1 Reutilização de Tags (Competências)
A recomendação é utilizar o sistema de **Tags** para representar as **habilidades/competências** derivadas dos cursos:
- **Mecanismo**: Ao cadastrar a conclusão de um curso (ex: "Curso de Mergulho"), o sistema deve sugerir ou aplicar automaticamente uma Tag correspondente (ex: "Mergulhador") ao militar.
- **Vínculo**: O `MilitarTag` deve ser utilizado para manter o estado ativo da competência. Se um curso vencer e não houver reciclagem, a Tag pode ser marcada como "Inativa" ou removida.
- **Vantagem**: Reaproveita toda a lógica de filtros de busca e visualização já existente no `Militares.jsx` e `Tags.jsx`.

### 2.2 Reutilização de Funções (Pré-requisitos)
A entidade `FuncaoMilitar` deve ser estendida (via metadados ou novos campos) para exigir cursos específicos:
- **Validação**: Ao tentar vincular um militar a uma função (ex: "Motorista de Emergência"), o serviço `militarFuncoes.js` deve verificar se o militar possui o curso obrigatório ativo.
- **Bloqueio/Alerta**: Impedir a designação ou gerar uma pendência caso a certificação esteja vencida.

## 3. Necessidade de Novas Entidades

Para evitar a fragmentação de dados por digitação livre, propõe-se:

1.  **CursoCatalogo**: Entidade mestre para padronizar os cursos.
    - Campos: `nome`, `descricao`, `categoria` (Técnico, Operacional, Administrativo), `carga_horaria_padrao` e `periodicidade_meses` (para reciclagens).
2.  **CursoCertificado (ou evolução do CursoMilitar)**:
    - `curso_catalogo_id`: Relacionamento com o catálogo.
    - `data_validade`: Calculada com base na data de conclusão + periodicidade do catálogo.
    - `status`: [Em Curso, Concluído, Vencido, Substituído].
    - `url_certificado`: Link para o arquivo (PDF/Imagem) armazenado no storage.
    - `id_origem_reciclagem`: Referência ao curso anterior para manter a cadeia histórica de renovações.

## 4. Validade e Reciclagens

O controle de validade deve ser proativo:
- **Cálculo Automático**: Se o curso no catálogo possuir periodicidade, a `data_validade` é preenchida automaticamente no ato do cadastro.
- **Alertas de Vencimento**: Integração com o `dashboardMilitarPendenciasService` para exibir cursos que vencem nos próximos 30/60/90 dias.
- **Lógica de Reciclagem**: O cadastro de um novo curso do mesmo tipo (mesmo `curso_catalogo_id`) deve "arquivar" o registro anterior, tornando-se o registro vigente para fins de conformidade funcional.

## 5. Integração com a Ficha 360º e Timeline

Para garantir a visibilidade das certificações:
- **Militar360Service**: Adicionar o bloco `cursos` ao bundle, destacando certificações técnicas ativas.
- **MilitarTimelineService**: Incluir eventos de "Conclusão de Curso" e "Vencimento de Certificação".
- **MilitarDocumentosService**: Integrar os links de certificados na função `getDocumentosUnificados`, permitindo que o RH baixe todos os diplomas de uma vez.

## 6. Conclusão

A implementação deve focar na **padronização via Catálogo** e na **automação de Tags**. Isso transforma o histórico de cursos de uma simples lista de texto em um motor de inteligência para o Banco de Talentos, permitindo ao Comando identificar instantaneamente quem está apto para missões específicas com base em certificações válidas.
