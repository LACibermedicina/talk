#!/usr/bin/env bash
# Atalho opcional: gera o .env com segredos novos e sobe os contêineres. Sem ele, basta `docker compose up -d --build` e abrir o endereço: o assistente do primeiro acesso faz a configuração.
set -euo pipefail
cd "$(dirname "$0")/.."
falta() { echo "Falta instalar: $1"; exit 1; }
command -v docker >/dev/null || falta docker
docker compose version >/dev/null 2>&1 || falta "docker compose (plugin)"
command -v openssl >/dev/null || falta openssl
if [ -f .env ]; then echo "Já existe um .env. Apague-o se quiser recomeçar (guarde antes a DATA_KEY!)."; else
  read -rp "Domínio do sistema (ex.: m3d.exemplo.com.br): " DOMAIN
  read -rsp "DATABASE_URL do Neon (termina com ?sslmode=require; a digitação fica oculta): " DB; echo
  case "$DB" in postgres://*|postgresql://*) ;; *) echo "A DATABASE_URL precisa começar com postgres://"; exit 1;; esac
  umask 077
  cat > .env <<ENV
DOMAIN=$DOMAIN
APP_ORIGIN=https://$DOMAIN
TZ=${TZ:-America/Sao_Paulo}
DATABASE_URL=$DB
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
DATA_KEY=$(openssl rand -base64 32 | tr -d '\n')
AUTO_MIGRATE=true
ENV
  echo; echo "ATENÇÃO: copie agora a linha DATA_KEY do arquivo .env para um cofre de senhas."
  echo "Sem ela os dados cifrados (mensagens, notas, prontuário) não podem ser recuperados."; read -rp "Já guardei a DATA_KEY. Pressione Enter para continuar. " _
fi
docker compose up -d --build
echo; echo "Aguardando o código de instalação..."
for _ in $(seq 1 60); do c=$(docker compose logs app 2>&1 | grep -m1 'INSTALAÇÃO' || true); [ -n "$c" ] && break; sleep 2; done
echo "${c:-Código não encontrado ainda: rode  docker compose logs app | grep INSTALAÇÃO}"
echo; echo "Abra https://$(grep ^DOMAIN= .env | cut -d= -f2) e siga o assistente de instalação."
