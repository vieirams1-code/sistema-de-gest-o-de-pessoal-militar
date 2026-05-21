# T10-B — MVP de lint de template no salvar (sem metadata persistida)

## Escopo e restrições
- Validar placeholders `{{variavel}}` no momento do **salvar** do template.
- Não alterar schema.
- Não alterar entidade `TemplateTexto`.
- Não persistir metadata/lint em banco nesta fase.

## Arquitetura proposta

### 1) Camada nova: `templateValidation` (regra pura)
Adicionar funções puras em `src/components/rp/templateValidation.js` (ou helper irmão) para:
- extrair variáveis do template (`/{{\s*([\w.]+)\s*}}/g`);
- resolver catálogo de contrato por tipo_template;
- classificar achados em `ERRO | ALERTA | INFO`;
- retornar relatório único para UI consumir.

Contrato de retorno sugerido:

```js
{
  ok: boolean,
  summary: { erros: number, alertas: number, infos: number },
  findings: [
    {
      severity: 'ERRO' | 'ALERTA' | 'INFO',
      code: 'VAR_DESCONHECIDA' | 'VAR_ALIAS' | 'VAR_DUPLICADA' | 'VAR_OBRIGATORIA_AUSENTE' | 'TEMPLATE_VAZIO',
      variavel: 'nome_completo',
      message: '...'
    }
  ],
  normalizedVars: ['nome_completo', 'posto_nome']
}
```

### 2) Matriz mínima de contrato (in-memory)
Criar estrutura estática (constante em código) por `tipo_template`:
- `obrigatorias: string[]`
- `opcionais: string[]`
- `aliases: Record<string, string>` (alias -> canônica)

Exemplo:

```js
const TEMPLATE_VAR_CONTRACT = {
  'Saída Férias': {
    obrigatorias: ['nome_completo', 'posto_nome', 'matricula', 'data_inicio'],
    opcionais: ['dias', 'periodo_aquisitivo', 'quadro'],
    aliases: {
      posto: 'posto_nome',
      nome: 'nome_completo',
      data_saida: 'data_inicio'
    }
  }
}
```

### 3) Mapeamento de severidade
- **ERRO**
  - variável não pertence a `obrigatorias + opcionais + aliases`;
  - template vazio;
  - obrigatória ausente.
- **ALERTA**
  - variável via alias (funciona, mas recomenda migração para canônica);
  - duplicidade excessiva (ex.: variável aparece muitas vezes).
- **INFO**
  - variável opcional usada;
  - resumo de normalização aplicada.

### 4) Fluxo de uso na UI (save-time)
1. Usuário clica em salvar.
2. Rodar lint local com base em `tipo_registro` + `template`.
3. Se houver `ERRO`: bloquear persistência e exibir lista.
4. Se houver apenas `ALERTA/INFO`: permitir persistir, exibindo feedback.

## Impacto por módulo

### `TiposPublicacaoManager`
- Hoje já valida apenas `nome/template` não vazios.
- MVP: antes de `create/update`, rodar o lint.
- Como esse manager cria tipos customizados, usar **contrato default permissivo** quando tipo não existir na matriz:
  - sem obrigatórias;
  - tudo vira `ALERTA`/`INFO` (nunca bloquear por desconhecida nesse contexto) **ou** feature-flag para bloquear só tipos oficiais.

### `TemplatesTexto`
- É o ponto principal para CRUD de `TemplateTexto`.
- Injetar lint no submit de criar/editar template.
- UX mínima:
  - painel/lista de findings por severidade;
  - bloqueio apenas em `ERRO`;
  - `ALERTA/INFO` não bloqueiam.

### `templateValidation`
- Centralizar regras puras para evitar divergência entre telas.
- Reaproveitar normalizações já existentes (`resolveTipoRegistroTemplate`, `normalizarModulo`, etc.) para casar o `tipo_template` com a matriz.

## Lote mínimo seguro (MVP)
1. Criar constante de contrato com 3–5 tipos críticos (férias + atestado + comportamento).
2. Implementar `lintTemplateOnSave({ tipoRegistro, modulo, template })` em regra pura.
3. Conectar **somente em `TemplatesTexto`** no submit (bloqueio por erro).
4. Exibir relatório simples (lista textual por severidade).
5. Cobrir com testes unitários de lint (desconhecida, obrigatória ausente, alias, sucesso).

> Justificativa: reduz risco operacional onde o template oficial nasce/edita, sem tocar schema e sem alterar entidade.

## Sem alterar schema / sem alterar `TemplateTexto`
- Nenhum campo novo, nenhuma migração.
- Sem persistência de findings.
- Relatório existe apenas em memória durante o submit.

## Decisões de risco
- **Fail-closed** para tipos com contrato explícito (erros bloqueiam).
- **Fail-open controlado** para tipos sem contrato (não bloquear no MVP; emitir alerta de “contrato ausente”).
- Evita quebrar templates legados enquanto amplia gradualmente a matriz.
