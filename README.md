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
2. usa o branch `work` por padrão;
3. cria commit automático se houver alterações locais;
4. faz push para o GitHub.

### Opções avançadas
Você também pode chamar o script diretamente, definindo branch e mensagem:

```bash
bash ./scripts/publish-github-base44.sh work "feat: minha alteração"
```

Após o push, qualquer integração do Base44 conectada a este repositório no GitHub pode consumir/atualizar as alterações publicadas.
