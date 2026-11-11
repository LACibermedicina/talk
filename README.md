<<<<<<< HEAD
# talk
=======
# Talk.M3D — pacote de instalação (servidor + web app)

Messenger clínico em três colunas (conversas · chat/agenda · painel do paciente), com teleconsulta, agenda com arrastar e soltar, notas, financeiro, auditoria e IA com failsafe. Web app instalável (PWA) servido pelo próprio servidor.

> **Estado:** código completo. Passam a verificação de sintaxe, 22 testes automáticos (regras de receitas/rotinas, papéis, criptografia, política de senhas e tradução) e um teste de fluxo da interface contra uma API simulada. **O servidor ainda não foi executado contra um banco real**: faça o roteiro de testes no fim deste arquivo antes de usar com pacientes.

**Exemplo visual:** abra `docs/exemplo-pos-instalacao.html` no navegador (arquivo único, sem servidor) para ver o sistema já instalado, com um guia passo a passo das funcionalidades.

## Do GitHub ao servidor (resumo)
1. **Publicar:** descompacte, entre na pasta e rode
   `git init -b main && git add . && git commit -m "Talk.M3D" && git remote add origin git@github.com:SEU_USUARIO/talk-m3d.git && git push -u origin main`.
   Use um repositório **privado**. O `.gitignore` já exclui `.env`, `node_modules` e `config/usuarios.json`. Defina a licença antes de abrir o código (nenhuma foi escolhida).
2. **Instalar no servidor** (Linux com Docker): `git clone git@github.com:SEU_USUARIO/talk-m3d.git && cd talk-m3d && bash scripts/install.sh`. O script pergunta o domínio e a `DATABASE_URL` do Neon, gera `JWT_SECRET` e `DATA_KEY`, sobe tudo e mostra o código do assistente de instalação.
3. **Abrir o endereço** e seguir o assistente (verifica o servidor, testa e grava as chaves cifradas, cria root e equipe).
4. **Atualizar depois:** `bash scripts/update.sh` (faz `git pull` e reconstrói; migrações rodam sozinhas).
5. **CI:** o GitHub Actions (`.github/workflows/ci.yml`) verifica sintaxe, roda os testes e constrói a imagem Docker a cada push.

## O que vem no repositório
- `src/` API Fastify (auth, agenda, chat/WebSocket, vídeo Agora, financeiro, PayPal, exercícios, prontuário, documentos PDF, auditoria, anomalias, jobs de SMS).
- `public/` web app Talk.M3D (sem scripts inline, compatível com CSP estrita), PWA (manifest, service worker, ícones) e a logo.
- `db/` migrações SQL aplicadas em ordem por `node src/migrate.js`.
- `Dockerfile`, `docker-compose.yml`, `Caddyfile` (HTTPS automático), `.env.example`.
- Banco: **Neon** (gerenciado). Vídeo: **Agora**. IA: Gemini → OpenAI → Anthropic (failsafe). Pagamento: PayPal. SMS: Twilio.

## Manuais
- **Manual técnico:** `docs/MANUAL_TECNICO.md` (arquitetura, instalador e diagnóstico, banco, credenciais, créditos, API, operação).
- **Manual do usuário:** `docs/MANUAL_USUARIO.md` (por perfil e recurso).
- A instalação mais simples está em **v7** (final deste arquivo): `docker compose up -d --build` e o assistente do navegador configura tudo; o passo a passo com `.env` abaixo continua válido como alternativa.

- **Implantação independente (Docker com limites, Kubernetes, Oxmgr + systemd):** `deploy/README.md`.

## Instalação (VPS Linux com Docker)
1. **Gire as credenciais que apareceram em conversa** (chaves de IA, Agora, PayPal, GitHub, senhas de e-mail) e gere novas. Nunca coloque chaves em arquivos do pacote.
2. DNS `seu.dominio` → IP do servidor; libere 80/443.
3. `cp .env.example .env` e preencha só as 6 linhas (`DATABASE_URL` do Neon, `JWT_SECRET`, `DATA_KEY`, `DOMAIN`, `APP_ORIGIN`, `TZ`).
4. `docker compose up -d --build` (as migrações do banco rodam sozinhas ao iniciar).
5. Veja o código de instalação: `docker compose logs app | grep INSTALAÇÃO`.
6. Abra `https://seu.dominio`: **o assistente de primeira instalação abre sozinho** e guia, passo a passo e com explicações: código de instalação, verificação do servidor (banco, TLS, HTTPS, cookies, SDK de vídeo, memória, saída de rede), importação de credenciais coladas, Agora, IA com plano B, PayPal/SMS (opcionais), root e equipe base. Cada chave é testada antes de gravar; no fim aparecem as senhas temporárias (uma única vez).
7. Entre como root, troque a senha quando o sistema pedir e use **Integrações** (menu do admin) para mudar chaves depois.
Alternativa sem tela: `node src/setup.js config/usuarios.json` (veja `config/usuarios.exemplo.json`).

