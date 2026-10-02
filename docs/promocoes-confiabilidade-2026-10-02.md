# Confiabilidade de Promoções — 02/10/2026

Checkpoint anterior: 6abfc8af0461961ef8982ad1 (95ece72f82dc5798f474d6a05488ca93400623f9).

## Comportamento implementado

- Publicação relê promoção e itens no servidor, confirma o vínculo com histórico antes de aplicar o cadastro e exige data válida e já vigente em MS.
- Ingresso como Soldado abre a carreira sem posto/quadro/referência anterior.
- Cadastro superior, com evento posterior ou com data cadastral posterior é preservado.
- Atualização cadastral usa updateMany com precondições sobre os valores anteriores e token de operação.
- Publicação, manutenção documental e reversão compartilham trava persistida em Promocao. A aplicação cadastral e a reversão compartilham trava persistida em Militar.
- As travas não expiram automaticamente: interrupção do processo ou falha de compensação exige reconciliação antes da liberação. Isso impede retomada cega.
- Journal em AssistenteLog guarda a fotografia anterior antes das escritas; os campos de auditoria foram incorporados ao schema.
- Item guarda cadastro_anterior_promocao para reversão exata, inclusive aliases.
- Reversão confere a cadeia, bloqueia evento posterior ou conflitante e usa dados autoritativos para o status do lote.
- Reversão de registros legados que aplicaram cadastro sem snapshot exato é bloqueada para revisão; não se presume que o histórico anterior equivale ao cadastro anterior.
- Falhas em criação de histórico ou confirmação do vínculo acionam compensação, mantendo histórico cancelado como trilha.
- Resposta perdida em atualização cadastral é distinguida de falha por releitura.
- Falha na consolidação do lote informa itens já aplicados; repetir a chamada reconcilia sem duplicar.
- CRUD genérico não altera os fatos de uma publicação oficial nem seus tokens/snapshots.
- Manutenção envia somente campos alterados e verifica valores anteriores, preserva atos/boletins contra dados vazios e não modifica cadastro militar.
- Mudança de posto, quadro ou vigência de publicação existente exige fluxo de retificação; manutenção documental não executa essa alteração estrutural.

## Verificação

scripts/promocao-confiabilidade.test.mjs executa handlers TypeScript reais em ambiente simulado, com SDK substituído por armazenamento em memória e injeção de falhas antes/depois da gravação. Inclui duas instâncias isoladas usando o mesmo armazenamento.

Esses testes foram incorporados a test:unit. Não se fez teste mutante em militares de produção. Não foram realizadas alterações cadastrais nem saneamento produtivo nesta etapa.

Compilação Vite e lint da tela alterada aprovados. Lint geral encontrou import Printer não utilizado em PainelPlanoFeriasV2, fora do escopo.

## Limites operacionais

As operações entre entidades são coordenadas com precondições, auditoria e compensação. Não são uma transação ACID entre múltiplas entidades. Os testes de falhas e concorrência usam o contrato documentado do SDK; não substituem uma homologação da UI e do runtime com uma base de testes separada.

Para reconciliar uma operação interrompida, verificar tokens da promoção/militar, journal, vínculo, histórico e cadastro. Liberar tokens somente após confirmar o estado coerente ou restaurar a operação; nunca remover a trava apenas por tempo decorrido.

Atos oficiais ausentes e regras institucionais de antiguidade pendentes permanecem sujeitos a comprovação/homologação. Essas mudanças não inventam dados nem homologam snapshots de antiguidade.

Resultado final: 103/103 testes direcionados; 568 testes Node gerais (564 aprovados, 4 falhas em JISO/Planos de Férias); 70/70 testes Vitest. Compilação e lint da tela alterada aprovados.

## Continuação: concorrência na reversão e tentativa de homologação

Checkpoint inicial desta continuação: 6abfd4bfd23620e15578e82a (cb8f877348566031924d47d0e8367b8e1c84023a).

A reversão passa a gravar journal obrigatório em AssistenteLog antes da primeira alteração. O snapshot de restauração aceita somente campos de posto/quadro e aliases; outros campos não são aplicados.

A restauração cadastral e sua compensação usam updateMany com token e precondições sobre todos os campos envolvidos. A compensação da aplicação cadastral usa o mesmo controle. Edição concorrente entre leitura e gravação é preservada; se a compensação não puder ser confirmada, a trava permanece para reconciliação.

Validação desta continuação: 29/29 testes de confiabilidade, incluindo seis regressões novas; conjunto ampliado com Promoções, Antiguidade e barreiras de permissão: 148/149 aprovados. A falha foi o teste preexistente de JISO (nome canViewJisoAgenda esperado no código). Helpers de aplicação comparados e idênticos; git diff --check sem erros. Não houve mudança de frontend nesta continuação.

A sondagem somente de leitura pelo CLI base44 exec --data-env dev não executou o script: o CLI solicitou login por dispositivo. O processo foi encerrado. O conector consegue consultar entidades, mas não oferece invocação de funções nesta sessão. Nenhum registro de homologação foi criado e nenhum cadastro real foi alterado por esta etapa. A separação da base dev e o ciclo completo no runtime continuam sem homologação.
