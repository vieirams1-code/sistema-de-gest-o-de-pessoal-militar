#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/vieirams1-code/sistema-de-gest-o-de-pessoal-militar.git"
DEFAULT_MESSAGE="chore: publicar alterações no github para sincronizar com Base44"

resolve_current_branch() {
  git symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

CURRENT_BRANCH="$(resolve_current_branch)"
DEFAULT_BRANCH="${CURRENT_BRANCH:-main}"
BRANCH="${1:-${BASE44_PUBLISH_BRANCH:-$DEFAULT_BRANCH}}"
MESSAGE="${2:-${BASE44_PUBLISH_MESSAGE:-$DEFAULT_MESSAGE}}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Erro: execute este script dentro de um repositório git." >&2
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  echo "Erro: não foi possível determinar o branch atual. Informe o branch como parâmetro ou via BASE44_PUBLISH_BRANCH." >&2
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

ACTIVE_BRANCH="$(resolve_current_branch)"
echo "Branch alvo: ${BRANCH}"

if [[ -n "$ACTIVE_BRANCH" && "$ACTIVE_BRANCH" != "$BRANCH" ]]; then
  echo "Alternando de ${ACTIVE_BRANCH} para ${BRANCH}"
  git checkout "$BRANCH"
elif [[ -z "$ACTIVE_BRANCH" ]]; then
  echo "HEAD destacado detectado; fazendo checkout de ${BRANCH}"
  git checkout "$BRANCH"
else
  echo "Permanecendo no branch atual: ${ACTIVE_BRANCH}"
fi

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
