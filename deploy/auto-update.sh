#!/usr/bin/env bash
# Atualização automática do Talk.M3D no VPS (PM2). Roda pelo cron (veja install-auto-update.sh).
# A cada execução: busca o GitHub; se houver commit novo na branch, atualiza o código, instala dependências
# (só se package*.json mudou), reinicia o app e confere /api/health. Se o app não subir, volta para a versão anterior.
# Variáveis: APP_DIR (/var/www/talk), PM2_NOME (talk), BRANCH (main), PORTA (lê /etc/talk-deploy.conf ou .env; padrão 7012)
set -uo pipefail
APP_DIR="${APP_DIR:-/var/www/talk}"; PM2_NOME="${PM2_NOME:-talk}"; BRANCH="${BRANCH:-main}"
for d in /root/.nvm/versions/node/*/bin /usr/local/bin /usr/local/n/versions/node/*/bin; do [ -d "$d" ] && PATH="$PATH:$d"; done; export PATH
exec 9>"${LOCK:-/tmp/talk-auto-update.lock}"; command -v flock >/dev/null && { flock -n 9 || exit 0; }
log() { echo "$(date '+%F %T') $*"; }
cd "$APP_DIR" 2>/dev/null || { log "pasta $APP_DIR não existe"; exit 1; }
git fetch -q origin "$BRANCH" 2>/dev/null || { log "sem acesso ao GitHub agora (vou tentar de novo)"; exit 0; }
OLD="$(git rev-parse HEAD)"; NEW="$(git rev-parse "origin/$BRANCH")"
[ "$OLD" = "$NEW" ] && exit 0
if ! git diff --quiet || ! git diff --cached --quiet; then log "há alterações locais no servidor; atualização automática pausada (git status)"; exit 1; fi
pk() { git rev-parse "$1:package.json" "$1:package-lock.json" 2>/dev/null | tr '\n' ' '; }
PK_OLD="$(pk HEAD)"
log "atualizando ${OLD:0:7} -> ${NEW:0:7}"
git merge -q --ff-only "origin/$BRANCH" || { log "não foi possível avançar (histórico divergente); nada alterado"; exit 1; }
deps() { if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1 || npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1; else npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1; fi; }
[ "$PK_OLD" != "$(pk HEAD)" ] && { log "dependências mudaram: instalando"; deps || log "aviso: instalação de dependências falhou"; }
if [ -z "${PORTA:-}" ]; then PORTA="$(sed -n 's/^PORTA=//p' /etc/talk-deploy.conf 2>/dev/null | head -1)"; fi
[ -z "${PORTA:-}" ] && PORTA="$(sed -n 's/^PORT=//p' .env 2>/dev/null | head -1)"; PORTA="${PORTA:-7012}"
subir() { pm2 restart "$PM2_NOME" --update-env >/dev/null 2>&1 || pm2 start src/server.js --name "$PM2_NOME" >/dev/null 2>&1; }
saudavel() { for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 3; curl -fsS -m 5 "http://127.0.0.1:${PORTA}/api/health" >/dev/null 2>&1 && return 0; done; return 1; }
subir
if saudavel; then log "✔ atualizado e respondendo na porta $PORTA"; exit 0; fi
log "✘ o app não respondeu depois da atualização; voltando para ${OLD:0:7}"
git reset -q --hard "$OLD"; [ "$PK_OLD" != "$(pk HEAD)" ] && deps; subir
saudavel && log "↩ versão anterior restaurada" || log "✘ ainda sem resposta: veja 'pm2 logs $PM2_NOME'"
exit 1
