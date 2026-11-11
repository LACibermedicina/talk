#!/usr/bin/env bash
# Gera o Secret do Kubernetes com chaves novas. Uso: ./gen-secrets.sh "postgresql://..." "https://seu.dominio" | kubectl apply -f -
# GUARDE a DATA_KEY impressa em stderr num cofre: sem ela os dados cifrados são irrecuperáveis.
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: $0 <DATABASE_URL> <APP_ORIGIN>" >&2; exit 1; }
JWT=$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64); KEY=$(openssl rand -base64 32)
echo "DATA_KEY (guarde agora): $KEY" >&2
kubectl create secret generic talk-m3d-secret -n talk-m3d --dry-run=client -o yaml \
  --from-literal=DATABASE_URL="$1" --from-literal=APP_ORIGIN="$2" --from-literal=JWT_SECRET="$JWT" --from-literal=DATA_KEY="$KEY"
