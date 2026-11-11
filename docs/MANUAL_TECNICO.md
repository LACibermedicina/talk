# Talk.M3D — Manual Técnico (v7)

Público: quem instala, opera e mantém o sistema. Para uso no dia a dia, veja o **Manual do Usuário** (`MANUAL_USUARIO.md`).

## 1. Arquitetura
| Camada | Tecnologia |
|---|---|
| API | Node 22, Fastify 5, WebSocket (chat, presença, sinalização da chamada), Zod (validação), Argon2 (senhas) |
| Banco | PostgreSQL gerenciado (Neon) com TLS; migrações em `db/NNN_*.sql` aplicadas em ordem por `src/migrateLib.js` |
| Vídeo | Agora (token gerado no servidor) |
| IA | Gemini → OpenAI → Anthropic (failsafe); STT (transcrição) por OpenAI ou Gemini |
| Pagamento | PayPal (créditos e planos), valores sempre calculados no servidor |
| SMS | Twilio (lembretes de consulta) |
| Borda | Caddy (HTTPS automático) → app (porta 3000 no contêiner; `127.0.0.1:${APP_PORT:-7001}` no host) |
| Cliente | PWA em JavaScript puro, sem scripts inline (CSP estrita), service worker `sw.js` |

Uma única instância (os jobs rodam no processo). Jobs: lembretes SMS, anomalias (a cada 10 min), renovação de planos gratuitos (a cada hora).

## 2. Instalação e primeiro acesso (instalador auto-configurável)
Ponto de entrada: `node src/start.js`.
1. Carrega `data/config.env` (volume `appdata`, permissão 0600). **Variáveis de ambiente reais têm prioridade** (nunca são sobrescritas).
2. Se faltar `DATABASE_URL`, `JWT_SECRET` (≥32), `DATA_KEY` (32 bytes em base64) ou `APP_ORIGIN`, sobe um **servidor mínimo de instalação** (`src/boot/server.js`, só Fastify, estáticos e `pg`; não importa `crypto.js`/`db.js`, que falhariam sem as chaves). Ele imprime no log `INSTALAÇÃO: … <código>` e exige esse código (formato `XXXX-XXXX-XXXX`, comparação em tempo constante, limite de tentativas por IP).
3. Passos do assistente no navegador (`public/wizard.js`): **Início → Código → Servidor → Banco de dados → Chaves de segurança → Endereço e HTTPS → Gravar e iniciar**, e então (já no sistema completo, com o mesmo código) **Servidor (verificação completa) → Credenciais → Vídeo → IA → Pagamento e SMS → Equipe base → Instalar**.
4. **Diagnóstico preventivo** (`src/boot/checks.js` antes de instalar; `/api/setup/check` depois). Cada item traz `nível` (obrigatório/recomendado), `detalhe`, **`por quê`** e **`como resolver`**; falha obrigatória **bloqueia** o avanço:

| Verificação | Nível | Por que importa |
|---|---|---|
| Node ≥ 22 | obrigatório | módulos ES, fetch e criptografia nativa |
| Pasta `data/` gravável | obrigatório | é onde as chaves geradas ficam guardadas |
| Memória ≥ 512 MB | recomendado | hash de senhas e PDFs; risco de o SO encerrar o processo |
| Processo sem root | recomendado | limita o estrago se o app for invadido |
| Fuso horário (TZ) | recomendado | lembretes e relatórios na hora local |
| Proxy HTTPS (Caddy) | recomendado | certificado automático e proteção contra acesso direto |
| Host/endereço coerente | recomendado | cookies seguros e CORS |
| SDK de vídeo (`public/vendor`) | recomendado | sem ele não há teleconsulta |
| Saída de rede (DNS) | recomendado | provedores de IA, vídeo e pagamento |
| Banco: conexão, versão, TLS, criar/apagar tabela de prova | obrigatório | nada funciona sem banco; sem TLS os dados cruzam a rede abertos |
| Migrações em dia | obrigatório | as tabelas precisam estar na versão do código |
| Chaves (`JWT_SECRET`, `DATA_KEY`), senhas fracas, HTTPS, cookie Secure | obrigatório/recomendado | ver tabela de segurança |
| Provedores (Agora, IA, PayPal, SMS) | testados antes de gravar | cada chave é validada com uma chamada real |

