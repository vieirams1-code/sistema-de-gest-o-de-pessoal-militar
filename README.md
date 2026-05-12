# Base44 App

## Publicação automática no GitHub (sincronizar com Base44)

Este projeto inclui um script para publicar alterações automaticamente no repositório GitHub conectado ao Base44.

### Pré-requisitos
- Estar autenticado no GitHub no terminal (via `gh auth login` ou credenciais HTTPS/token).

### Comando rápido
```bash
npm run publish:base44
```

Esse comando:
1. garante o remoto `origin` em `https://github.com/vieirams1-code/sistema-de-gest-o-de-pessoal-militar.git`;
2. usa o branch `main` por padrão;
3. cria commit automático se houver alterações locais;
4. faz push para o GitHub.

### Opções avançadas
Você também pode chamar o script diretamente, definindo branch e mensagem:

```bash
bash ./scripts/publish-github-base44.sh main "feat: minha alteração"
```

Após o push, qualquer integração do Base44 conectada a este repositório no GitHub pode consumir/atualizar as alterações publicadas.

## Sincronização de entidades Base44

O comando `npm run publish:base44` apenas publica o código no GitHub: ele cria commit automático quando houver alterações locais e executa `git push` para o branch configurado. Ele não sincroniza explicitamente novas entidades no Base44.

Quando forem criadas ou alteradas entidades, execute um dos comandos abaixo para sincronizá-las com o Base44:

```bash
npm run entities:push
```

ou, para executar o deploy completo do Base44:

```bash
npm run deploy:base44
```

Se o projeto estiver usando a integração GitHub/Base44, publique as alterações no branch monitorado pelo Base44, normalmente `main`, para que a integração consuma a versão correta do repositório.

## Documentação de produto

- Análise e proposta de simplificação da gestão de períodos aquisitivos: `docs/analise-gestao-periodos-aquisitivos.md`.
