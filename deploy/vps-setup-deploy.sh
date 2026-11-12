#!/usr/bin/env bash
# Prepara o VPS para receber a implantação automática do GitHub (rodar UMA vez, como root).
# - remove chaves de implantação antigas (comentário "github-deploy") e arquivos soltos /root/deploy_talk*
# - escolhe a porta do app (padrão 7012; se ocupada por outro serviço, usa a próxima livre >= 1024)
# - cria o comando restrito /usr/local/bin/talk-deploy (atualiza o app e aponta o proxy do subdomínio para a porta)
# - gera uma chave nova, autoriza só esse comando e mostra os valores dos segredos do GitHub
# Uso: sudo bash vps-setup-deploy.sh            (variáveis: PORTA, SUBDOMINIO, REPO, VPS_IP, USUARIO)
set -euo pipefail
PORTA="${PORTA:-7012}"; SUBDOMINIO="${SUBDOMINIO:-talks.m3d.pro}"
REPO="${REPO:-https://github.com/LACibermedicina/talk}"; VPS_IP="${VPS_IP:-159.223.22.82}"
USUARIO="${USUARIO:-root}"; SSH_DIR="${SSH_DIR:-/root/.ssh}"; CONF="${CONF:-/etc/talk-deploy.conf}"
BIN="${BIN:-/usr/local/bin/talk-deploy}"; KEY="${KEY:-/root/.ssh/github_deploy_talk}"
[ "$(id -u)" = 0 ] || [ -n "${SKIP_ROOT:-}" ] || { echo "Rode como root."; exit 1; }
mkdir -p "$SSH_DIR"; chmod 700 "$SSH_DIR"; touch "$SSH_DIR/authorized_keys"; chmod 600 "$SSH_DIR/authorized_keys"

# 1) limpeza das chaves anteriores (com cópia de segurança)
cp -p "$SSH_DIR/authorized_keys" "$SSH_DIR/authorized_keys.bak.$(date +%s)"
grep -v 'github-deploy' "$SSH_DIR/authorized_keys" > "$SSH_DIR/authorized_keys.new" || true
mv "$SSH_DIR/authorized_keys.new" "$SSH_DIR/authorized_keys"; chmod 600 "$SSH_DIR/authorized_keys"
rm -f /root/deploy_talk /root/deploy_talk.pub "$KEY" "$KEY.pub"
echo "✔ chaves antigas removidas (cópia em authorized_keys.bak.*)"

# 2) porta: mantém a atual do talk; se outro serviço a usa, procura a próxima livre
em_uso() { ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"; }
dono_talk() { command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q "\"PORT\":\"$1\""; }
P="$PORTA"
while [ "$P" -lt 1024 ] || { em_uso "$P" && ! dono_talk "$P"; }; do P=$((P+1)); [ "$P" -le 65000 ] || { echo "Sem porta livre"; exit 1; }; done
[ "$P" = "$PORTA" ] || echo "! porta $PORTA ocupada por outro serviço; usando $P"
printf 'PORTA=%s\nSUBDOMINIO=%s\nREPO=%s\n' "$P" "$SUBDOMINIO" "$REPO" > "$CONF"; chmod 644 "$CONF"
echo "✔ porta do talk: $P (guardada em $CONF; edite e rode talk-deploy para trocar)"

# 3) comando restrito de implantação
cat > "$BIN" <<'WRAP'
#!/usr/bin/env bash
# Comando único liberado à chave do GitHub. Ignora o que o cliente pedir.
set -uo pipefail
. /etc/talk-deploy.conf
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
echo "== atualizando código e app (porta $PORTA, $SUBDOMINIO)"
instalar_atualizar -repertorio_git "$REPO" -porta "$PORTA" -subdominio "$SUBDOMINIO" || { echo "instalar_atualizar falhou"; exit 1; }
# aponta o proxy reverso do subdomínio para a porta atual (só altera arquivos que contêm o subdomínio)
mudou=0
for f in $(grep -rlE "server_name[^;]*\b${SUBDOMINIO//./\\.}\b" "$NGINX_DIR/sites-enabled" "$NGINX_DIR/sites-available" "$NGINX_DIR/conf.d" 2>/dev/null | sort -u); do
  if grep -Eq "proxy_pass\s+http://(127\.0\.0\.1|localhost):[0-9]+" "$f" && ! grep -Eq "proxy_pass\s+http://(127\.0\.0\.1|localhost):${PORTA}\b" "$f"; then
    mkdir -p /root/backup-nginx; cp -p "$f" "/root/backup-nginx/$(basename "$f").$(date +%s).bak"
    sed -Ei "s#(proxy_pass\s+http://(127\.0\.0\.1|localhost)):[0-9]+#\1:${PORTA}#" "$f"; mudou=1; echo "proxy de $f -> $PORTA"
  fi
done
if [ "$mudou" = 1 ]; then nginx -t && systemctl reload nginx || { echo "nginx -t falhou: restaure as cópias de /root/backup-nginx"; exit 1; }; fi
sleep 3
curl -fsS "http://127.0.0.1:${PORTA}/api/health" >/dev/null && echo "✔ app respondendo na porta $PORTA" || { echo "✘ app não respondeu em 127.0.0.1:$PORTA (veja: pm2 logs talk)"; exit 1; }
WRAP
chmod 755 "$BIN"; echo "✔ comando $BIN criado"

# 4) chave nova presa a esse comando
ssh-keygen -q -t ed25519 -N "" -C "github-deploy" -f "$KEY"
echo "command=\"$BIN\",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding $(cat "$KEY.pub")" >> "$SSH_DIR/authorized_keys"
echo "✔ chave nova autorizada"
echo; echo "===== Segredos do GitHub (Settings > Secrets and variables > Actions) ====="
echo "VPS_HOST       = $VPS_IP"; echo "VPS_USER       = $USUARIO"
echo; echo "VPS_KNOWN_HOSTS ="; ssh-keyscan -t ed25519 "$VPS_IP" 2>/dev/null || echo "(rode: ssh-keyscan -t ed25519 $VPS_IP)"
echo; echo "VPS_SSH_KEY (copie tudo, inclusive BEGIN/END) ="; cat "$KEY"
echo; echo "Depois de colar no GitHub, apague a chave privada daqui:  shred -u $KEY"
echo "Ela não é mais necessária no servidor; a pública (.pub) pode ficar."