## Receitas, rotinas e QR code
- O administrador cadastra o **registro profissional** (CRM, CREFITO, COREN…) e a **imagem da assinatura** em *Cadastro de usuários → configurar*. Receita só sai de médico com registro configurado. A assinatura é **eletrônica simples** (imagem + selo + hash), **não ICP-Brasil**; o número do conselho não é conferido no CFM.
- Cada receita/pedido tem **usos máximos** e **validade** definidos pelo médico. O QR abre `/r/<token>`: mostra o médico responsável (nome e registro), o texto, os usos e botões “foi utilizada” / “não foi utilizada”. Passou do máximo: **“Número máximo de usos já utilizado”** e os botões somem. Cada baixa registra nome e local, notifica o médico e entra no seguimento do paciente.
- **Rotinas** têm etapas em ordem fixa; o QR abre `/p/<token>` e só a etapa atual pode ser concluída. Ao terminar tudo: **“Todas as atividades concluídas”**. O profissional recebe notificação a cada etapa e ao final (“revisar manejo”).
- Privacidade: a página do QR mostra o texto da receita a quem tem o QR (como o papel). Use validade curta e poucos usos; o token tem 144 bits e há limite de requisições por IP.

## Superusuário root, senhas e cadastro público
- **Root:** o superusuário se chama **`root`** (login por usuário ou e-mail). Ele não pode ser bloqueado, é o único que cria outros administradores e configura a parte administrativa (usuários, integrações, cadastro público). A senha é definida **por você no assistente de instalação**; o sistema não traz senha embutida.
- **Senha de teste `root` / `arcano`:** o assistente só oferece essa opção em **teste local** (`APP_ORIGIN` com `localhost`) ou se você ligar `ALLOW_WEAK_PASSWORDS=true` no `.env`. Em servidor público ela é recusada (o usuário “root” é o primeiro que qualquer pessoa na internet tentaria). Mesmo no modo de teste, o primeiro login obriga a trocar para uma senha forte (12+ caracteres). Não reutilize essa senha em outros serviços.
- **Proteção contra tentativas:** 8 senhas erradas bloqueiam a conta por 15 minutos, e o login tem limite por IP.
- **Cadastro público de novos usuários** (sempre como paciente): três modos, escolhidos no assistente e alteráveis depois por qualquer administrador em *Integrações → Cadastro público*:
  - **Desativado** (padrão, recomendado): só a clínica cria contas.
  - **Com aprovação:** a pessoa se cadastra e a recepção ou o administrador aprova ou recusa em *Cadastro de usuários* (há notificação de pedido novo).
  - **Aberto:** a conta fica ativa na hora. O e-mail ainda **não é verificado** (esta versão não envia e-mails).
- **Teste local rápido:** `.env` com `DOMAIN=localhost`, `APP_ORIGIN=https://localhost`, `COOKIE_SECURE=false`; `docker compose up -d --build`; abra https://localhost (o Caddy gera um certificado local) e use o assistente.

## Papéis
| Tipo (`tipo`) | Quem é | Acesso |
|---|---|---|
| `admin` | Administrador (um deles é o root) | Usuários, auditoria, alertas, financeiro, relatórios; **sem** dado clínico |
| `medico` | Médico(a) | Prontuário dos pacientes vinculados; receita, atestado, pedidos e relatórios; IA |
| `fisio`, `enfermeiro`, `nutricionista`, `farmaceutico`, `profissional` (outro profissional de saúde) | Profissionais de saúde | Prontuário dos vinculados; relatórios (fisio também atestado); exercícios, evolução, metas |
| `cuidador` | Equipe assistencial | Agenda, tarefas, evolução (EVA) e chat dos vinculados; **sem** prontuário, documentos ou resumo clínico |
| `recepcao` | Secretaria | Agenda, financeiro, cadastro de pacientes e vínculos; sem dado clínico |
| `funcionario` | Funcionário não profissional (apoio) | Igual à recepção |
| `paciente` | Paciente | Só os próprios dados e os profissionais vinculados |

`cargo` é um rótulo livre mostrado na tela (ex.: “Psicóloga”, “Auxiliar administrativo”). Há ainda uma tela **Cadastro de usuários** (com usuário de login opcional, aprovação de pedidos pendentes e vínculo paciente ↔ profissional) (admin; recepção só cadastra pacientes) para criar pessoas, gerar senha temporária e vincular paciente ↔ profissional.

## Menu em blocos e idiomas

**Menu em blocos (à esquerda).** Os ícones da barra lateral (Usuários, Gestão, Canais internos, Relatórios, Conta) escolhem qual grupo de blocos aparece. Cada bloco tem cor própria, pode ser minimizado, e passa a rolar com busca quando tem mais de 5 pessoas. Você cria grupos próprios, arrasta pessoas entre eles e usa “Resetar organização” para voltar ao original. O número de pessoas visíveis por bloco (3 a 20) é ajustado em Configurações. A organização fica salva no navegador (`m3d_layout_<usuário>`).

