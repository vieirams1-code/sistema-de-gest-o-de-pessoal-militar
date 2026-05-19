# MODO DISCUSSÃO — D17-L
## Auditoria da cadeia de reversão de promoção publicada

> Escopo: análise sem alteração de código/schema/runtime.

## 1) Campos de ligação entre entidades

### Promocao
- `id`: chave do ato/lote.
- `status`: controla ciclo (`rascunho` -> `publicada`).
- `posto_graduacao`, `quadro`, `data_promocao`, `data_publicacao`, `boletim_referencia`, `ato_referencia`: base documental aplicada aos itens.

### PromocaoMilitar
- `promocao_id` -> `Promocao.id`.
- `militar_id` -> `Militar.id`.
- `historico_promocao_v2_id` -> `HistoricoPromocaoMilitarV2.id` (quando publicado/vinculado).
- `status`, `publicado`: estado do item da turma.
- `atualizar_cadastro_militar`, `motivo_atualizacao_cadastro`, `resultado_aplicacao_cadastro`: trilha do efeito cadastral no militar.

### HistoricoPromocaoMilitarV2
- `id`: chave do evento histórico.
- `militar_id` -> `Militar.id`.
- `promocao_id` -> `Promocao.id` (quando oriundo de publicação).
- `posto_graduacao_anterior`, `quadro_anterior`, `posto_graduacao_novo`, `quadro_novo`: delta completo da promoção.
- `status_registro` (`ativo`, `retificado`, `cancelado`) e `motivo_retificacao`: trilha de reversão/retificação.
- `origem_dado`: diferencia manual x `publicacao_promocao`.

### Militar
- `id`: referência para vínculo.
- `posto_graduacao`, `quadro`: estado atual cadastral (pode ser alterado no publish quando efeito for imediatamente superior).

---

## 2) Evidências de dados existentes após publicar

A publicação oficial já grava dados suficientes para reconstruir a cadeia:

1. **Posto/quadro anterior**: em `HistoricoPromocaoMilitarV2.posto_graduacao_anterior` e `quadro_anterior` (copiados do cadastro atual do militar no momento da publicação).
2. **Posto/quadro novo**: em `HistoricoPromocaoMilitarV2.posto_graduacao_novo` e `quadro_novo` (copiados da `Promocao`).
3. **Histórico criado/vinculado**: `PromocaoMilitar.historico_promocao_v2_id` + `HistoricoPromocaoMilitarV2.id`.
4. **Item publicado**: `PromocaoMilitar.status = publicado` e `PromocaoMilitar.publicado = true`.
5. **`promocao_id`**: presente em `PromocaoMilitar.promocao_id` e `HistoricoPromocaoMilitarV2.promocao_id`.
6. **Efeito cadastral no militar**: `PromocaoMilitar.atualizar_cadastro_militar` e `resultado_aplicacao_cadastro` permitem saber se houve update em `Militar`.

Conclusão: não há bloqueio estrutural de dados para reversão; o gap principal é de fluxo/orquestração e UX de governança.

---

## 3) Fluxo seguro de reversão (proposta arquitetural)

### Premissas operacionais
- Reversão **admin-only**.
- Reversão por **item (`PromocaoMilitar`)**, não por edição solta da ficha.
- Operação idempotente (repetir não deve degradar dados).

### Sequência recomendada (cadeia transacional lógica)
1. **Pré-checagens**
   - Item deve estar `publicado`.
   - Deve existir `historico_promocao_v2_id` ou histórico localizável por (`promocao_id`, `militar_id`, `posto/quadro/data`).
   - Bloquear se já estiver `cancelado/retificado`.

2. **Reversão do Histórico V2**
   - Preferência: `status_registro = cancelado` (ou `retificado`, conforme política).
   - Preencher `motivo_retificacao`/observação administrativa com trilha do operador e timestamp.
   - Não usar exclusão física como caminho primário.

3. **Reversão do cadastro Militar (somente se houve update no publish)**
   - Condição: `PromocaoMilitar.atualizar_cadastro_militar === true` (ou `resultado_aplicacao_cadastro = imediatamente_superior`).
   - Restaurar `Militar.posto_graduacao` e `Militar.quadro` a partir de `HistoricoPromocaoMilitarV2.posto_graduacao_anterior` e `quadro_anterior`.
   - Regra defensiva: antes de reverter, confirmar que o estado atual ainda coincide com o “novo” daquele histórico (evita desfazer atualização mais recente por engano).

