-- Créditos, planos, tokens de cadastro/indicação e embaixadores. Tudo livre de cobrança até o administrador definir custos
-- (credit_costs.cost = 0) e ativar BILLING_ENFORCE. Usuários sem linha em user_billing nunca são medidos.
create table if not exists plans (
  id text primary key, name text not null, tier int not null default 1, description text not null default '',
  price_week numeric(10,2) not null default 0, price_month numeric(10,2) not null default 0,
  credits_week int not null default 0, credits_month int not null default 0,
  features jsonb not null default '{}', active boolean not null default true, sort int not null default 0
);
create table if not exists credit_costs (feature text primary key, label text not null, cost int not null default 0 check (cost >= 0));
create table if not exists user_billing (
  user_id uuid primary key references users(id) on delete cascade,
  plan_id text references plans(id), cycle text check (cycle in ('week','month')),
  balance int not null default 0 check (balance >= 0),
  trial_ends timestamptz, plan_ends timestamptz, auto_renew boolean not null default true,
  blocked boolean not null default false, blocked_reason text,
  ambassador boolean not null default false, referred_by uuid references users(id), token_used text,
  updated_at timestamptz not null default now()
);
create table if not exists credit_ledger (
  id bigserial primary key, user_id uuid not null references users(id) on delete cascade,
  delta int not null, balance_after int not null, kind text not null, feature text, note text,
  created_by uuid references users(id), created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user on credit_ledger(user_id, id desc);
create table if not exists signup_tokens (
  code text primary key, kind text not null default 'promo' check (kind in ('default','promo','embaixador')),
  label text not null default '', trial_days int not null default 0 check (trial_days >= 0), plan_id text references plans(id),
  credits int not null default 0 check (credits >= 0), reward_owner int not null default 0 check (reward_owner >= 0),
  owner_id uuid references users(id) on delete set null, group_id text,
  max_uses int, uses int not null default 0, expires_at timestamptz, active boolean not null default true,
  created_by uuid references users(id), created_at timestamptz not null default now()
);
create index if not exists signup_tokens_owner on signup_tokens(owner_id);
create table if not exists billing_orders (
  id bigserial primary key, user_id uuid not null references users(id) on delete cascade,
  plan_id text not null references plans(id), cycle text not null check (cycle in ('week','month')), amount numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')), method text, note text,
  created_at timestamptz not null default now(), paid_at timestamptz
);
insert into plans(id,name,tier,description,price_week,price_month,credits_week,credits_month,features,sort) values
 ('basico','Básico',1,'Para conhecer: mensagens, agenda e receitas, sem IA clínica.',0,0,15,50,'{"pacientes":15,"equipe":1,"ia":false,"video_min":120,"armazenamento_gb":1,"protocolos":false,"suporte":"comunidade"}',1),
 ('essencial','Essencial',2,'Autônomo: IA de apoio (transcrição, tradução), videochamada e prontuário.',19,59,110,400,'{"pacientes":80,"equipe":1,"ia":true,"video_min":900,"armazenamento_gb":10,"protocolos":false,"suporte":"e-mail"}',2),
 ('profissional','Profissional',3,'Consulta completa: protocolos, caso clínico, familiograma/ecomapa e relatórios.',45,149,420,1500,'{"pacientes":400,"equipe":3,"ia":true,"video_min":3000,"armazenamento_gb":50,"protocolos":true,"suporte":"prioritário"}',3),
 ('clinica','Clínica',4,'Equipe multiprofissional: vários usuários, recepção, financeiro e auditoria.',119,399,1700,6000,'{"pacientes":3000,"equipe":15,"ia":true,"video_min":15000,"armazenamento_gb":300,"protocolos":true,"suporte":"dedicado"}',4)
 on conflict do nothing;
insert into credit_costs(feature,label,cost) values
 ('ia_assistente','Assistente do sistema',0),('ia_traducao','Tradução de mensagens e telas',0),('ia_transcricao','Transcrição de áudio',0),
 ('clinico_ia','Rascunho de prontuário por IA',0),('consulta_estrutura','Estruturação da consulta (SOAP)',0),('consulta_relatorio','Relatório da consulta',0),
 ('consulta_apoio','Apoio à decisão e protocolos',0),('caso_ia','Análise de caso clínico',0),('familia_ia','Familiograma e ecomapa por IA',0) on conflict do nothing;
insert into signup_tokens(code,kind,label,trial_days,plan_id,credits,reward_owner) values ('TALK','default','Indicação padrão: 1 semana de teste no perfil Básico',7,'basico',0,0) on conflict do nothing;
create table if not exists token_uses (code text not null references signup_tokens(code) on delete cascade, user_id uuid not null references users(id) on delete cascade, at timestamptz not null default now(), primary key (code, user_id));