**Idiomas.** Português (Brasil), espanhol, guarani, inglês e chinês, escolhidos no seletor do menu (a escolha é gravada em `PATCH /api/me/lang`). Textos fixos da interface usam o dicionário `public/i18n-dict.js`; o que falta é traduzido pela IA do servidor (`POST /api/i18n/translate`), com o contexto da tela, cache em `i18n_cache` e limite diário por usuário (`I18N_DAILY_LIMIT`, padrão 3000). **Nomes, mensagens, notas e outros dados de pacientes e equipe nunca são traduzidos nem enviados à IA**; textos com e-mail, link ou número longo também são recusados pelo servidor. A base em guarani é reduzida e **precisa de revisão por falante nativo**; a qualidade da tradução por IA pode variar.

## Ajuda, mapa, anotações, calendário e painel (v2)

- **Ajuda e guia:** o botão **?** no topo do menu (ou Alt+G) abre um guia que **destaca a área explicada** (o resto da tela fica com overlay e desfoque; a área em foco continua clicável) e mostra o texto junto dela. **Dois cliques fora da caixa** (ou Esc, ou ×) fecham o guia; ele reabre pelo mesmo botão. No HTML de exemplo o botão flutuante “Ajuda” faz o mesmo. Código em `public/help.js`.
- **Menu como caixa de e-mail:** tópicos em blocos coloridos recolhíveis (Agenda e atendimento, Financeiro, Administração, Acompanhamento, Análise, Preferências, Sessão), cada função com **ícone** e contador; “Recolher/Expandir tudo”.
- **Pacientes online:** bolinha verde/cinza nos contatos e nos cards do painel, resumo “N pacientes online agora” e filtro “Só online”. “Online” = ter uma conexão WebSocket aberta com o servidor (`src/presence.js`, vale para uma instância; atualiza a cada 30 s).
- **Mapa de relações:** cada função tem cor (médico, fisio, enfermagem…) e cada vínculo tem tipo de linha diferente, com **legenda** (clique para ocultar). O nome mostra a **função antes** (“Médico · Ana”, “Paciente · Maria”). Clicar em um item abre o **detalhe** (dados, tarefas abertas, ligações) e permite **salvar nas anotações**.
- **Bloco de anotações:** cartões do mapa com a sua observação; “Ver no mapa” volta ao item. **Ficam só no navegador** (`localStorage`): contêm nomes e dados de pacientes, então apague-os em computador compartilhado.
- **Calendário de tarefas em post-its** no painel lateral (e em Gestão → Tarefas e calendário): tarefas com prazo e consultas aparecem por dia, com quadradinho discreto para concluir; clique no dia para ver a lista; minimize, padrão ou amplie. Com um paciente (ou colega) em foco, os itens dele ganham **destaque neon**, aparece o painel “Hoje · paciente”, o painel “Pendências de hoje (todas)” e botões para abrir os pacientes e profissionais ligados a cada tarefa. Tarefas sem prazo e abertas aparecem em “hoje”, marcadas “sem data”.
- **Desenvolvimento global:** mini painel com frequência no plano, pendências, metas e tendência da dor, cada um com link para o painel de quem mais precisa de atenção. Itens sem dados não aparecem e, sem nenhum dado, o bloco some.

## Como cada recurso aparece na tela
| Recurso | Onde |
|---|---|
| Chat em tempo real, tradução, urgência destacada | coluna central; botão “Traduzir” por mensagem |
| Canais internos e mensagens fixadas | lista esquerda → “Canais Internos”; “Fixar” na mensagem |
| Agenda com arrastar e soltar, cards, notas | “Agenda Visual”: arraste cards; `+` cria; clique abre detalhes e notas (cifradas) |
| Risco de falta e lembrete por SMS | ícone de alerta no card; SMS automático (24 h, 48 h se risco ≥ 0,4) |
| Teleconsulta, compartilhar tela, transcrição | “Video Chat” (exige consulta agendada agora ±3 h); “Transcrever (IA)” exige consentimento |
| Convite de especialista por link | `POST /api/video/invite` → `/convite/<token>` (só durante a consulta) |
| Resumo, evolução e meta, plano, documentos | painel direita (abas) |
| IA estrutura conversa → rascunho → aprovação | painel → “Estruturar conversa com IA” → “Aprovar” |
| Documentos com hash/QR enviados no chat | painel → Documentos |
| Financeiro e pacotes, PayPal | “Financeiro” (recepção/admin); API `/api/paypal/*` |
| Auditoria (cadeia de hash) e alertas | “Auditoria” (admin) |
| Painel lateral por contexto | paciente → prontuário; plantão → triagem, equipe, atendidos x pendentes, movimentos; avisos-gerais → triagem, kanban, timeline; outro canal/colega → visão geral com cards e gráfico global |
| Agenda em foco | ao abrir um paciente (ou colega), os cards dele ficam em destaque e os demais esmaecidos, ainda editáveis; “Limpar foco” |
| Histórico de atividades | “Relatórios → Histórico de atividades”: quem, quando, de→para e motivo; filtro por usuário |
| Justificativa ao mover consulta | caixa pede o motivo; “não pedir mais” desativa; o admin restabelece no histórico |
| Relações (3D) | “Relatórios → Relações (3D)”: 3 níveis de complexidade; arraste, zoom e clique |

