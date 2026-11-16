-- Tradução automática de mensagens recebidas (opcional, por usuário) com cache cifrado.
alter table users add column if not exists auto_translate boolean not null default false;
create table if not exists message_translations (
  message_id uuid not null references messages(id) on delete cascade,
  lang text not null,
  text_enc text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, lang)
);
