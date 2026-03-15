# Manual Operacional de Acessos — SGP Militar

## 1) Visão geral da arquitetura de acesso
O SGP Militar trabalha com **duas camadas complementares**: entrada no sistema e autorização interna.

### Base44 (autenticação)
O **usuário do Base44** é a identidade que permite entrar no aplicativo (login).
- Controla credenciais e sessão de acesso.
- Não define, sozinho, o que a pessoa pode ver ou fazer no SGP.

### SGP (autorização interna)
Dentro do SGP, o acesso funcional é controlado por dois elementos:

1. **UsuarioAcesso**
   - Registro interno que define escopo organizacional e nível de atuação do usuário.
   - Determina o tipo de acesso (admin, setor, subsetor, próprio/sem setor).
   - É onde se aplicam permissões por módulo (`acesso_*`) e ações sensíveis (`perm_*`).

2. **PerfilPermissao**
   - Conjunto reutilizável de permissões.
   - Facilita padronização de papéis (ex.: administrativo, comando, RH, consulta).

### Como as camadas se relacionam
1. O usuário entra via **Base44**.
2. O SGP busca o **UsuarioAcesso** correspondente.
3. O sistema aplica permissões do **PerfilPermissao** (quando vinculado).
4. Ajustes finos em `acesso_*` e `perm_*` complementam o perfil.

> Em resumo: **Base44 autentica**; **SGP autoriza**.

---

## 2) Como cadastrar um novo usuário
Use o fluxo abaixo para reduzir falhas de acesso:

1. **Convidar/criar usuário no Base44**
   - Garanta que o e-mail/identificador esteja correto.
   - Confirme que o usuário consegue concluir o primeiro login.

2. **Criar ou editar o UsuarioAcesso no SGP**
   - Localize o usuário recém-criado.
   - Crie o registro interno se ainda não existir.

3. **Definir o tipo de acesso**
   - Escolha entre admin, setor, subsetor ou próprio/sem setor.

4. **Vincular militar (quando for modo próprio)**
   - Em acesso próprio, associe o usuário ao militar correto.
   - Sem esse vínculo, o usuário pode entrar, mas não localizar seu próprio registro.

5. **Aplicar PerfilPermissao**
   - Selecione um perfil padrão adequado à função.

6. **Ajustar permissões finas (se necessário)**
   - Complemente ou restrinja permissões por módulo (`acesso_*`).
   - Ajuste ações sensíveis (`perm_*`) apenas quando houver justificativa.

7. **Testar acesso**
   - Validar visualização de módulos esperados.
   - Validar execução de ações críticas previstas para o papel.

---

## 3) Tipos de acesso

### Admin
- Maior abrangência organizacional e funcional.
- Indicado para gestão global, suporte avançado e administração do sistema.
- Deve ser concedido com critério e controle.

### Setor
- Acesso concentrado no setor vinculado.
- Usuário atua nos processos da unidade/setor definido.

### Subsetor
- Escopo mais restrito que setor.
- Indicado para equipes específicas dentro de uma estrutura maior.

### Próprio / sem setor
- Acesso individual, normalmente focado no próprio militar.
- Requer vínculo correto do usuário ao cadastro do militar.

---

## 4) Perfis de permissão (PerfilPermissao)

### O que são
São **modelos prontos de permissões** reutilizáveis para acelerar configuração e manter padrão entre usuários com funções semelhantes.

### Como aplicar
1. Defina o tipo de acesso e escopo organizacional.
2. Selecione o perfil mais aderente à função real do usuário.
3. Salve e teste imediatamente com o usuário.

### Quando ajustar manualmente após o perfil
Faça ajuste manual apenas quando houver:
- necessidade excepcional do cargo;
- restrição pontual por política interna;
- divergência entre perfil padrão e operação real da unidade.

> Prática recomendada: perfil primeiro, ajuste fino depois.

---

## 5) Modo admin

### O que é
É uma condição de operação administrativa com privilégios elevados para operações críticas.

### Por que existe
- Proteger funcionalidades sensíveis contra uso acidental.
- Exigir confirmação operacional para tarefas de maior impacto.

### Quando ações críticas exigem ativação explícita
Sempre que a ação envolver risco elevado, como:
- mudança estrutural de acesso/permissões;
- operações administrativas críticas;
- alterações com impacto amplo em dados e governança.

---

## 6) Boas práticas de administração de acessos
- **Não conceder acesso total sem necessidade.**
- **Preferir perfis prontos** para manter padrão e reduzir erro manual.
- **Revisar escopo organizacional** (setor/subsetor/próprio) antes de liberar módulos.
- **Testar com o usuário** logo após configurar.
- **Evitar editar permissões diretamente em dados legados** sem validar impacto.
- Registrar justificativas para exceções de permissão.
- Revisar acessos periodicamente (auditoria de privilégios).

---

## 7) Troubleshooting rápido

### Problema: usuário entra, mas não vê módulo
Verificar:
- se existe `UsuarioAcesso` ativo;
- se há permissões `acesso_*` para o módulo;
- se o tipo de acesso e escopo estão coerentes com a área.

### Problema: usuário vê módulo, mas não executa ação
Verificar:
- permissões de ação sensível `perm_*`;
- necessidade de modo admin para operação crítica;
- possíveis restrições específicas aplicadas após perfil.

### Problema: usuário próprio não encontra o próprio registro
Verificar:
- vínculo correto entre usuário e militar;
- tipo de acesso configurado como próprio/sem setor;
- inconsistência de cadastro (identificador divergente).

### Problema: admin secundário não acessa determinada área
Verificar:
- escopo organizacional efetivamente atribuído;
- perfil aplicado e ajustes finos que possam restringir a área;
- exigência de ativação explícita de modo admin para a função.

### Problema: perfil aplicado não reflete como esperado
Verificar:
- se o perfil foi salvo/aplicado corretamente;
- se houve sobrescrita manual posterior;
- se o usuário precisa encerrar e iniciar sessão novamente.

---

## Checklist final (recomendado)
Antes de concluir liberação de acesso:
- Login Base44 validado.
- UsuarioAcesso criado e ativo.
- Tipo de acesso correto.
- Escopo organizacional correto.
- PerfilPermissao aplicado.
- Ajustes finos documentados.
- Teste funcional realizado com o usuário.
