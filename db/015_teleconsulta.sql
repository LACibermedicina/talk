-- Teleconsulta sob demanda: paciente ↔ profissional de saúde, com registro de tentativa e desfecho nas agendas.
alter table users add column if not exists decline_msg text;
create table if not exists call_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete cascade,
  target_id uuid not null references users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','aceita','recusada','cancelada','sem_resposta')),
  reason text, decline_reason text, appointment_id uuid references appointments(id) on delete set null,
  created_at timestamptz not null default now(), answered_at timestamptz, expires_at timestamptz not null
);
create index if not exists call_requests_target on call_requests(target_id, status);
create index if not exists call_requests_requester on call_requests(requester_id, created_at desc);
alter table appointments add column if not exists call_id uuid references call_requests(id) on delete set null, add column if not exists call_info text;