## Segurança
Argon2 · cookie httpOnly/Secure/SameSite=Strict · CSP sem `unsafe-inline` em scripts · verificação de origem · rate limit · validação Zod · SQL parametrizado · RBAC + vínculo profissional↔paciente (admin não lê dado clínico) · mensagens, transcrições, notas e história clínica cifradas em repouso (AES-256-GCM, chave `DATA_KEY`) · auditoria encadeada por hash, imutável por trigger · contêiner sem root, somente leitura · IA só gera rascunhos · transcrição só com consentimento.

## Regras de contexto e privacidade
- Dados do paciente só aparecem no painel quando há contexto de paciente (conversa com ele, card selecionado na agenda ou o próprio paciente logado). Fora disso o painel mostra só visão geral/resumos.
- Profissional vê apenas pacientes vinculados (care-team); recepção/admin veem pendências de agenda, nunca dados clínicos. O nível 3 do grafo (terapias, solicitações) só é montado para profissionais e admin.
- O histórico guarda quem/quando/de→para/motivo, sem conteúdo clínico. A justificativa é obrigatória no servidor (HTTP 428) enquanto `users.ask_reason` for verdadeiro.

## Limites conhecidos
- Tradução por IA e o dicionário em guarani exigem revisão humana antes de uso clínico; conteúdo clínico escrito pelos usuários não é traduzido.
- Triagem do plantão = mensagens urgentes das últimas 24 h + alertas abertos (regras simples, não classificação de risco clínica). Disponibilidade = carga de agenda, não escala de turnos real.
- Kanban e notificações usam as tabelas `tasks` e `activity_log`; ainda não há notificação push.
- O grafo 3D é desenhado em canvas (sem biblioteca) e funciona bem até algumas centenas de nós.
- Cadastro de usuários e vínculos tem tela; **convite de especialista por link e cobrança PayPal** continuam só pela API.
- Para agendar, o profissional só vê pacientes vinculados a ele; a recepção vincula pela API/ao criar a consulta.
- Selo do PDF = hash + QR; **não é ICP-Brasil** (receita com validade legal exige integração).
- Criptografia em repouso com chave do servidor, não ponta a ponta.
- Previsão de faltas e anomalias são regras simples; calibre com dados da clínica.
- Arrastar com mouse não funciona em tela de toque; use o campo “Data e horário” do detalhe.
- Rode **uma** instância (jobs in-process). Faça backup (Neon PITR) e guarde a `DATA_KEY` em cofre separado.
- LGPD: controlador/encarregado, RIPD, termo de consentimento e contratos com provedores de IA são responsabilidade da clínica.

## Roteiro de testes antes de produção
1. `/api/audit/verify` retorna `ok`. 2. Login de cada papel; paciente não vê outro paciente. 3. Duas abas trocando mensagens (WebSocket). 4. Criar consulta, arrastar para outro horário, tentar conflito (deve recusar). 5. Videochamada entre dois navegadores. 6. Transcrição com chave de IA válida; derrubar a chave do Gemini e ver o failsafe em `/api/ai/health`. 7. Emitir documento e abrir `/api/verify/<id>`. 8. PayPal em sandbox. 9. Instalar o PWA no celular.

## Estrutura
`src/` API (rotas, regras em `logic.js`, papéis em `roles.js`) · `public/` web app (`app.js`, `ui2.js`), ajuda (`help.js`), assistente de instalação (`wizard.js`) e PWA · `db/` migrações SQL (001–013) · `scripts/` instalação, atualização e verificação · `tests/` testes automáticos (`npm test`) · `docs/` exemplo visual pós-instalação · `config/usuarios.exemplo.json` modelo de usuários para o modo sem tela.

## v3 — Dashboards de gestão, atalhos do chat e login de teste

- **Dashboards de gestão**: Agenda, Tarefas, Financeiro, Usuários, Integrações e Auditoria abrem um dashboard (não um chat) com painéis de relatórios e funções da área. Cada painel pode ser movido, redimensionado, minimizado, maximizado (ou duplo clique no título) e fechado. Painéis fechados voltam pelo menu **Painéis**; **Reorganizar** restaura o padrão. O layout é salvo no navegador (localStorage, por usuário e por tela).
- **Dock**: painéis minimizados ficam na base como ícones estilo macOS, com fundo translúcido (blur) e ícones inteiros dentro da barra.
- **Atalhos do chat conforme o interlocutor**: paciente → *Agendar consulta* / *Ver prontuário*; médico ↔ médico → *Interconsulta*; recepção → *Checar agenda*; demais profissionais e canais → *Agendar reunião*.
- **Login de teste (somente no demo HTML)**: o exemplo pós-instalação mostra botões de acesso rápido com as credenciais de teste. O servidor real **não** possui esse recurso.

### Modo de teste no servidor (`TEST_MODE=true`)

Para testar uma instalação sem criar usuários à mão, ponha `TEST_MODE=true` no `.env` (com `APP_ORIGIN` em localhost ou `ALLOW_WEAK_PASSWORDS=true`) e reinicie. O servidor cria/atualiza as contas **root/arcano1234** e `admin@`, `medico@`, `recepcao@`, `paciente@demo.com` / **demo**, e a tela de login mostra o painel "Credenciais de teste" com acesso por toque. Sem `TEST_MODE`, ou fora de servidor local, nada disso existe (o endpoint responde 404). Se já houver um root, as credenciais de teste o sobrescrevem. **Desligue antes de usar dados reais.**

