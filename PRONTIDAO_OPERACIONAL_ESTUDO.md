# Estudo de Prontidão Operacional

Este documento analisa os módulos de Férias, Atestados, JISO, Lotação, Funções e Cursos para definir as regras de cálculo da Prontidão Operacional dos militares.

## 1. Análise dos Módulos

### 1.1 Férias
As férias impactam a **disponibilidade imediata** do militar. Embora o militar esteja administrativamente regular, ele não pode ser empenhado em escalas ou missões durante o período de gozo.
- **Impacto:** Indisponibilidade temporária (Status: FERIAS no `statusOperacionalService`).

### 1.2 Atestados
Os atestados médicos (Afastamentos Temporários) impactam a **aptidão física/mental**. Um atestado ativo retira o militar da linha de frente.
- **Impacto:** Inaptidão temporária (Status: AFASTADO no `statusOperacionalService`).

### 1.3 JISO (Junta de Inspeção de Saúde Ordinária)
A JISO é o processo de avaliação de saúde. Enquanto uma JISO está agendada ou em processamento, a aptidão plena é incerta.
- **Impacto:** Inaptidão preventiva ou definitiva dependendo do parecer (Status: JISO no `statusOperacionalService`).

### 1.4 Lotação
A lotação define a unidade em que o militar está servindo. A ausência de lotação indica uma falha cadastral grave que impede a gestão do efetivo.
- **Impacto:** Pendência administrativa crítica.

### 1.5 Funções
As funções definem as atribuições do militar (ex: Motorista, Comandante de Guarnição). A prontidão depende de o militar estar exercendo uma função compatível com suas tags e cursos.
- **Impacto:** Restrição operacional se houver incompatibilidade.

### 1.6 Cursos
Cursos e especializações (registrados via Sistema de Tags) validam a capacidade técnica para o exercício de funções específicas.
- **Impacto:** Restrição operacional se o militar não possuir o curso exigido para a função que ocupa.

---

## 2. Regras de Cálculo de Status

A prontidão operacional deve ser calculada combinando o `statusOperacionalService` (disponibilidade), `militarAuditoriaService` (integridade de dados) e o sistema de `Tags` (restrições e cursos).

### APTO
O militar é considerado **APTO** quando cumpre TODOS os requisitos abaixo:
1. **Disponibilidade:** O status retornado pelo `determinarStatusOperacional` deve ser `DISPONIVEL`.
2. **Saúde:** Não possuir atestados vigentes ou JISO agendada.
3. **Tags de Restrição:** Não possuir nenhuma tag ativa vinculada a grupos de "Restrição Médica" ou "Restrição Administrativa".
4. **Integridade:** Score de auditoria superior a 85% e zero pendências críticas.

### INAPTO
O militar é considerado **INAPTO** quando:
1. **Afastamento Médico:** Possuir atestado médico vigente (`isAtestadoVigente`).
2. **JISO:** Estar com JISO agendada para o dia ou com parecer final de "Inapto".
3. **Licença Saúde:** Estar em Licença para Tratamento de Saúde (LTS).

### RESTRITO
O militar é considerado **RESTRITO** quando está disponível para o serviço, mas com limitações:
1. **Restrições de Saúde:** Possuir tags ativas de restrição (ex: "Não pode carregar peso", "Serviço interno").
2. **Falta de Especialização:** Ocupar uma função que exige curso específico (ex: Motorista de Emergência) sem possuir a tag do curso correspondente.
3. **Condição Administrativa:** Em gozo de Férias ou Licença Prêmio (está apto, mas restrito por indisponibilidade administrativa).

### PENDENTE
O militar é considerado **PENDENTE** quando há falhas na sua ficha que impedem a avaliação de prontidão:
1. **Dados Críticos:** Ausência de Lotação, CPF, Matrícula ou Posto/Graduação (conforme `completudeMilitarService`).
2. **Vencimentos:** Cursos ou certificações obrigatórias com data de validade vencida.
3. **Auditoria:** Score de auditoria abaixo de 50%.

---

## 3. Matriz de Prioridade para Prontidão

| Status Operacional | Restrições (Tags) | Auditoria (Dados) | **Status Prontidão Final** |
|-------------------|-------------------|-------------------|---------------------------|
| DISPONIVEL        | Nenhuma           | Sem Críticos      | **APTO**                  |
| AFASTADO/JISO     | Qualquer          | Qualquer          | **INAPTO**                |
| DISPONIVEL        | Médica/Adm        | Qualquer          | **RESTRITO**              |
| FERIAS/LICENCA    | Nenhuma           | Qualquer          | **RESTRITO** (Adm)        |
| Qualquer          | Qualquer          | Com Críticos      | **PENDENTE**              |

---

## 4. Conclusão

Para implementar estes cálculos no sistema, recomenda-se a criação de um novo serviço `militarProntidaoService.js` que consuma os resultados dos serviços existentes e aplique a lógica acima, garantindo que a "Visão de Comando" no Dashboard reflita a capacidade real de empenho da tropa.
