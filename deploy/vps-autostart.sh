#!/usr/bin/env bash
# Faz o Talk.M3D voltar sozinho depois de reiniciar o servidor (Postgres, Nginx e app via PM2/systemd). Seguro rodar mais de uma vez.
# Uso (como root, na pasta do app):  bash deploy/vps-autostart.sh
set -u
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"; PM2_NOME="${PM2_NOME:-talk}"; PORTA="${PORT:-}"
[ "$(id -u)" = 0 ] || { echo "Rode como root (sudo bash deploy/vps-autostart.sh)"; exit 1; }
command -v pm2 >/dev/null || { echo "pm2 não encontrado. Instale: npm i -g pm2"; exit 1; }
cd "$APP_DIR" || exit 1
# porta = a que o Nginx usa (mesma regra do auto-update); NUNCA assumir 3000
[ -z "$PORTA" ] && PORTA="$(sed -n 's/^PORTA=//p' /etc/talk-deploy.conf 2>/dev/null | head -1)"
[ -z "$PORTA" ] && PORTA="$(grep -Eo 'proxy_pass +http://(127\.0\.0\.1|localhost):[0-9]+' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | grep -i -m1 talk | grep -Eo '[0-9]+$')"
[ -z "$PORTA" ] && PORTA="$(sed -n 's/^PORT=//p' .env 2>/dev/null | head -1)"
PORTA="${PORTA:-7012}"; echo "• Porta do app: $PORTA"
# dono atual do processo no PM2 (se já roda como outro usuário, não duplicar)
if pm2 jlist 2>/dev/null | grep -q "\"name\":\"$PM2_NOME\""; then echo "• Processo $PM2_NOME existente será recriado"; fi
echo "• Ligando serviços na inicialização do sistema"
for s in postgresql nginx cron; do systemctl enable "$s" >/dev/null 2>&1 && echo "  ✔ $s habilitado" || echo "  - $s não encontrado (ignorado)"; done
echo "• Subindo o app com reinício automático (ecosystem.config.cjs)"
pm2 delete "$PM2_NOME" >/dev/null 2>&1
PORT="$PORTA" pm2 start ecosystem.config.cjs >/dev/null 2>&1 || { echo "✘ pm2 não conseguiu iniciar. Veja: pm2 logs $PM2_NOME"; exit 1; }
pm2 save >/dev/null 2>&1
echo "• Registrando o PM2 no systemd"
pm2 unstartup systemd >/dev/null 2>&1 || true
env PATH="$PATH" pm2 startup systemd -u root --hp /root >/dev/null 2>&1 && echo "  ✔ pm2-root.service criado" || echo "  ✘ falhou: rode 'pm2 startup' e execute o comando que ele imprimir"
# o app só sobe depois do banco
mkdir -p /etc/systemd/system/pm2-root.service.d
printf '[Unit]\nAfter=network-online.target postgresql.service\nWants=network-online.target\n' > /etc/systemd/system/pm2-root.service.d/talk.conf
systemctl daemon-reload; systemctl enable pm2-root >/dev/null 2>&1
pm2 save >/dev/null 2>&1
sleep 4
curl -fsS "http://127.0.0.1:${PORTA}/api/health" >/dev/null && echo "✔ app respondendo na porta $PORTA" || echo "✘ app não respondeu: pm2 logs $PM2_NOME"
echo "Pronto. Teste: reboot — em ~1 minuto o sistema volta sozinho."