### v4 — menu recolhível, bandeiras e fechar janela

- **Menu lateral:** com uma funcionalidade aberta (agenda, dashboards, relatórios…), clicar fora do menu o oculta. Com o chat aberto ele permanece até o usuário minimizar pelo botão ☰ da barra (o mesmo botão reabre). Em telas pequenas o menu continua sendo uma gaveta.
- **Idiomas com bandeiras** (SVG embutido, aparecem em qualquer sistema): 🇧🇷 português, 🇪🇸 espanhol, 🇵🇾 guarani, 🇺🇸 inglês, 🇨🇳 chinês.
- **Botão ✕ Fechar janela** no chat e em todas as funcionalidades. Fechar o chat encerra a conversa aberta; fechar uma função volta ao chat e reabre o menu.

### v4.1 — tela inicial (desktop) e dock

- **Tela inicial:** sem conversa aberta, o painel central vira um desktop: logo do sistema ao fundo, post-its (agenda de hoje, tarefas pendentes, notificações novas, anotações importantes) e, embaixo, ícones das funcionalidades no estilo macOS, filtrados pelo perfil do usuário. Cada post-it leva à tela correspondente. Fechar o chat ou uma função (✕) volta a esse desktop. Quem entra como paciente cai direto na conversa com o profissional.
- **Dock dos dashboards:** fica sempre na base e mostra **todos** os painéis. Clicar no ícone de um painel visível o fecha; clicar no de um painel fechado o abre em tamanho grande. O ponto sob o ícone indica painel aberto.
- **Minimizar** transforma o painel em um quadro pequeno (movível); **maximizar** o leva ao tamanho grande; restaurar devolve posição e tamanho originais.
- A logo não se repete mais na barra lateral de ícones.

### v4.2 — menu com 2 cliques, barra superior e estado de presença

- **Menu lateral (desktop):** 2 cliques fora dele o ocultam; uma pequena aba vertical "Talk.M3D" (com a logo) na borda esquerda o reabre com um clique. O botão ☰ também alterna. Com o chat aberto o menu só some por pedido do usuário.
- **Barra superior:** ícone de desktop (volta à tela inicial), sino com painel discreto de notificações (marcar como lidas, abrir) e seletor de estado **Online / Ocupado / Offline**. O estado é guardado em `users.presence` (**migração 009**, que também cria `users.country`) e é visto pelos outros usuários; "offline" aparece como desconectado mesmo com a sessão aberta.

### v4.3 — Caso clínico (painel lateral do paciente)

Na conversa com um paciente, profissionais de saúde têm a aba **Caso clínico**:
- **Resumo de apresentação** do caso, compilado do prontuário vinculado (apenas registros aprovados).
- Sob solicitação: **conduta e próximos passos** segundo as diretrizes do país do médico (`users.country`, 13 países), **alternativas segundo diretrizes internacionais**, **SOAP** completo (com opção de incluir a história clínica completa) e **estudo de caso** em formato científico no idioma do sistema.
- Cada resultado abre como **janela** que pode ser minimizada, copiada, **fixada no desktop** (post-it "Casos fixados") ou reduzida a ícone na lateral do painel. Exportação em **PDF** pela caixa de impressão do navegador.
- **Privacidade:** a IA nunca recebe nome, e-mail ou telefone do paciente (usa "Paciente"); exige `ai_consent` do profissional; o estudo de caso tem opção de anonimizar. Textos longos usam `AI_LONG_TIMEOUT_MS`. Os resultados da IA são **apoio à decisão** e devem ser revisados pelo profissional. Fixações ficam apenas no `sessionStorage`.

### v4.4 — tradução com IA e jargão técnico

Todo texto da tela é traduzido para o idioma escolhido: dicionário embutido (es/en/zh) e, para o que falta (e para o guarani), a IA do servidor com cache e limite diário. Termos técnicos são vertidos para o jargão técnico local equivalente ou mantidos no original quando não há termo local. Dados dos usuários (nomes, mensagens, prontuário) nunca são traduzidos.

### v4.5 — post-its do desktop

Cada post-it (agenda, tarefas, notificações, anotações, casos fixados) pode ser **arrastado pelo título**, **minimizado** (▁, vira só o cabeçalho) e **expandido em detalhe** (⤢ ou duplo clique no título): agenda dos próximos 7 dias por dia, tarefas agrupadas (atrasadas/hoje/próximas/sem prazo) com responsável e paciente, notificações com texto completo, anotações completas e casos fixados com pré-visualização. Posição e estado ficam no navegador por usuário (`m3d_pit_<id>`); **Reorganizar post-its** restaura o padrão.

### v4.6 — barra inferior estática, itens solicitados, pilha de post-its

