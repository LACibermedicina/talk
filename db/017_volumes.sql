-- Do caso ao volume: concordância do paciente com o uso anonimizado dos dados e volumes de estudo de caso (somente administrador).
alter table users add column if not exists research_consent boolean;
alter table users add column if not exists research_consent_at timestamptz;
alter table users add column if not exists research_consent_ver text;
create sequence if not exists volume_seq;
create table if not exists case_volumes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('V-' || lpad(nextval('volume_seq')::text, 4, '0')),
  patient_id uuid not null references users(id),
  created_by uuid not null references users(id),
  title text not null,
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_cep','aprovado','gerado','enviado','suspenso')),
  t0 date, t0_label text,
  extra_terms jsonb not null default '[]'::jsonb,
  tcle_ok boolean not null default false, tcle_at timestamptz, tcle_by uuid references users(id),
  cep_number text, cep_body text, cep_approved_at date, cep_notes text,
  version int not null default 0, generated_at timestamptz,
  api_ref text, api_sent_at timestamptz, api_status text,
  created_at timestamptz not null default now()
);
create index if not exists case_volumes_patient on case_volumes(patient_id);
create table if not exists volume_versions (
  id uuid primary key default gen_random_uuid(),
  volume_id uuid not null references case_volumes(id) on delete cascade,
  version int not null, by_user uuid not null references users(id),
  provider text, content_enc text not null, checklist jsonb,
  created_at timestamptz not null default now(),
  unique (volume_id, version)
);
