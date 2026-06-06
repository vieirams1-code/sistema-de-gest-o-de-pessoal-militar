# Estudo Técnico: Portal do Militar

Este documento apresenta a análise técnica para a implementação do Portal do Militar, um módulo de autoatendimento onde o militar pode consultar seus próprios dados e interagir com o RH.

## 1. Quais dados já existem?
O sistema atual já possui uma estrutura de dados robusta e centralizada nas seguintes entidades:
- **Militar**: Dados pessoais (CPF, RG, nascimento, filiação, endereço, contatos, banco) e funcionais (matrícula, posto/graduação, quadro, situação, lotação, função).
- **MatriculaMilitar**: Histórico de matrículas (Principal, Secundária, etc.).
- **Ferias** e **PeriodoAquisitivo**: Saldo, agendamentos, gozos e créditos extraordinários.
- **Atestado**: Afastamentos de saúde, CIDs, médicos e agendamentos de JISO.
- **Medalha** e **TipoMedalha**: Indicações, concessões e apuração de tempo para novas medalhas.
- **Armamento**: Registros de armas particulares vinculadas ao militar.
- **PunicaoDisciplinar**: Histórico de punições para fins de cálculo de comportamento.
- **HistoricoComportamento** e **PendenciaComportamento**: Evolução do comportamento disciplinar.
- **HistoricoPromocaoMilitarV2**: Linha do tempo da carreira e promoções.
- **PublicacaoExOfficio** e **RegistroLivro**: Registros de alterações publicados em boletim.
- **SolicitacaoAtualizacao**: Pedidos de correção de dados enviados pelo militar.

## 2. Quais dados o militar pode visualizar?
Em um escopo de "Autoatendimento", o militar deve visualizar:
- **Resumo de Carreira**: Posto atual, tempo de serviço e comportamento.
- **Dados Cadastrais**: Conferência de todos os seus dados pessoais e funcionais.
- **Ficha Disciplinar**: Linha do tempo de comportamento e punições sofridas.
- **Gestão de Afastamentos**: Seus atestados ativos, histórico de saúde e agenda de perícias (JISO).
- **Férias**: Saldo de dias por período aquisitivo e histórico de gozos.
- **Patrimônio**: Seus armamentos registrados.
- **Publicações**: Todos os registros do Livro ou Boletim onde sua matrícula/nome foi citado.

## 3. Quais dados devem ser ocultados?
Devem ser restritos ao acesso administrativo (SGP/Comando):
- **Dados de outros militares**: O militar nunca deve visualizar registros que não pertençam ao seu ID.
- **Processos Sigilosos**: IPMs, Sindicâncias ou PADs em fase de instrução não publicados.
- **Logs de Auditoria**: Registros técnicos de quem alterou o cadastro.
- **Inteligência de Gestão**: Quadros operacionais de toda a tropa, mapas de lotação geral e painéis de inconsistências de outros usuários.
- **Gestão de Cotas**: Detalhes técnicos de vagas de gratificações (ex: Gratificação de Função) que não sejam a sua própria nomeação.

## 4. Quais permissões seriam necessárias?
O sistema já utiliza o hook `useCurrentUser` que define o `modoAcesso`. Para o Portal, utilizaremos:
- **Escopo**: `modoAcesso: "proprio"`. Este escopo já filtra automaticamente os dados pelo e-mail ou matrícula do usuário logado.
- **Novas Action Keys**:
    - `acesso_portal_militar`: Permissão básica para entrar no módulo.
    - `perm_visualizar_propria_ficha`: Visualização detalhada (leitura).
    - `perm_solicitar_atualizacao_cadastral`: Permissão para abrir pedidos de correção.
    - `perm_gerar_documento_militar`: Permissão para emitir certidões e fichas em PDF.

## 5. Quais APIs e bundles podem ser reutilizados?
- **getUserPermissions**: Função Deno que já resolve permissões e escopo organizacional.
- **getScopedMilitaresClient**: Para buscar os dados do próprio militar de forma segura.
- **afastamentosVigentesService**: Para consolidar férias e atestados atuais no dashboard do militar.
- **justicaDisciplinaService**: Para recuperar o histórico de comportamento.
- **matriculaMilitarViewService**: Para montar a visão de matrículas históricas.
- **documentosMilitares (Services)**: Para a geração automática de fichas e certidões.

## 6. Quais componentes existentes podem ser reaproveitados?
O reaproveitamento de UI é superior a 70%:
- **VerMilitar.jsx**: A estrutura de abas (Dados, Férias, Comportamento, etc.) é idêntica ao que o militar precisa ver.
- **ComportamentoTimeline** e **HistoricoComportamentoChart**: Para a aba de disciplina.
- **SolicitarAtualizacaoModal**: Já permite ao militar enviar sugestões de alteração de campos específicos.
- **TempoServico** e **AlertasContrato**: Componentes de resumo que podem compor o topo do portal.
- **GerarDocumentoMilitarModal**: Para o autoatendimento de documentos.

## 7. Estimar MVP do Portal Militar
Um MVP (Produto Mínimo Viável) focado em consulta e solicitações básicas:

**Semana 1-2: Infraestrutura e Segurança**
- Criação da rota `/portal` e ajuste no `useCurrentUser` para garantir que o perfil "Militar" caia direto no seu próprio escopo.
- Implementação de RLS (Row Level Security) ou filtros de backend rigorosos para o escopo "proprio".

**Semana 3-4: UI e Funcionalidades Core**
- Adaptação do `VerMilitar.jsx` para uma versão "View Only" (Portal do Militar).
- Ativação do módulo de Solicitação de Atualização para campos de contato e endereço.
- Dashboard simplificado com Alertas de JISO e Saldo de Férias.

**Estimativa Total: 1 mês (4 semanas)** para um portal funcional, aproveitando a maturidade dos componentes de perfil já existentes.