- **Barras de ícones (dock dos painéis e desktop):** sem movimento que desloque a barra; ao passar o mouse só há um zoom leve e um pequeno brilho neon.
- **Só os itens solicitados:** o dock dos dashboards mostra apenas os painéis abertos (os fechados voltam pelo menu *Painéis*); a barra do desktop começa com o botão **+** e guarda só as funcionalidades que o usuário abrir/adicionar (× no ícone remove). Preferência salva no navegador (`m3d_hd_<id>`).
- **Post-its:** **▁** minimiza para uma **pilha lateral** de ícones (clique restaura); **2 cliques no título** recolhem só a barra e mais 2 cliques reabrem; **arrastar** pelo título move.
- **Logo do menu:** clicar na logo/nome "Talk.M3D" do menu lateral leva ao desktop.

### v5 — chat de ajuda com IA, videochamada flutuante e ferramentas da consulta

**Chat de ajuda (botão "Ajuda"):** abre um chat com a IA do sistema (o guia passo a passo continua no botão "?" do chat e em Alt+G). A IA só conhece e só indica as funções do **perfil** do usuário (paciente não recebe funções de gestão ou clínicas), não recebe dados de pacientes, sugere botões "Abrir …" apenas para telas permitidas e, sem IA, cai num plano B por palavras-chave (`POST /api/assistant`). A conversa fica só em memória.

**Janela da videochamada:** pode ser **movida** (arrastando o título), **redimensionada**, **maximizada** e **reduzida a uma miniatura no canto** (como o modo flutuante de vídeos), seguindo a conversa enquanto você usa outras telas.

**Ferramentas da consulta (somente profissionais de saúde; o paciente não as vê):** ao iniciar a chamada aparece a **barra de tarefas da chamada**, com ícones que abrem janelas discretas (mover, ▁ iconificar na barra, ⤢ maximizar, 2 cliques no título recolhem):
- **Transcrição:** liga/desliga. Ao ligar, o paciente recebe um pedido de **consentimento** na própria chamada (aceitar/recusar); sem aceite, o áudio dele não é enviado nem transcrito. A transcrição é cifrada no banco, fica visível só ao profissional responsável e é **estruturada automaticamente** (queixa, HDA, medicações, alergias, hipóteses, conduta discutida e pendências). O áudio é transcrito por provedor de STT (`OPENAI_API_KEY` ou `GEMINI_API_KEY`) em blocos de 10 s do microfone de cada participante.
- **Histórico por minuto:** histórico integral falas a falas, agrupado por minuto, com resumo de cada minuto e cópia.
- **Relatório:** rascunho em Markdown no padrão de documentação médica (identificação e modalidade, queixa, HDA, antecedentes/medicações/alergias, exame, impressão, conduta, orientações, encaminhamentos, pendências) **+ relato de caso (CARE)**; editável, salvável, copiável e exportável em PDF pela impressão. Depois de encerrar a chamada a barra permanece com Histórico e Relatório.
- **Apoio cognitivo** (aparece depois de ligar a transcrição): feedback em tempo real com resumo, caracterização do caso, hipóteses, condutas, riscos, perguntas sugeridas e **interconsultas**. Fontes por prioridade: **Ministério da Saúde → sociedades de especialidade → OMS → materiais do usuário → materiais gerais** (biblioteca). Em terapêutica e farmacologia segue o Ministério da Saúde, **exceto onde o profissional registrou uma preferência da unidade** (marcada como "preferência local"). **Alertas imediatos, sem IA:** interações medicamentosas (lista curada de associações de alto risco, cruzando falas e prontuário) e sinais de alarme (dor torácica, risco de suicídio, sinais de AVC etc.). Interconsultas: se a equipe do paciente tem o profissional, sugere agendar; senão mostra profissionais **online** da especialidade; sem ninguém, só registra o **encaminhamento**.
- **Biblioteca e preferências:** cada profissional guarda materiais próprios (opcionalmente compartilhados como "gerais") e preferências locais por tema. Fontes oficiais (Ministério/sociedades/OMS) são cadastradas pelo **administrador** via `POST /api/library` com `tier` (`ministerio`, `sociedade`, `oms`) e `country`. A Biblioteca também está no desktop.

**Privacidade e segurança:** exige `ai_consent` do profissional; o nome do paciente é removido do texto enviado à IA; ações são auditadas (`transcricao_on/off`, `consent_transcricao`, `relatorio_consulta`, `apoio_cognitivo`…); o endpoint de áudio recusa envio sem transcrição ativa e, para o paciente, sem consentimento. Todo conteúdo gerado é **rascunho de apoio à decisão**: revisar antes de usar. A tabela de interações é uma lista curta e **não substitui** base farmacológica oficial.

**Instalação:** rode a migração `010_consulta.sql` (tabelas `consult_state`, `library_items` e `users.clinical_prefs`). Rotas novas: `/api/consults/:id/{state,transcription,consent,live,minutes,structure,report,support}`, `/api/library`, `/api/me/clinical-prefs`, `/api/assistant`.

**Limites conhecidos:** o relatório de consultas antigas só é acessado pela barra enquanto a janela está ativa (ainda não há lista de consultas anteriores); no demo a chamada é simulada e as falas/respostas da IA são roteiros de exemplo; o transcritor depende de provedor de STT configurado.

### v5.1 — mesmo comportamento em todos os quadros

