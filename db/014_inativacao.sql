-- Inativação de usuários: quando, por quem e por quê.
alter table users add column if not exists inactive_at timestamptz, add column if not exists inactive_by uuid references users(id) on delete set null, add column if not exists inactive_reason text;
