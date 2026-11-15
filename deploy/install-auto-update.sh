#!/usr/bin/env bash
# Liga a atualização automática no VPS (rodar UMA vez, como root): confere o GitHub a cada 2 minutos.
# Uso: bash /var/www/talk/deploy/install-auto-update.sh        (remover: bash install-auto-update.sh --remover)
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/talk}"; CRON="${CRON:-/etc/cron.d/talk-auto-update}"; LOG="${LOG:-/var/log/talk-auto-update.log}"
[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }
if [ "${1:-}" = "--remover" ]; then rm -f "$CRON"; echo "✔ atualização automática desligada"; exit 0; fi
[ -f "$APP_DIR/deploy/auto-update.sh" ] || { echo "Não achei $APP_DIR/deploy/auto-update.sh (faça git pull antes)."; exit 1; }
chmod +x "$APP_DIR/deploy/auto-update.sh"; touch "$LOG"
cat > "$CRON" <<C
# Talk.M3D: busca o GitHub a cada 2 minutos e atualiza sozinho se houver versão nova
*/2 * * * * root APP_DIR=$APP_DIR $APP_DIR/deploy/auto-update.sh >> $LOG 2>&1
0 4 * * 0 root tail -n 500 $LOG > $LOG.tmp && mv $LOG.tmp $LOG
C
chmod 644 "$CRON"; systemctl reload cron 2>/dev/null || systemctl reload crond 2>/dev/null || service cron reload 2>/dev/null || true
echo "✔ atualização automática ligada (a cada 2 min). Acompanhe: tail -f $LOG"
echo "  Rodar agora: $APP_DIR/deploy/auto-update.sh   |   Desligar: bash $APP_DIR/deploy/install-auto-update.sh --remover"