4. **Reversão do item PromocaoMilitar**
   - Atualizar para `status = cancelado` (ou `retificado`), `publicado = false`.
   - Preservar `historico_promocao_v2_id` para rastreabilidade.
   - Registrar justificativa obrigatória.

5. **Recalcular status da Promocao pai**
   - Se ainda existir ao menos um item publicado: manter `Promocao.status = publicada`.
   - Se todos revertidos: mover para estado administrativo de revisão (ex.: `rascunho`/`retificada`, conforme política vigente).

6. **Invalidar caches de prévia**
   - Invalidar chaves de consulta de antiguidade/prévia geral para recomputação.
   - Sem alterar motor nem estrutura da Prévia Geral.

---

## 4) UX alvo

### Em `DetalhePromocao`
- Ação visível apenas para admin em item publicado: **“Reverter publicação”**.
- Confirmação forte:
  - checkbox + frase de confirmação;
  - motivo obrigatório.
- Aviso de impacto (cadeia explícita):
  1. Promoção publicada;
  2. Histórico V2 será cancelado/retificado;
  3. Cadastro militar pode voltar ao posto/quadro anterior;
  4. Prévia geral será recalculada/impactada.
- Pós-ação: toast com resumo do que foi revertido (histórico, militar, item, promoção pai).

### Na ficha do militar (`CarreiraAntiguidadePanel`/`PromocoesTimeline`)
Para registros de `HistoricoPromocaoMilitarV2` com `promocao_id` preenchido:
- Bloquear ação **“Corrigir cadastro”** direta.
- Mostrar aviso: “Registro gerado por promoção publicada. Alterações devem ser feitas pelo ato de promoção.”
- Exibir ação de navegação para `DetalhePromocao` correspondente quando possível.

---

## 5) Riscos e controles

### Riscos
1. **Rollback incorreto do Militar** por promoção mais nova já aplicada.
2. **Divergência entre `PromocaoMilitar` e `HistoricoV2`** em reversões parciais.
3. **Perda de auditabilidade** se usar deleção física do histórico.
4. **Prévia antiga em cache** após reversão.

### Controles mínimos
- Guardas de concorrência por checagem de estado atual antes do update.
- Log/auditoria com operador, motivo e timestamp em todos os passos.
- Operar com cancelamento lógico, não deleção, em cadeia oficial.
- Invalidação explícita das queries de prévia/antiguidade após operação.

---

## 6) Proposta de lote pequeno (MODO PRODUÇÃO)

### Lote sugerido: **D17-L-P1 (baixo risco, alto controle)**
1. **DetalhePromocao**
   - Botão admin “Reverter publicação” em item publicado.
   - Modal de confirmação forte + motivo obrigatório.
2. **Serviço de promoção**
   - Caso de uso “reverterPublicacaoPromocaoItem” com 4 etapas:
     - cancelar/retificar Histórico V2;
     - rollback condicional do Militar;
     - status do item;
     - recálculo do status da promoção pai.
3. **Ficha do militar**
   - Bloqueio de “Corrigir cadastro” para histórico com `promocao_id`.
   - Banner explicativo + deep link para promoção.
4. **Consistência de leitura**
   - Invalidação de caches de prévia/antiguidade/promoção após reversão.

### Critérios de aceite do lote
- Reverter 1 item publicado volta estado conforme esperado.
- Reversão parcial mantém promoção publicada quando houver outros itens ativos.
- Reversão total altera estado da promoção pai para revisão.
- Ficha do militar não permite correção direta de registro originado por promoção.

---

## 7) Diagnóstico objetivo do cenário reportado

No cenário “Alexandre Brites (1º Sgt -> Subtenente)”, o runtime atual já mantém os vínculos necessários para desfazer com segurança (incluindo anterior/novo, `promocao_id`, status de publicação e flag de atualização cadastral). O bloqueio atual é de governança de fluxo e de UX, não de ausência de dados.
