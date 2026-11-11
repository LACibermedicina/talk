alter table users add column ask_reason boolean not null default true;
create table activity_log(id bigserial primary key,at timestamptz not null default now(),user_id uuid references users(id),entity text not null,entity_id text,action text not null,patient_id uuid references users(id),detail json,reason text);
create index on activity_log(at desc);create index on activity_log(patient_id);
create table tasks(id uuid primary key default gen_random_uuid(),title text not null,status text not null default 'todo' check(status in('todo','doing','done')),assignee_id uuid references users(id),patient_id uuid references users(id),channel text,due date,created_by uuid references users(id),created_at timestamptz not null default now());
