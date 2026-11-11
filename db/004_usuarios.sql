alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check(role in('admin','medico','fisio','enfermeiro','nutricionista','farmaceutico','profissional','cuidador','recepcao','funcionario','paciente'));
alter table users add column cargo text;
alter table users add column is_root boolean not null default false;
alter table users add column must_change boolean not null default false;
create unique index one_root on users(is_root) where is_root;
