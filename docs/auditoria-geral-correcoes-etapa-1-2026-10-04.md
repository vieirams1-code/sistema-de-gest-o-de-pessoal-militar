# Correções da auditoria geral — etapa 1 — 04/10/2026

Base anterior: `899140bcce4d869e59c5057b2b042b078a8dd6a0`.
Checkpoint anterior: `6ac2c9709b5cc12f9ed80aa0` — Antes das correções da auditoria geral — segurança e sessões — 04-10-2026.

## Comportamento resultante

- Leitura direta de Militar, Atestado, CampanhaPortal e RespostaCampanhaPersonalizada exige papel Base44 autenticado `admin` ou `user`. Retirada a condição vazia de leitura de Atestado. Preservados os campos e demais regras dos schemas.
- Trata-se de contenção da exposição anônima de SGP-001. O acesso por unidade/capacidade dos usuários autenticados ainda precisa da migração dos consumidores diretos para gateways. Não declarar SGP-001 totalmente concluída.
- SGP-003: sessões verificam os campos canônicos e o legado `expires_at`; o prazo mais restritivo prevalece. Prazo ausente, inválido ou atingido falha fechado. A negativa permanece 401 mesmo quando a persistência da expiração falha. Sessões legadas com prazo futuro são aceitas sem estender sua duração. Sessões sem prazo precisarão de novo login.
- Parte de SGP-005: os dois caminhos de emissão gravam `token_expires_at` e `absolute_expires_at`, mantendo `expires_at` por compatibilidade. Falha na gravação retorna 503, sem token nem auditoria de sucesso. OTP com prazo malformado/atingido é recusado.
- SGP-007: erro HTTP/rede no transporte direto não dispara nova execução pelo SDK. O SDK continua sendo usado quando o transporte direto não está disponível. Idempotência dos comandos no servidor continua sendo necessária (SGP-008 e operações concorrentes).
- Não houve alteração de normas de férias, ações administrativas de campanhas ou dados cadastrais. O modo provisório CPF + matrícula não foi desativado nesta etapa: precisa de substituto de acesso funcional e da revisão prevista em SGP-004.

## Verificação

`npm run test:portal-security`: 28 testes, 28 aprovados. Antes da correção, após validar o harness, 19 dos 28 falhavam. Testes executam os módulos reais, handlers compilados com esbuild e SDK/armazenamento simulados; os testes de RLS são contratos locais, complementados pela sonda remota. Não substituem homologação com todos os perfis.

`npm run test:unit`: 622 testes, 619 aprovados, 3 falhos — mesmos casos textuais de Portal/Plano de Férias presentes na auditoria anterior.
`npm run test:vitest`: 70 testes aprovados em 15 arquivos.
`npm run lint` e `npm run build`: código 0.
Typecheck não foi repetido: a baseline da auditoria registra 6.058 diagnósticos ainda pendentes.

Verificação extra dos três arquivos antigos portalSecurity, portalAuth e portalCrypto: 53 testes, 49 aprovados e 4 falhos. A execução da mesma seleção em um diretório temporário com o commit anterior reproduziu as mesmas quatro falhas (casos 6, 7, 23 e 28 de portalAuth), sem modificar o app. Esses arquivos não estavam incluídos integralmente no comando padrão. A divergência entre expectativas de provedores/configuração e a implementação deve ser tratada em SGP-019; os testes não foram relaxados para obter resultado verde.

Sondas GET sem cookies e sem Authorization, limit=1: as quatro entidades passaram a retornar HTTP 200 com lista vazia (antes retornavam um registro cada). Status 200 sozinho não significa liberação; a validação relevante é ausência dos registros antes expostos. Nenhum valor pessoal foi incluído nos logs de teste.

## Pendências de segurança e publicação

Acesso por ID/filtro e perfis deve permanecer no roteiro de verificação. Anexos já publicados ainda precisam de política privada e migração segura (SGP-002). Restrição entre unidades permanece pendente. Não considerar o sistema integralmente protegido por esta etapa.

As alterações de schemas e backend no sandbox são sincronizadas automaticamente pelo Base44; frontend foi compilado com sucesso, mas a versão pública completa precisa ser conferida no ciclo de publicação do app. Não foi executado comando manual de deploy ou push. GitHub é conferido após o checkpoint.

## Recuperação

Checkpoint preserva o estado anterior do código; ele não é backup integral dos registros. Para falhas de compatibilidade, preferir correção adiante mantendo o bloqueio anônimo. Não reabrir RLS como rollback padrão de uma tela. O cliente HTTP antigo poderia repetir comandos; se for necessário recuperar frontend, manter a prevenção de repetição. Nenhum reset, exclusão em massa ou restauração de registros foi executado.

Próxima etapa: anexos privados e escopo dos gateways de Sargenteação, seguida da revisão operacional da autenticação provisória, limites globais e concorrência dos comandos.
