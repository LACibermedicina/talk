# Implantação independente do Talk.M3D

Objetivo: o sistema roda **isolado** (recursos limitados, processos separados, saúde monitorada) para não sobrecarregar os serviços de base do servidor. Banco (Neon), vídeo (Agora), IA, PayPal e SMS já são serviços externos; localmente só rodam a **API** (`web`), o **worker** (jobs) e o **proxy**.

## O que mudou no código
- `RUN_JOBS=false` tira os jobs (SMS, anomalias, renovação de planos) da API. Eles rodam em `node src/worker.js`, **uma única instância**; o worker espera o instalador concluir sozinho.
- `GET /api/health` (liveness) e `GET /api/health?deep=1` (confere o banco) servem de sonda; também respondem durante o instalador.
- **Regra de ouro:** 1 réplica de `web` (chat, presença e WebSocket vivem na memória do processo) e 1 de `worker`. Escalar para várias réplicas exigiria mover presença/WebSocket para um barramento (Redis), o que **não** foi feito. Para ganhar folga, aumente CPU/memória do contêiner, não o número de réplicas.

## Qual caminho escolher
| Situação | Caminho |
|---|---|
| Um VPS, quer o mais simples | **Docker Compose** (raiz do projeto) |
| Já tem cluster | **Kubernetes** (`deploy/k8s`) |
| VPS sem Docker, quer processos gerenciados leves | **Oxmgr + systemd** (`deploy/oxmgr`) |

## 1) Docker Compose (limites incluídos)
`docker compose up -d --build`. Serviços: `app` (768 MB / 1,5 CPU), `worker` (256 MB / 0,3 CPU), `caddy` (128 MB). Ajuste com `APP_MEM`, `APP_CPUS`, `WORKER_MEM`, `WORKER_CPUS`. Há healthcheck, `init`, logs rotativos (3×10 MB), sistema de arquivos somente leitura, sem capacidades Linux. O instalador do navegador continua valendo (config em `appdata`).

## 2) Kubernetes
1. Construa e publique a imagem: `docker build -t REGISTRY/talk-m3d:TAG . && docker push …`; troque `REGISTRY/talk-m3d:TAG` nos YAML.
2. `kubectl apply -k deploy/k8s`
3. Segredos (chaves novas; **guarde a DATA_KEY**): `deploy/gen-secrets.sh "postgresql://…" "https://seu.dominio" | kubectl apply -f -`
4. Ajuste o domínio em `40-ingress.yaml` (precisa de ingress-nginx e, para HTTPS automático, cert-manager com ClusterIssuer `letsencrypt`).
5. Abra o endereço: como as chaves vêm do Secret, o assistente começa direto na verificação do servidor, integrações e usuários. O código de instalação está em `kubectl logs -n talk-m3d deploy/talk-web | grep INSTALAÇÃO`.
- Estratégia `Recreate`, sondas `startup/readiness/liveness`, usuário não-root, rootfs somente leitura, NetworkPolicy que só admite o ingress. Sem HPA de propósito (ver regra de ouro).

## 3) Oxmgr + systemd (sem Docker)
[Oxmgr](https://github.com/Vladimir-Urik/OxMgr) é um gerenciador de processos em Rust (alternativa ao PM2). `deploy/oxmgr/install.sh` (root, Node 22+) cria o usuário `talkm3d`, instala as dependências e o Oxmgr, valida o `oxfile.toml` e registra o serviço `talk-m3d`, que roda `web` + `worker` com `MemoryMax=1G`, `CPUQuota=200%`, `TasksMax=512`, `ProtectSystem=strict` e sem privilégios. Publique com Caddy/Nginx na frente (porta 3000 local). Dados e chaves: `/var/lib/talk-m3d` (`config.env`, 0600).
- **Verificação pendente:** o `oxfile.toml` usa só os campos que a documentação pública do Oxmgr mostra (`name`, `command`, `restart_policy`, `max_restarts`, `stop_timeout_secs`); rode `oxmgr validate` e confira `docs/OXFILE.md` do projeto, pois a versão instalada pode aceitar outros nomes ou exigir ajustes (por exemplo, limites próprios de memória, que aqui ficam a cargo do systemd).

## Estado de teste
Os arquivos YAML/TOML/shell foram checados por sintaxe e por testes estáticos (`tests/deploy.test.js`). **Nada disso foi executado em Docker, cluster ou com Oxmgr reais** (o ambiente de desenvolvimento não os tem). Faça uma homologação, e meça o consumo real antes de fixar limites: os valores acima são pontos de partida, não medições.
