#!/usr/bin/env bash
# Atualiza o servidor com a versão mais recente do GitHub. As migrações do banco rodam sozinhas ao iniciar.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker compose ps