5. Gravação: `POST /api/setup/boot/save` exige confirmação de que a `DATA_KEY` foi guardada, retesta o banco, grava `data/config.env` (escrita atômica, 0600) e inicia o sistema completo **no mesmo processo**, sem reiniciar o contêiner. As integrações coladas depois ficam **cifradas no banco** (`app_settings`).
6. Refazer a instalação: apague `data/config.env` (volume `appdata`) e reinicie. **Faça backup da `DATA_KEY`**: sem ela, os dados cifrados são irrecuperáveis.
7. Alternativas: `scripts/install.sh` (gera `.env` e sobe), `node src/setup.js config/usuarios.json` (sem tela).

### Variáveis de ambiente
`DATABASE_URL`, `JWT_SECRET`, `DATA_KEY`, `APP_ORIGIN`, `TZ`, `PORT`, `DATA_DIR`, `PGSSL`, `COOKIE_SECURE`, `AUTO_MIGRATE`, `DOMAIN`/`APP_PORT`/`HTTP_PORT`/`HTTPS_PORT` (compose), `SIGNUP_MODE`, `BILLING_ENFORCE`, `AMB_*`, `PROTOCOL_ORDER`, `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE`, `GEMINI_*`, `OPENAI_*`, `ANTHROPIC_*`, `AI_TIMEOUT_MS`, `AI_LONG_TIMEOUT_MS`, `AI_STT_MODEL`, `I18N_DAILY_LIMIT`, `PAYPAL_*`, `TWILIO_*`, `ANOM_PATIENTS_10MIN`, `ALLOW_WEAK_PASSWORDS`, `TEST_MODE` (somente teste local). As integrações podem ser guardadas pelo assistente/Integrações (cifradas no banco) em vez de variáveis.

## 3. Banco de dados
Migrações (todas aplicadas pelo instalador ou por `AUTO_MIGRATE`):
| Migração | Conteúdo |
|---|---|
| 001 | `users`, `care_team`, `channels`, `messages`, `packages`, `appointments`, `payments`, `transcripts`, `clinical_entries`, `exercises`, `assignments`, `task_logs`, `goals`, `evolution`, `documents`, `alerts`, `audit_log` (imutável por trigger, encadeada por hash) |
| 002 | agenda (notas e histórico) |
| 003 | contexto, tarefas e histórico de atividades |
| 004 | papéis ampliados, `cargo`, **root** (`is_root`, índice único), `must_change` |
| 005 | receitas, rotinas, registro profissional, assinatura |
| 006 | `app_settings` (integrações cifradas) |
| 007 | cadastro público: `username`, `pending`, `failed_logins`, `locked_until` |
| 008 | cache de tradução da interface |
| 009 | estado de presença e país |
| 010 | consulta: `consult_state`, `library_items`, `clinical_prefs` |
| 011 | `family_maps` (familiograma e ecomapa cifrados) |
| 012 | créditos: `plans`, `credit_costs`, `user_billing`, `credit_ledger`, `signup_tokens`, `token_uses`, `billing_orders` (+ planos, custos e token TALK iniciais) |
| 013 | credenciais: `last_login_at/ip`, `pw_changed_at`, `sessions_valid_after`, `credential_events` |

O teste `tests/schema.test.js` garante migrações em sequência e que toda tabela usada no código existe em alguma migração.

