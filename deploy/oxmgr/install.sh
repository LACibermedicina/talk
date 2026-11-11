#!/usr/bin/env bash
# Instalação sem Docker, em um servidor Debian/Ubuntu. Rode como root, de dentro da pasta do projeto.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root" >&2; exit 1; }
command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "Instale o Node 22 ou superior antes (https://nodejs.org)." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm não encontrado" >&2; exit 1; }
id talkm3d >/dev/null 2>&1 || useradd --system --home /opt/talk-m3d --shell /usr/sbin/nologin talkm3d
mkdir -p /opt/talk-m3d /var/lib/talk-m3d /etc/talk-m3d
cp -a . /opt/talk-m3d/ && cd /opt/talk-m3d && npm install --omit=dev
npm install -g oxmgr                                    # gerenciador de processos
chown -R talkm3d:talkm3d /var/lib/talk-m3d; chmod 700 /var/lib/talk-m3d
oxmgr validate /opt/talk-m3d/deploy/oxmgr/oxfile.toml
cp deploy/oxmgr/talk-m3d.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now talk-m3d
echo "Pronto. Código de instalação: journalctl -u talk-m3d | grep INSTALAÇÃO   — abra http://IP-DO-SERVIDOR:3000 (ou publique atrás do Caddy)."
