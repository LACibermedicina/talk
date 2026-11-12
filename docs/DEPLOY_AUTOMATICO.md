# Implantação automática GitHub → VPS

Fluxo: `git push` no `main` → CI passa → workflow `deploy` conecta por SSH no VPS (159.223.22.82) → o comando `talk-deploy` atualiza o código, reinicia o app e garante que o proxy do subdomínio aponte para a porta certa.

## 1. No VPS (uma vez, como root)
```
curl -fsSL https://raw.githubusercontent.com/LACibermedicina/talk/main/deploy/vps-setup-deploy.sh -o /root/vps-setup-deploy.sh
bash /root/vps-setup-deploy.sh
```
O script: remove chaves antigas `github-deploy`; mantém a porta 7012 (se outro serviço a usar, escolhe a próxima livre ≥ 1024, nunca portas < 1000, que ficam para o IP público/proxy); cria `/usr/local/bin/talk-deploy`; gera uma chave nova presa a esse comando; imprime os 4 valores dos segredos.
Para outra porta: `PORTA=7020 bash /root/vps-setup-deploy.sh` ou edite `/etc/talk-deploy.conf` e rode `talk-deploy`.

## 2. No GitHub
Settings → Secrets and variables → Actions → New repository secret: `VPS_HOST` (159.223.22.82), `VPS_USER` (root), `VPS_KNOWN_HOSTS`, `VPS_SSH_KEY` (privada completa com BEGIN/END). Depois apague a privada do VPS: `shred -u /root/.ssh/github_deploy_talk`.

## 3. Testar
Actions → deploy → Run workflow. O log termina com `✔ app respondendo na porta …`. Se falhar: `pm2 logs talk`, `nginx -t`.

## Notas
- A chave só consegue rodar `talk-deploy` (sem terminal, sem túnel). Cada troca de proxy gera `.bak.<data>` ao lado do arquivo do Nginx.
- Mudar a porta altera só `/etc/talk-deploy.conf`; o proxy de `talks.m3d.pro` é reescrito automaticamente.
- Nunca cole a chave privada em conversas ou issues.

## Corrigir avisos do instalador no VPS (Nginx/HTTPS/pasta data)
```
curl -fsSL https://raw.githubusercontent.com/LACibermedicina/talk/main/deploy/vps-fix-proxy.sh | bash
```
Garante a pasta `data`, os cabeçalhos do proxy (`X-Forwarded-Proto`, WebSocket etc.) no site do Nginx, valida com `nginx -t` (desfaz se falhar) e reinicia o app. Cópias ficam em `/root/backup-nginx`. Para também rodar o app sem root: `USER_SEGURO=1 bash vps-fix-proxy.sh`.