## 4. Controle de credenciais
- **Senhas:** Argon2; mínimo de 12 caracteres (política em `src/policy.js`); senha temporária gera `must_change` e bloqueia todas as rotas, exceto `/api/me`, `/api/me/password` e `/api/logout`, até a troca.
- **Sessão:** JWT em cookie httpOnly/Secure/SameSite=Strict, 8 h. A cada requisição o servidor confere que o usuário está **ativo** e que o token foi emitido **depois** de `sessions_valid_after` (revogação imediata).
- **Defesas:** 8 senhas erradas → conta travada 15 min (`failed_logins`, `locked_until`); limite por IP no login e na troca de senha; resposta igual para usuário inexistente ou senha errada.
- **Root:** único superusuário (`is_root`), não pode ser bloqueado; só ele cria administradores; só ele redefine a própria senha.
- **Gestão pelo administrador** (tela Usuários): criar, aprovar/recusar cadastros, bloquear/reativar, **redefinir senha** (gera senha temporária mostrada uma vez, encerra sessões), **destravar** conta, **encerrar sessões**; a lista mostra último acesso e travamento.
- **Rastreabilidade:** `credential_events` (login, falha, bloqueio, desbloqueio, senha trocada/redefinida, sessão revogada, com IP e quem agiu) **e** `audit_log` (cadeia de hash; `GET /api/audit/verify`).
- **Perfis (RBAC):** `admin`, `medico`, `fisio`, `enfermeiro`, `nutricionista`, `farmaceutico`, `profissional`, `cuidador`, `recepcao`, `funcionario`, `paciente`; dado clínico exige vínculo (`care_team`); administrador e recepção nunca leem dado clínico.
- **Cifragem em repouso:** AES-256-GCM (`DATA_KEY`) para mensagens, transcrições, notas, prontuário, familiograma e integrações.

## 5. Cadastro, créditos, planos, tokens e embaixadores
- **Cadastro público** (`SIGNUP_MODE`: desativado, aprovação, aberto). Com **token válido** a conta nasce aprovada, com teste/plano/créditos do token; sem token segue o modo. O token padrão `TALK` (7 dias, plano Básico, sem créditos) só vale com o cadastro público ligado; tokens de convite valem mesmo com ele desligado.
- **Medição:** só quem tem linha em `user_billing` (cadastro por token/público ou ativado pelo admin) é medido. Administradores e usuários sem linha nunca são bloqueados.
- **Cobrança desligada por padrão.** Ao ligar `BILLING_ENFORCE`, usuário medido precisa de teste ou plano vigentes; senão toda rota responde **402** (`locked`, motivo `bloqueado|expirado|sem_plano`) e o cliente abre a área de aquisição. Rotas liberadas quando travado: `/api/me`, `/api/logout`, `/api/billing/*`, login, cadastro, setup.
- **Custos** (`credit_costs`, 0 = livre) por funcionalidade: assistente, tradução, transcrição, rascunho clínico, estruturação, relatório e apoio da consulta, análise de caso, familiograma/ecomapa. Débito atômico antes da ação e **estorno** se a resposta for ≥ 400. Cache de 30 s (invalidado nas alterações).
- **Razão** (`credit_ledger`): toda entrada/saída com tipo (plano, uso, estorno, token, indicação, concessão, ajuste, distribuição). Saldo nunca fica negativo (CHECK + atualização condicional).
- **Planos:** Básico (grátis), Essencial R$ 59/mês ou R$ 19/semana, Profissional R$ 149/R$ 45, Clínica R$ 399/R$ 119, com vantagens crescentes (pacientes, equipe, IA, protocolos, vídeo, armazenamento, suporte). Editáveis. Planos gratuitos renovam sozinhos; pagos exigem novo pagamento. Compra: PayPal (captura confere moeda BRL e valor) ou pedido pendente que o administrador confirma.
- **Indicação:** token promocional com dono; a cada uso o dono recebe `reward_owner` créditos. **Embaixador:** cria grupos de tokens (`AMB-XXXXXX`) dentro de limites fixados pelo administrador (`AMB_MAX_GROUPS`, `AMB_MAX_TOKENS`, `AMB_MAX_USES`, `AMB_MAX_CREDITS`, `AMB_MAX_TRIAL_DAYS`, `AMB_REWARD`, `AMB_PLAN`).
- Lógica pura e testada em `src/billingLogic.js`; banco em `src/billing.js`; rotas em `src/routes/billing.js`.

