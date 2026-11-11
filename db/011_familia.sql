-- Familiograma e ecomapa por paciente (dados clínicos: cifrados). source: ia (rascunho gerado) | manual (editado pelo profissional)
create table if not exists family_maps (
  patient_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('genograma','ecomapa')),
  data_enc text not null,
  source text not null default 'ia' check (source in ('ia','manual')),
  lib_used int not null default 0,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  primary key (patient_id, kind)
);
