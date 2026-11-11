-- Consulta por vídeo: transcrição (com consentimento do paciente), relatório, biblioteca de materiais e preferências clínicas.
create table if not exists consult_state (
  appointment_id uuid primary key references appointments(id) on delete cascade,
  transcribing boolean not null default false,
  patient_consent boolean,
  started_at timestamptz,
  structured_enc text, structured_at timestamptz,
  report_enc text, report_at timestamptz
);
-- tier: ministerio | sociedade | oms (cadastrados por administradores) ou personal (do próprio usuário; shared = visível a todos como "geral")
create table if not exists library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  tier text not null check (tier in ('ministerio','sociedade','oms','personal')),
  shared boolean not null default false,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists library_items_owner on library_items(owner_id);
-- preferências clínicas do profissional (ex.: { "local": [ { "topic": "hipertensão", "text": "…" } ] })
alter table users add column if not exists clinical_prefs jsonb not null default '{}'::jsonb;
