-- Tradução contextual da interface por IA: cache compartilhado (somente textos fixos da interface) e limite diário.
create table if not exists i18n_cache(
  lang text not null, src_hash text not null, src text not null, ctx text, out text not null,
  created_at timestamptz not null default now(), primary key(lang, src_hash));
create table if not exists i18n_usage(day date not null default current_date, user_id uuid not null references users(id), n int not null default 0, primary key(day, user_id));
