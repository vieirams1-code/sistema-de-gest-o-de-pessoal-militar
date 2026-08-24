# Contrato de Segurança do Portal do Militar (Security Contract)

Este documento estabelece as 15 regras inegociáveis de arquitetura e segurança para o desenvolvimento, evolução e operação do **Portal do Militar**.

---

### REGRA 1 — PROIBIÇÃO DE CONSULTA DIRETA A ENTIDADES
O frontend do Portal (`src/portal/*`) jamais invocará métodos de entidades do SDK (`base44.entities.*`). Toda e qualquer interação de dados deve ser realizada exclusivamente via Backend Functions (`base44/functions/portal_*`).

### REGRA 2 — DERIVAÇÃO AUTORITATIVA DE IDENTIDADE
Nenhum endpoint do Portal aceita `militar_id` como parâmetro de autorização vindo do cliente. O `militar_id` deve ser invariavelmente derivado da sessão ativa validada no servidor.

### REGRA 3 — NÃO PERSISTÊNCIA DE SEGREDOS EM CLARO
O `PortalToken` e o código `OTP` nunca são armazenados em texto puro. O banco de dados armazena unicamente seus hashes criptográficos (`token_hash` e `otp_hash`).

### REGRA 4 — PROTEÇÃO CONTRA BAIXA ENTROPIA DO OTP
O hash do OTP de 6 dígitos deve obrigatoriamente incluir salt/pepper server-side (ex: atrelado ao `militar_id` ou segredo de aplicação) para inviabilizar ataques de pré-computação e rainbow tables.

### REGRA 5 — SERVICE ROLE APENAS APÓS VALIDAÇÃO
O uso de `base44.asServiceRole` em backend functions do Portal é permitido unicamente após a validação completa do token e da sessão pelo Session Guard (`requirePortalSession`).

### REGRA 6 — PROJEÇÃO DTO OBRIGATÓRIA (WHITELIST)
Nenhum endpoint do Portal retornará objetos de entidade brutos do banco de dados. Todas as respostas devem ser projetadas através de DTOs com whitelist explícita de propriedades permitidas.

### REGRA 7 — ISOLAMENTO DE REGISTROS ADMINISTRATIVOS OFICIAIS
O Portal do Militar não escreve diretamente nas entidades oficiais de efetivo e férias (`Militar`, `Ferias`). As manifestações do militar são registradas em entidades intermediárias de workflow (`SolicitacaoAtualizacao`, `OpcaoFerias`), pendentes de validação e homologação por gestores autorizados.

### REGRA 8 — AUDITORIA ATÔMICA E SANITIZADA
Toda ação de autenticação, visualização e submissão deve gerar registro síncrono em `PortalAuditoria`. Informações confidenciais (CPF integral, senhas, tokens, OTPs) nunca devem ser incluídas nos registros de log.

### REGRA 9 — RATE LIMITING E PREVENÇÃO DE FORÇA BRUTA
O endpoint de desafio de autenticação deve impor limite de tentativas consecutivas incorretas (máximo 3) e bloqueio temporal em caso de excesso de falhas.

### REGRA 10 — PREVENÇÃO DE ENUMERAÇÃO DE IDENTIDADE
O endpoint de início de autenticação (`portal_auth_iniciar`) deve responder com payload indistinguível para militares existentes e inexistentes, impedindo a raspagem e confirmação da base cadastral por terceiros.

### REGRA 11 — CONTROLE DE TIMEOUT DE SESSÃO
Toda `PortalSessao` possui controle de expiração absoluta (máximo 4 horas) e expiração por inatividade / idle timeout (30 minutos).

### REGRA 12 — TELEMETRIA NÃO-AUTORIZATIVA DE IP E USER-AGENT
O endereço IP e o User-Agent do cliente devem ser coletados exclusivamente para fins de auditoria e detecção de anomalias, nunca como prova exclusiva para encerramento arbitrário de sessão legítima (ex: chaveamento de rede móvel).

### REGRA 13 — BLOQUEIO DE STACK TRACES E DETALHES INTERNOS
Nenhuma Deno function ou cliente do Portal exporá stack traces, consultas de banco ou metadados de infraestrutura em respostas de erro para o navegador.

### REGRA 14 — AUSÊNCIA DE SEGREDOS EM URL E QUERY STRINGS
Credenciais, tokens de sessão e OTPs nunca devem trafegar via parâmetros de URL (`GET ?token=...`), sendo transportados exclusivamente em headers HTTP (`X-Portal-Token` / `Authorization`).

### REGRA 15 — SEGREGAÇÃO ABSOLUTA DE ROTAS ADMINISTRATIVAS
O roteamento do Portal (`/portal/*`) permanece estritamente isolado da casca administrativa do SGP. A existência de uma sessão ativa no Portal não concede qualquer permissão às rotas do `AuthenticatedApp`.
