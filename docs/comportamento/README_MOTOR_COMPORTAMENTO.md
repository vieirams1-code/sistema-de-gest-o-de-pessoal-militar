# Documentação Técnica: Motor de Sincronização de Comportamento

Este documento descreve a arquitetura, as responsabilidades e os procedimentos de manutenção do motor de cálculo de comportamento disciplinar do sistema SGP Militar.

## 1. Arquitetura Atual

O sistema de comportamento baseia-se em um motor de regras que processa o histórico de punições disciplinares e o tempo de serviço para determinar a classificação do militar (Excepcional, Ótimo, Bom, Insuficiente ou Mau) conforme o Regulamento Disciplinar.

A lógica é composta por dois pilares:
*   **Cálculo Instantâneo:** Determina o comportamento em uma data específica.
*   **Linha do Tempo/Projeção:** Reconstrói o histórico e projeta melhorias futuras com base em datas candidatas.

## 2. Fonte de Verdade Oficial

As únicas fontes de verdade oficiais para a lógica de negócio do comportamento são:

*   `src/utils/calcularComportamento.js`: Contém as constantes de pesos, regras de janelas (1, 2, 4 e 8 anos) e a lógica de enquadramento legal.
*   `src/utils/linhaTempoComportamento.js`: Contém o motor de reconstrução histórica e geração de eventos.

**Qualquer alteração na regra de negócio DEVE ser iniciada nestes arquivos.**

## 3. Arquivos Duplicados

Existe uma replicação da lógica no seguinte arquivo:

*   `base44/functions/diagnosticarLinhaTempoComportamento/entry.ts` (Deno Edge Function)

## 4. Justificativa da Duplicação

A duplicação é uma restrição técnica do ambiente de execução:
1.  As **Edge Functions (Deno)** operam em um ambiente isolado durante o deploy.
2.  Atualmente, não há suporte nativo para importar diretamente arquivos da pasta `src/` do frontend para dentro das funções Deno no processo de build/deploy.
3.  Para garantir que a ferramenta de diagnóstico administrativo funcione de forma autônoma e rápida, as constantes e funções utilitárias foram portadas para o arquivo `entry.ts`.

## 5. Riscos Conhecidos

*   **Dessincronização:** O maior risco é alterar uma regra no frontend (ex: mudar o peso de uma punição) e esquecer de atualizar a Deno Function, gerando diagnósticos divergentes do que o usuário vê na tela de Efetivo.
*   **Diferença de Runtime:** O Deno e o Navegador/Node.js podem ter comportamentos ligeiramente diferentes em parsing de datas se não forem utilizados métodos robustos (como `.getTime()`).

## 6. Procedimento Obrigatório após Alteração do Motor

Sempre que houver alteração em `src/utils/calcularComportamento.js` ou `src/utils/linhaTempoComportamento.js`:

1.  **Portabilidade:** Replicar as alterações correspondentes nas seções "CONSTANTES E REGRAS" e "UTILITÁRIOS" do arquivo `base44/functions/diagnosticarLinhaTempoComportamento/entry.ts`.
2.  **Atenção às Datas:** Garantir que o utilitário `toDate` na Deno Function continue suportando os formatos ISO e BR (DD/MM/YYYY) e que as comparações usem `.getTime()`.

## 7. Testes Obrigatórios

Antes de submeter alterações no motor, devem ser executados os seguintes testes:

*   `node --test src/services/__tests__/comportamentoService.test.js`
*   `node --test src/services/__tests__/comportamentoRPService.test.js`
*   `node --test src/utils/__tests__/comportamentoTemplateUtils.test.js`

## 8. Casos de Regressão Conhecidos

*   **Punições Anuladas/Reabilitadas:** Verificar se o filtro de status continua ignorando punições 'ANULADA' e tratando corretamente as 'REABILITADA' conforme a configuração.
*   **Regra do Art. 53 (Soldado):** A regra específica para Soldados com mais de 20 dias de prisão em separado deve ser validada prioritariamente.
*   **Data de Inclusão:** A ausência ou erro na data de inclusão deve bloquear o cálculo (inconsistência cadastral) em vez de assumir uma data padrão.

## 9. Roadmap Futuro para Eliminar Duplicação

*   **Compartilhamento de Código:** Migrar a lógica do motor para um pacote ou diretório compartilhado que possa ser injetado nas Deno Functions durante o processo de CI/CD.
*   **Build Step para Functions:** Implementar um passo de build (esbuild/bundle) para as Deno Functions que permita o uso de imports relativos à raiz do projeto.

---

**Nota Importante:**
A Deno Function (`diagnosticarLinhaTempoComportamento`):
*   **NÃO** é fonte de verdade.
*   É uma ferramenta diagnóstica para administradores.
*   **DEVE** permanecer sincronizada manualmente com o motor principal até que o Roadmap seja concluído.
