alter table users add column username text, add column pending boolean not null default false, add column failed_logins int not null default 0, add column locked_until timestamptz;
create unique index users_username_key on users(lower(username)) where username is not null;
update users set username='root' where is_root and username is null;