## 6. Funcionalidades (visão técnica)
Chat em tempo real com tradução e urgência; canais; agenda visual (arrastar, conflitos, notas cifradas, risco de falta, SMS); teleconsulta Agora (convite de especialista, transcrição com consentimento, estruturação, histórico por minuto, relatório CARE, apoio cognitivo com hierarquia protocolar); caso clínico (resumo, conduta, alternativas, SOAP, estudo de caso); familiograma e ecomapa; prontuário com aprovação; receitas/atestados/pedidos com QR de uso limitado e rotinas; exercícios, tarefas, evolução e metas; financeiro, pacotes e PayPal; auditoria e alertas; relações 3D; biblioteca e hierarquia protocolar editável; assistente de ajuda com IA e guia; cinco idiomas com IA de tradução; PWA; interface de painéis (dock, submenu superior, post-its, anotações); créditos e planos; instalador.

## 7. API
Todas as rotas exigem sessão, salvo login, cadastro, status do setup, verificação de documento e páginas de QR. Prefixo `/api`. Lista gerada do código-fonte:

| Módulo | Método | Caminho |
|---|---|---|
| `admin` | GET | `/api/users` |
| `admin` | POST | `/api/users` |
| `admin` | PATCH | `/api/users/:id/approve` |
| `admin` | DELETE | `/api/users/:id/pending` |
| `admin` | PATCH | `/api/users/:id/active` |
| `admin` | POST | `/api/users/:id/reset-password` |
| `admin` | POST | `/api/users/:id/unlock` |
| `admin` | POST | `/api/users/:id/revoke-sessions` |
| `admin` | GET | `/api/users/:id/credential-events` |
| `admin` | PATCH | `/api/users/:id/registro` |
| `admin` | POST | `/api/care-team` |
| `admin` | GET | `/api/alerts` |
| `admin` | PATCH | `/api/alerts/:id/ack` |
| `admin` | GET | `/api/audit` |
| `admin` | GET | `/api/ai/health` |
| `admin` | GET | `/api/audit/verify` |
| `agenda` | GET | `/api/agenda` |
| `agenda` | POST | `/api/agenda` |
| `agenda` | PATCH | `/api/agenda/:id/status` |
| `app` | GET | `/api/contacts` |
| `app` | GET | `/api/agenda/week` |
| `app` | GET | `/api/agenda/current` |
| `app` | PATCH | `/api/agenda/:id` |
| `app` | POST | `/api/agenda/notes` |
| `app` | PATCH | `/api/agenda/notes/:id` |
| `app` | DELETE | `/api/agenda/notes/:id` |
| `app` | GET | `/api/patients/:id/summary` |
| `app` | PUT | `/api/patients/:id/summary` |
| `app` | GET | `/api/patients/:id/documents` |
| `assistente` | GET | `/api/assistant/info` |
| `assistente` | POST | `/api/assistant` |
| `auth` | POST | `/api/login` |
| `auth` | POST | `/api/logout` |
| `auth` | GET | `/api/me` |
| `auth` | POST | `/api/me/password` |
| `auth` | PUT | `/api/me/status` |
| `auth` | PATCH | `/api/me/consent` |
| `billing` | GET | `/api/billing/me` |
| `billing` | GET | `/api/billing/plans` |
| `billing` | GET | `/api/billing/ledger` |
| `billing` | POST | `/api/billing/checkout` |
| `billing` | POST | `/api/billing/orders/:id/capture` |
| `billing` | POST | `/api/billing/redeem` |
| `billing` | GET | `/api/billing/ambassador` |
| `billing` | POST | `/api/billing/ambassador/groups` |
| `billing` | PATCH | `/api/billing/ambassador/tokens/:code` |
| `billing` | GET | `/api/admin/billing/overview` |
| `billing` | PUT | `/api/admin/billing/settings` |
| `billing` | GET | `/api/admin/billing/plans` |
| `billing` | PUT | `/api/admin/billing/plans/:id` |
| `billing` | GET | `/api/admin/billing/costs` |
| `billing` | PUT | `/api/admin/billing/costs` |
| `billing` | GET | `/api/admin/billing/users` |
| `billing` | POST | `/api/admin/billing/users/:id` |
| `billing` | POST | `/api/admin/billing/distribute` |
| `billing` | GET | `/api/admin/billing/ledger` |
| `billing` | GET | `/api/admin/billing/tokens` |
| `billing` | POST | `/api/admin/billing/tokens` |
| `billing` | PATCH | `/api/admin/billing/tokens/:code` |
| `billing` | GET | `/api/admin/billing/orders` |
| `billing` | POST | `/api/admin/billing/orders/:id/:acao` |
| `caso` | GET | `/api/case/countries` |
| `caso` | PUT | `/api/me/country` |
| `caso` | GET | `/api/patients/:id/case` |
| `caso` | POST | `/api/patients/:id/case/ai` |
| `chat` | GET | `/api/channels` |
| `chat` | POST | `/api/channels` |
| `chat` | GET | `/api/messages` |
| `chat` | POST | `/api/messages` |
| `chat` | PATCH | `/api/messages/:id/pin` |
| `chat` | GET | `/api/messages/:id/translate` |
| `chat` | GET | `/ws` |
| `clinical` | POST | `/api/patients/:id/structure` |
| `clinical` | POST | `/api/clinical/:id/approve` |
| `clinical` | GET | `/api/patients/:id/clinical` |
| `consulta` | GET | `/api/consults/:id/state` |
| `consulta` | PUT | `/api/consults/:id/transcription` |
| `consulta` | PUT | `/api/consults/:id/consent` |
| `consulta` | GET | `/api/consults/:id/live` |
| `consulta` | GET | `/api/consults/:id/minutes` |
| `consulta` | POST | `/api/consults/:id/structure` |
| `consulta` | POST | `/api/consults/:id/report` |
| `consulta` | GET | `/api/consults/:id/report` |
| `consulta` | PUT | `/api/consults/:id/report` |
| `consulta` | POST | `/api/consults/:id/support` |
| `consulta` | GET | `/api/library` |
| `consulta` | POST | `/api/library` |
| `consulta` | DELETE | `/api/library/:id` |
| `consulta` | GET | `/api/me/clinical-prefs` |
| `consulta` | PUT | `/api/me/clinical-prefs` |
| `context` | GET | `/api/overview` |
| `context` | GET | `/api/shift` |
| `context` | GET | `/api/tasks` |
| `context` | POST | `/api/tasks` |
| `context` | PATCH | `/api/tasks/:id` |
| `context` | DELETE | `/api/tasks/:id` |
| `context` | GET | `/api/activity` |
| `context` | PATCH | `/api/me/ask-reason` |
| `context` | PATCH | `/api/users/:id/ask-reason` |
| `context` | GET | `/api/graph` |
| `documents` | POST | `/api/documents` |
| `documents` | GET | `/api/documents/:id/pdf` |
| `documents` | GET | `/api/verify/:id` |
| `familia` | GET | `/api/patients/:id/family-map` |
| `familia` | POST | `/api/patients/:id/family-map/generate` |
| `familia` | PUT | `/api/patients/:id/family-map` |
| `familia` | GET | `/api/protocol-order` |
| `familia` | GET | `/api/admin/protocol-order` |
| `familia` | PUT | `/api/admin/protocol-order` |
| `finance` | POST | `/api/packages` |
| `finance` | GET | `/api/packages` |
| `finance` | POST | `/api/payments` |
| `finance` | GET | `/api/finance/summary` |
| `followup` | GET | `/api/notifications` |
| `followup` | GET | `/api/notifications/count` |
| `followup` | PATCH | `/api/notifications/:id/read` |
| `followup` | POST | `/api/notifications/read-all` |
| `followup` | POST | `/api/routines` |
| `followup` | GET | `/api/routines` |
| `followup` | POST | `/api/routines/:id/passo` |
| `followup` | GET | `/api/routines/:id/qr.svg` |
| `followup` | GET | `/api/documents/:id/qr.svg` |
| `followup` | GET | `/api/patients/:id/followup` |
| `i18n` | PATCH | `/api/me/lang` |
| `i18n` | POST | `/api/i18n/translate` |
| `integracoes` | GET | `/api/admin/settings` |
| `integracoes` | PUT | `/api/admin/settings` |
| `integracoes` | POST | `/api/admin/settings/test` |
| `paypal` | POST | `/api/paypal/orders` |
| `paypal` | POST | `/api/paypal/orders/:id/capture` |
| `public` | GET | `/api/public/r/:token` |
| `public` | POST | `/api/public/r/:token/baixa` |
| `public` | GET | `/api/public/p/:token` |
| `public` | POST | `/api/public/p/:token/passo` |
| `setup` | GET | `/api/setup/status` |
| `setup` | POST | `/api/setup/unlock` |
| `setup` | POST | `/api/setup/migrate` |
| `setup` | GET | `/api/setup/check` |
| `setup` | POST | `/api/setup/test` |
| `setup` | POST | `/api/setup/save` |
| `setup` | POST | `/api/setup/finish` |
| `signup` | GET | `/api/signup/status` |
| `signup` | POST | `/api/signup` |
| `tasks` | GET | `/api/exercises` |
| `tasks` | POST | `/api/exercises` |
| `tasks` | POST | `/api/assignments` |
| `tasks` | GET | `/api/me/tasks` |
| `tasks` | POST | `/api/assignments/:id/log` |
| `tasks` | POST | `/api/patients/:id/evolution` |
| `tasks` | POST | `/api/patients/:id/goal` |
| `tasks` | GET | `/api/patients/:id/dashboard` |
| `video` | POST | `/api/video/token` |
| `video` | POST | `/api/video/invite` |
| `video` | POST | `/api/video/guest` |
| `video` | POST | `/api/consults/:id/audio` |
| `video` | GET | `/api/consults/:id/transcript` |
| `boot (antes do sistema iniciar)` | GET | `/api/setup/status` |

