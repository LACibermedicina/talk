-- Estado de presença escolhido pelo usuário (online, ocupado, offline/invisível) e país das diretrizes clínicas.
alter table users add column if not exists presence text not null default 'online' check (presence in ('online','busy','offline'));
alter table users add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
