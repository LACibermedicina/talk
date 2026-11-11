# Implantação automática (GitHub → VPS)

A cada push no `main` o GitHub roda o CI; se passar, o workflow `deploy` entra no VPS por SSH e executa o `instalar_atualizar` (git pull, npm install, PM2, Nginx). Também dá para disparar manualmente: aba **Actions → deploy → Run workflow**.

## Configurar (uma vez)
1. **No seu computador ou no VPS**, crie uma chave só para isso: `ssh-keygen -t ed25519 -f deploy_talk -C "github-deploy" -N ""`.
2. **No VPS**, autorize a chave **restringindo-a a este comando** (em `~/.ssh/authorized_keys` do usuário de deploy):
   `command="/usr/local/bin/instalar_atualizar -repertorio_git https://github.com/LACibermedicina/talk -porta 7012 -subdominio talks.m3d.pro",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA… github-deploy`
   Assim, mesmo que a chave vaze, ela só consegue rodar a atualização. Se o usuário não for root, dê a ele `sudo` sem senha só para esse script.
3. **No GitHub** (repositório → Settings → Secrets and variables → Actions → Secrets):
   - `VPS_HOST`: IP ou domínio do VPS; `VPS_USER`: usuário (por exemplo `root` ou `deploy`)
   - `VPS_SSH_KEY`: conteúdo de `deploy_talk` (a chave **privada**)
   - `VPS_KNOWN_HOSTS`: saída de `ssh-keyscan -t ed25519 SEU_HOST` (confira a impressão digital com `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` no VPS)
   - opcional, em *Variables*: `VPS_DEPLOY_CMD` para outro comando.
4. Apague `deploy_talk` do computador depois de colar o segredo.

## Observações
- Sem os segredos, o job termina sem erro e sem implantar.
- Cada implantação reinicia o PM2: usuários conectados perdem a conexão por alguns segundos. As migrações do banco rodam sozinhas ao iniciar. Faça push fora do horário de atendimento, ou use o disparo manual.
- O workflow só roda após o CI passar no `main`. Não implanta pull requests.
- Para voltar a uma versão anterior: `git revert` no GitHub e novo push, ou no VPS `git reset --hard <commit>` e `pm2 restart talk`.