## 8. Operação
- **Subir/atualizar:** `docker compose up -d --build` (migrações automáticas); `scripts/update.sh`. **Logs:** `docker compose logs app`. **Backup:** Neon (PITR) + cópia da `DATA_KEY` + volume `appdata`.
- **HTTPS:** `DOMAIN=seu.dominio docker compose up -d` (Caddy); depois ajuste o endereço em Integrações.
- **Testes:** `npm test` (67 testes), `node scripts/check.js` (sintaxe). **Roteiro de produção:** `/api/audit/verify` = ok; login de cada perfil; duas abas no chat; conflito de agenda; vídeo entre dois navegadores; transcrição e failsafe de IA (`/api/ai/health`); documento verificável; compra de plano; bloqueio por teste vencido.
- **Problemas comuns:** `DATA_KEY deve ter 32 bytes em base64` → faltam as chaves (use o assistente, não é preciso `.env`); `502` do proxy → app ainda subindo (`docker compose logs app`); banco recusa conexão → connection string com `?sslmode=require` e IP liberado; usuário travado → Usuários → Destravar.

## 9. Primeiro acesso, restauração e implantação independente
- **Primeiro acesso:** ao abrir o endereço principal sem instalação concluída, `public/app.js` consulta `/api/setup/status` e abre o assistente sozinho. Depois de concluído (`setup_done` ou qualquer usuário existente) o assistente responde 410 e nunca mais aparece.
- **Restauração pelo root:** Integrações → "Restaurar a configuração original" (`POST /api/admin/reset-install`; só o `is_root`, reconfirmando a própria senha, digitando RESTAURAR, limite de 3 tentativas/10 min, auditado). Apaga **somente** `app_settings` (integrações e preferências), grava `setup_reset`, gera novo código de instalação (log e retorno ao root) e reabre o assistente em **modo restauração**: o root e todos os dados permanecem; só se adicionam pessoas novas e o cadastro público. Opcional "refazer banco e chaves": renomeia `data/config.env` para `config.env.bak-<data>` (guarda a DATA_KEY) e reinicia o processo; se as variáveis vierem do ambiente/`.env`, edite-as à parte. `POST /api/admin/cancel-reset` sai do modo restauração sem reinstalar (as integrações já apagadas não voltam). Senha de teste do instalador (somente servidor local ou `ALLOW_WEAK_PASSWORDS=true`): `root` / `arcano1234`, com troca obrigatória no primeiro login; em produção use senha forte.
- **Implantação independente** (`deploy/README.md`): `RUN_JOBS=false` e `src/worker.js` separam os jobs da API; `GET /api/health[?deep=1]`; Docker Compose com limites (`mem_limit`, `cpus`, `pids_limit`, healthcheck, logs rotativos); manifests Kubernetes (Deployment web e worker com 1 réplica e `Recreate`, PVC, Ingress, NetworkPolicy, Secret gerado por `deploy/gen-secrets.sh`); Oxmgr + systemd (`MemoryMax`, `CPUQuota`, usuário próprio). Escalar a API em várias réplicas não é suportado (presença e WebSocket em memória).