Em todos os quadros (post-its do desktop, painéis dos dashboards, janelas do caso clínico, janelas das ferramentas da consulta e a caixa da videochamada): **arrastar o título move** e **2 cliques no título minimizam** (post-its e ferramentas recolhem só a barra; painéis dos dashboards viram quadro pequeno e vão para o dock; janelas do caso viram ícone lateral; a videochamada vai para a miniatura no canto). Mais 2 cliques restauram. Nos dashboards, o ⤢ do quadro continua maximizando.

## v5.2 — Todas as funcionalidades são painéis; menu lateral; dock

- Grafo de relações, histórico, anotações, notificações, configurações e a agenda do paciente abrem como painéis: mover (arrastar o título), redimensionar (canto), maximizar, minimizar (▁ ou **2 cliques no título**) e ocultar (✕), como os demais painéis.
- **Dock inferior de painéis**: clicar no ícone de um painel aberto o **minimiza**; se estiver minimizado ou oculto, ele **abre em primeiro plano**. Os painéis ocultos voltam pelo menu "Painéis".
- Menu lateral de contatos (com uma conversa aberta): clicar na área da conversa o oculta; aproximar o mouse da borda esquerda o revela como sobreposição; só o clique na aba vertical da logo ("Fixar menu de contatos") o fixa. Clicar na logo/nome "Talk.M3D" leva ao desktop.

## v5.4 — Familiograma e ecomapa

