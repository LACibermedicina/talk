-- Controle de credenciais: último acesso, troca de senha, sessões revogáveis e histórico de eventos de credencial.
alter table users add column if not exists last_login_at timestamptz, add column if not exists last_login_ip text, add column if not exists pw_changed_at timestamptz, add column if not exists sessions_valid_after timestamptz;
create table if not exists credential_events (
  id bigserial primary key, user_id uuid not null references users(id) on delete cascade, kind text not null check (kind in ('login','login_falha','bloqueio','desbloqueio','senha_trocada','senha_redefinida','sessao_revogada')),
  ip text, by_user uuid references users(id), at timestamptz not null default now()
);
create index if not exists credential_events_user on credential_events(user_id, id desc);