## 10. Limites conhecidos
Assinatura de receita é eletrônica simples (hash + QR), não ICP-Brasil; e-mail não é verificado no cadastro; sem push; uma instância por vez; a IA é apoio à decisão e exige revisão; tradução/guarani exigem revisão humana; interações medicamentosas em lista curta; **o servidor de instalação, as rotas de créditos/credenciais e a migração 013 foram verificados por testes unitários e sintaxe, mas ainda não exercitados contra um banco e Docker reais**: execute o roteiro acima numa instalação de homologação antes de produção.

### Qual usuário e senha usar após instalar?
- **Pelo assistente (normal):** no passo "Quem vai usar o sistema?" você define o usuário do root (padrão `root`), nome e e-mail, e escolhe **gerar senha temporária** (recomendado) ou a sua. Na última tela aparecem as credenciais **uma única vez**: copie. No primeiro login o sistema pede uma senha nova (12+ caracteres).
- **Não anotou, ou o assistente não abriu:** rode no servidor `docker compose exec app node src/reset-root.js` (sem Docker: `node src/reset-root.js`). Ele gera uma senha temporária nova para o root, ou cria o root se não existir, e a mostra no terminal.

### Sem Docker: PM2 + Nginx (ex.: script `instalar_atualizar`)
- `node src/server.js` (ou `npm start`) é o ponto de entrada e **abre o instalador no navegador** se faltar configuração; a aplicação em si está em `src/app.js`. Defina a porta com `PORT` (padrão 3000): `PORT=7012 pm2 start src/server.js --name talk`.
- Código do instalador: `pm2 logs talk --lines 50 | grep INSTALAÇÃO`. Configuração e chaves ficam em `data/config.env` (0600; faça backup da `DATA_KEY`).
- O Nginx precisa repassar WebSocket (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_http_version 1.1;`) e `X-Forwarded-Proto`.
- Erro `self-signed certificate` (`DEPTH_ZERO_SELF_SIGNED_CERT`) ao conectar no banco: comum em PostgreSQL instalado no próprio servidor (Debian/Ubuntu geram certificado autoassinado). No instalador, desmarque "Exigir conexão criptografada" (banco local) ou defina `PGSSL=false`. Com Neon o certificado é válido e a opção deve ficar marcada.
- `node src/migrate.js` solto, sem variáveis, não funciona: o próprio sistema aplica as migrações ao iniciar.
