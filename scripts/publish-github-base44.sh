#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/vieirams1-code/sistema-de-gest-o-de-pessoal-militar.git"
BRANCH="${1:-work}"
MESSAGE="${2:-chore: publicar alterações no github para sincronizar com Base44}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Erro: execute este script dentro de um repositório git." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Configurando remoto origin para ${REPO_URL}"
  git remote add origin "$REPO_URL"
fi

CURRENT_REMOTE="$(git remote get-url origin)"
if [[ "$CURRENT_REMOTE" != "$REPO_URL" ]]; then
  echo "Atualizando remoto origin para ${REPO_URL}"
  git remote set-url origin "$REPO_URL"
fi

echo "Branch alvo: ${BRANCH}"
git checkout "$BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Criando commit com alterações locais..."
  git add -A
  git commit -m "$MESSAGE"
else
  echo "Sem alterações locais para commit."
fi

echo "Publicando no GitHub..."
git push -u origin "$BRANCH"

echo "Concluído. Se o Base44 estiver conectado ao GitHub deste repositório, ele receberá as alterações publicadas."
