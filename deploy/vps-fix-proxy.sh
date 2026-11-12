#!/usr/bin/env bash
# Corrige no VPS (PM2 + Nginx) o que o instalador do Talk.M3D avisa. Rode como root, quantas vezes quiser:
#   curl -fsSL https://raw.githubusercontent.com/LACibermedicina/talk/main/deploy/vps-fix-proxy.sh | bash
# Variáveis: SUBDOMINIO (talks.m3d.pro) APP_DIR (/var/www/talk) NGINX_DIR (/etc/nginx) PM2_NOME (talk)
set -uo pipefail
SUBDOMINIO="${SUBDOMINIO:-talks.m3d.pro}"; APP_DIR="${APP_DIR:-/var/www/talk}"; NGINX_DIR="${NGINX_DIR:-/etc/nginx}"; PM2_NOME="${PM2_NOME:-talk}"; BKP="${BKP:-/root/backup-nginx}"; mkdir -p "$BKP"
[ "$(id -u)" = 0 ] || [ -n "${SKIP_ROOT:-}" ] || { echo "Rode como root."; exit 1; }
mkdir -p "$APP_DIR/data" && echo "✔ pasta $APP_DIR/data pronta"

# HTTPS: se o domínio ainda não responde por TLS neste servidor, emite o certificado (certbot)
if ! curl -skI --max-time 8 --resolve "$SUBDOMINIO:443:127.0.0.1" "https://$SUBDOMINIO/" >/dev/null 2>&1; then
  if command -v certbot >/dev/null 2>&1; then
    echo "• sem HTTPS ativo para $SUBDOMINIO: emitindo certificado (certbot)"
    certbot --nginx -d "$SUBDOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect && echo "✔ certificado emitido e HTTP redirecionado para HTTPS" || echo "! certbot falhou (o DNS de $SUBDOMINIO precisa apontar para este servidor e a porta 80 estar aberta)"
  else echo "! certbot não instalado: apt install -y certbot python3-certbot-nginx"; fi
else echo "✔ HTTPS já responde para $SUBDOMINIO"; fi

FILES=$(grep -RlE "server_name[^;]*\b${SUBDOMINIO//./\\.}\b" "$NGINX_DIR/sites-enabled" "$NGINX_DIR/conf.d" 2>/dev/null | sort -u)
# fallback: pergunta ao próprio nginx quais arquivos definem o site
[ -n "$FILES" ] || FILES=$(nginx -T 2>/dev/null | awk -v d="$SUBDOMINIO" '/^# configuration file /{f=$4; sub(":$","",f)} /server_name/ && index($0,d){print f}' | sort -u)
FILES=$(for x in $FILES; do readlink -f "$x"; done | sort -u)
[ -n "$FILES" ] || { echo "✘ Não achei o site $SUBDOMINIO em $NGINX_DIR. Mande: ls -la $NGINX_DIR/sites-enabled; nginx -T | grep -n server_name"; exit 1; }
mudou=0
for f in $FILES; do
  cp -p "$f" "$BKP/$(basename "$f").$(date +%s).bak"
  out=$(python3 - "$f" <<'PY'
import re,sys
f=sys.argv[1]; L=open(f).read().split('\n')
need=[('Host','proxy_set_header Host $host;'),('X-Forwarded-Proto','proxy_set_header X-Forwarded-Proto $scheme;'),
('X-Forwarded-For','proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;'),('X-Real-IP','proxy_set_header X-Real-IP $remote_addr;'),
('Upgrade','proxy_set_header Upgrade $http_upgrade;'),('Connection','proxy_set_header Connection "upgrade";'),
('proxy_http_version','proxy_http_version 1.1;'),('proxy_read_timeout','proxy_read_timeout 3600s;')]
i=0; add=0
while i<len(L):
    if re.match(r'\s*proxy_pass\s+http://(127\.0\.0\.1|localhost):\d+',L[i]):
        s=i
        while s>0 and not re.match(r'\s*location\b',L[s]): s-=1
        d=0; e=s
        while e<len(L):
            d+=L[e].count('{')-L[e].count('}')
            if d<=0 and e>=s and '{' in ''.join(L[s:e+1]): break
            e+=1
        blk='\n'.join(L[s:e+1]); ind=re.match(r'\s*',L[i]).group(0); ins=[]
        for k,line in need:
            key=line.split()[1] if line.startswith('proxy_set_header') else line.split()[0]
            if line.startswith('proxy_set_header'): ok=re.search(r'proxy_set_header\s+'+re.escape(key)+r'\b',blk)
            else: ok=re.search(r'\b'+re.escape(key)+r'\b',blk)
            if not ok: ins.append(ind+line)
        if ins: L[i+1:i+1]=ins; add+=len(ins); i+=len(ins)
    i+=1
if add: open(f,'w').write('\n'.join(L))
print(add)
PY
)
  if [ "${out:-0}" != 0 ]; then mudou=1; echo "✔ $f: $out linhas adicionadas"; else echo "• $f: já estava correto"; rm -f "$(ls -t "$BKP/$(basename "$f")".*.bak | head -1)"; fi
done
if [ "$mudou" = 1 ]; then
  if nginx -t 2>&1; then systemctl reload nginx && echo "✔ Nginx recarregado"
  else echo "✘ nginx -t falhou: restaurando as cópias de $BKP"; for f in $FILES; do b=$(ls -t "$BKP/$(basename "$f")".*.bak 2>/dev/null | head -1); [ -n "$b" ] && cp -p "$b" "$f"; done; exit 1; fi
fi
command -v pm2 >/dev/null && pm2 restart "$PM2_NOME" >/dev/null 2>&1 && echo "✔ app reiniciado (pm2 restart $PM2_NOME)"

if [ -n "${USER_SEGURO:-}" ]; then
  PORTA=$(. /etc/talk-deploy.conf 2>/dev/null; echo "${PORTA:-7012}")
  id talk >/dev/null 2>&1 || useradd -r -m -s /bin/bash talk
  cat > /usr/local/bin/talk-as-user <<AS
#!/usr/bin/env bash
# Põe o app para rodar como usuário "talk" (sem root). Chamado após cada atualização.
pm2 delete $PM2_NOME >/dev/null 2>&1; pm2 save >/dev/null 2>&1
chown -R talk:talk $APP_DIR
git config --global --add safe.directory $APP_DIR >/dev/null 2>&1
su - talk -c "cd $APP_DIR && (pm2 delete $PM2_NOME >/dev/null 2>&1; PORT=$PORTA TZ=\${TZ:-America/Sao_Paulo} pm2 start src/server.js --name $PM2_NOME && pm2 save)"
AS
  chmod 755 /usr/local/bin/talk-as-user
  /usr/local/bin/talk-as-user && echo "✔ app rodando como usuário talk (sem root)"
  env PATH="$PATH" pm2 startup systemd -u talk --hp /home/talk >/dev/null 2>&1 && echo "✔ inicia sozinho com o servidor (como talk)"
  touch /etc/talk-as-user.on
fi
echo; echo "Agora abra https://$SUBDOMINIO e clique em 'Verificar de novo'."