No **Caso clínico** do paciente (somente profissionais de saúde com vínculo): botões **Familiograma** e **Ecomapa**.
- A IA monta o desenho a partir da história clínica aprovada (sem nome do paciente; parentes identificados pelo parentesco), seguindo a **hierarquia protocolar**: Ministério da Saúde → sociedades → OMS → material do usuário → material geral. Nada é inventado: o que faltar vem em "Observações e o que perguntar".
- Familiograma (McGoldrick): quadrado/círculo/losango, falecido (X), paciente-índice (borda dupla), uniões (casamento, união, separado //, divorciado ///), filhos por gerações e condições relevantes. Ecomapa (Hartman): vínculos forte, fraco, estressante (zigue-zague) e rompido, com sentido do fluxo (setas).
- Editável (pessoas, uniões, vínculos), imprimível/PDF; a janela tem as mesmas propriedades de painel (mover, redimensionar, maximizar, recolher com 2 cliques, fechar). Dados cifrados em `family_maps` (**migração `db/011_familia.sql`**), com auditoria (`familia_ia`, `familia_edit`).
- API: `GET /api/patients/:id/family-map?kind=genograma|ecomapa`, `POST …/family-map/generate`, `PUT …/family-map`.
- **Hierarquia protocolar personalizável** (administrador): Biblioteca → aba "Hierarquia protocolar" (subir/descer as 5 fontes, restaurar padrão). Gravada em `PROTOCOL_ORDER` (app_settings) e vale para o apoio cognitivo, o familiograma e o ecomapa. APIs: `GET /api/protocol-order`, `GET/PUT /api/admin/protocol-order`.
- Limites: a IA depende de haver história familiar registrada; é rascunho de apoio e deve ser confirmado com o paciente. Na demonstração os desenhos são exemplos fixos.

## v5.5 — Submenu de ícones no topo e uma funcionalidade por vez

- Os ícones de ação da funcionalidade em foco aparecem numa **barra fina no topo da tela** (ícones de linha, com o rótulo do grupo — ex.: "Relatório", "Familiograma e ecomapa", "Resultado do caso"); ela troca sozinha conforme a janela/painel em foco. Cada ícone tem descritor ao passar o mouse e o ativo fica destacado.
- Os ícones das funcionalidades (barra da consulta, ícones laterais do Caso clínico, dock) continuam; **ao acionar uma funcionalidade, a anterior é fechada** (a janela volta a ser só o ícone). Os painéis do dashboard continuam podendo coexistir.

## v5.6 — Dock de funcionalidades persistente e submenu superior animado

- O **dock de funcionalidades** (estilo macOS, discreto) continua visível na área de trabalho e **dentro de qualquer funcionalidade aberta**; a funcionalidade ativa fica marcada e clicar nela de novo volta ao desktop.
- As **subfunções** da funcionalidade aberta (painéis internos e ações) ficam na **barra superior**: ícones pequenos, lado a lado, em estilo animado (cores suaves, brilho, flutuação discreta e "pulo" ao passar o mouse; respeita `prefers-reduced-motion`). Clicar no ícone de um painel o minimiza/restaura; painéis ocultos aparecem esmaecidos e voltam em primeiro plano.

## v5.7 — Barra de submenus móvel, 3 cliques e última modalidade

- A barra de submenus pode ser **arrastada** (pelo rótulo do grupo ou pelo fundo da barra); a posição fica gravada neste navegador.
- **3 cliques** na barra fecham a funcionalidade em foco (janela da consulta, familiograma, janela do Caso clínico; no dashboard, volta ao desktop).
- Ao clicar no ícone de um item: aberto → minimiza; minimizado ou fechado → abre **na última modalidade usada** (normal, maximizado ou recolhido), tanto nos painéis quanto nas janelas.

## v5.8 — Submenu superior da videochamada

Durante a chamada (profissional), a barra de submenus mostra o grupo **Videochamada** com as subfunções em ícones pequenos lado a lado: ligar/desligar transcrição (indicador vermelho de gravação), transcrição ao vivo, transcrição estruturada, histórico por minuto, apoio cognitivo (âmbar se houver interação grave), relatório, biblioteca e controles da janela da chamada (iconificar/maximizar). Ao abrir o detalhamento de uma delas, a barra acrescenta as ações daquela janela. Os ícones das funcionalidades continuam na barra inferior. O paciente não vê nada disso.

## v5.9 — Funcionalidades abrem sem quadros

Ao abrir uma funcionalidade do dock, ela **começa sem quadros abertos**; os quadros aparecem esmaecidos na barra de submenus e abrem com um clique, na última modalidade usada (normal ou maximizado). Novo ícone **Fechar todos os quadros** na barra de submenus (e "Abrir todos os painéis" para o contrário).

## v6 — Anotações laterais, submenu ancorado, itens móveis e cor vinculada ao ícone

- **Anotações** salvas aparecem como post-its especiais (amarelos, com alfinete) na pilha lateral do desktop; ao passar o mouse mostram o título e um trecho; clicar abre o bloco de anotações.
- **Barra de submenus** fica no topo do sistema, **alinhada antes do ícone de desktop**, sem cobrir links (se faltar espaço ela rola). Pode ser arrastada, mas **volta à posição** ao abrir outra funcionalidade.
- **Mover também**: botão Ajuda, janela do assistente (pelo cabeçalho), dock de funcionalidades e barra da consulta. A posição fica gravada neste navegador; "Reorganizar (padrão)" no menu Painéis restaura.
- **Cor como identidade**: ao abrir/focar um quadro pelo ícone do submenu, o fundo da área e a própria barra assumem a cor desse ícone, e cada quadro recebe um tom da sua cor, ligando visualmente a função ao que aparece.


## v7 — Instalador de primeiro acesso, cadastro com token, créditos e planos

### Instalação sem editar arquivos
1. `docker compose up -d --build` (não precisa de `.env`).
2. Descubra o código: `docker compose logs app | grep INSTALAÇÃO` e abra `http://IP-DO-SERVIDOR` (porta 80; o app também escuta em `127.0.0.1:7001`).
3. O assistente verifica o ambiente (cada item explica **por quê** importa e **como corrigir**; itens obrigatórios com falha bloqueiam), testa o banco (connection string do Neon), **gera as chaves** (`JWT_SECRET`, `DATA_KEY`; guarde a `DATA_KEY` em cofre: sem ela os dados cifrados são irrecuperáveis), registra o endereço/fuso e grava tudo em `data/config.env` (volume `appdata`, 0600). O sistema inicia **sem reiniciar o contêiner** e o assistente continua com credenciais, administrador root e equipe base, usando o mesmo código.
4. HTTPS: aponte o DNS e rode `DOMAIN=seu.dominio docker compose up -d`; depois ajuste o endereço em Integrações.
- Variáveis reais de ambiente têm prioridade sobre `data/config.env`. Para refazer a configuração, apague `data/config.env` (volume `appdata`) e reinicie.

### Cadastro e tokens
- Cadastro **sem token**: segue o modo definido em Integrações (desativado, com aprovação ou aberto). Sem token não há período de teste.
- Cadastro **com token válido**: conta aprovada na hora, com o teste, plano e créditos do token. Tokens de convite funcionam mesmo com o cadastro desligado; o token padrão **TALK** (1 semana de teste no perfil Básico, sem créditos) só funciona com o cadastro público ligado. Desative-o em Gestão de créditos → Tokens se não quiser esse convite aberto.
- Token promocional com dono: quem indicou ganha o prêmio em créditos a cada uso.
- **Embaixador** (definido pelo administrador): cria grupos de tokens dentro dos limites que o administrador fixa (grupos, tokens por grupo, usos, bônus, dias de teste, prêmio e plano).

### Créditos e planos
- **Tudo é livre** até o administrador definir custos (Gestão de créditos → Custos; 0 = livre) e ligar **Exigir plano ou teste vigente**. Só usuários “medidos” (cadastrados por token ou ativados pelo administrador) são bloqueados/cobrados; administradores nunca.
- Expirado ou bloqueado: toda chamada devolve 402 e o app leva à tela **Créditos e planos** (aquisição). Ações com custo debitam antes e **estornam** se falharem.
- Planos (editáveis): Básico (grátis; sem IA), Essencial R$ 59/mês ou R$ 19/semana (IA de apoio), Profissional R$ 149/mês ou R$ 45/semana (protocolos, caso, familiograma), Clínica R$ 399/mês ou R$ 119/semana (equipe e auditoria). Planos gratuitos renovam sozinhos; pagos exigem novo pagamento (PayPal, ou confirmação manual do administrador).
- Migração nova: `db/012_creditos.sql` (aplicada pelo assistente/AUTO_MIGRATE).
- Rotas: `/api/billing/*` (usuário e embaixador) e `/api/admin/billing/*` (planos, custos, usuários, distribuição, tokens, pedidos, extrato).
>>>>>>> 7a1d2a7 (Upload automático via script SSH)
