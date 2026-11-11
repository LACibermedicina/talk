alter table appointments add column note_enc text;
create table agenda_notes(id uuid primary key default gen_random_uuid(),owner_id uuid not null references users(id),title text not null default 'Nota',body_enc text not null default '',starts_at timestamptz not null,created_at timestamptz not null default now());
create index on agenda_notes(owner_id,starts_at);
create table patient_summary(patient_id uuid primary key references users(id),content_enc text not null,updated_by uuid references users(id),updated_at timestamptz not null default now());
