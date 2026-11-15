-- Equipes, chamadas entre profissionais (da mesma equipe ou externas/freelance), propostas de integração e repasses.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, active boolean not null default true,
  created_by uuid references users(id) on delete set null, created_at timestamptz not null default now()
);
create unique index if not exists teams_name_uq on teams(lower(name));
-- um profissional pertence a no máximo uma equipe; sem linha = freelance
create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'membro' check (role in ('admin','membro')),
  terms jsonb, proposal_id uuid, joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create unique index if not exists team_members_one on team_members(user_id);
alter table call_requests
  add column if not exists kind text not null default 'paciente' check (kind in ('paciente','interna','externa','livre')),
  add column if not exists team_id uuid references teams(id) on delete set null,
  add column if not exists by_admin boolean not null default false,
  add column if not exists blocked_by uuid references users(id) on delete set null,
  add column if not exists blocked_at timestamptz, add column if not exists block_reason text;
alter table call_requests drop constraint if exists call_requests_status_check;
alter table call_requests add constraint call_requests_status_check check (status in ('pendente','aceita','recusada','cancelada','sem_resposta','bloqueada'));
create index if not exists call_requests_team on call_requests(team_id, created_at desc);
create table if not exists team_proposals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  professional_id uuid not null references users(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  status text not null default 'enviada' check (status in ('enviada','aceita','recusada','cancelada','expirada')),
  fee numeric(12,2) not null check (fee >= 0), currency text not null default 'BRL',
  team_pct numeric(5,2) not null check (team_pct >= 0 and team_pct <= 100),
  model text not null default 'por_chamada' check (model in ('por_chamada','por_paciente')),
  conditions text, summary text, prompt text, ai_provider text,
  decline_reason text, created_at timestamptz not null default now(), answered_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists team_proposals_pro on team_proposals(professional_id, status);
create index if not exists team_proposals_team on team_proposals(team_id, created_at desc);
create table if not exists proposal_files (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references team_proposals(id) on delete cascade,
  name text not null, mime text not null, size int not null, content bytea not null
);
create table if not exists call_settlements (
  call_id uuid primary key references call_requests(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  professional_id uuid not null references users(id) on delete cascade,
  patient_id uuid references users(id) on delete set null,
  model text not null, currency text not null default 'BRL',
  fee numeric(12,2) not null, team_pct numeric(5,2) not null, team_amount numeric(12,2) not null, pro_amount numeric(12,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago','anulado')), created_at timestamptz not null default now()
);
create index if not exists call_settlements_team on call_settlements(team_id, created_at desc);
create index if not exists call_settlements_pro on call_settlements(professional_id, created_at desc);
