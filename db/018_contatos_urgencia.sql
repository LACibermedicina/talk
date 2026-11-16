-- Grafo de contatos entre níveis de usuário (por tipo de conexão), urgência e consentimento registrado na chamada.
create table if not exists contact_rules (
  kind text not null check (kind in ('video','chat')),
  from_role text not null,
  to_role text not null,
  primary key (kind, from_role, to_role)
);  -- linha '*'>'*' = grafo configurado pelo administrador (vazio de arestas = ninguém além do administrador)
alter table users add column if not exists urgency_mode text not null default 'sempre' check (urgency_mode in ('sempre','nunca','periodos')),
  add column if not exists urgency_periods jsonb not null default '[]'::jsonb;
alter table call_requests add column if not exists urgent boolean not null default false, add column if not exists urgent_group uuid;
create index if not exists call_requests_group on call_requests(urgent_group) where urgent_group is not null;
alter table consult_state add column if not exists consent_by uuid references users(id) on delete set null, add column if not exists consent_at timestamptz;
