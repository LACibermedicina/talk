#!/usr/bin/env bash
# Cria o banco do Talk.M3D no PostgreSQL deste servidor e mostra a "connection string" para colar no instalador.
# Uso (como root): bash vps-criar-banco.sh      Variáveis: DB_NOME (talk) DB_USUARIO (talk)
set -euo pipefail
DB_NOME="${DB_NOME:-talk}"; DB_USUARIO="${DB_USUARIO:-talk}"
[ "$(id -u)" = 0 ] || [ -n "${SKIP_ROOT:-}" ] || { echo "Rode como root."; exit 1; }
if ! command -v psql >/dev/null 2>&1 && ! [ -d /etc/postgresql ]; then
  echo "• PostgreSQL não encontrado: instalando"; apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
fi
systemctl start postgresql >/dev/null 2>&1 || true
P() { sudo -u postgres psql -qtAX "$@"; }
P -c "select 1" >/dev/null 2>&1 || { echo "✘ Não consegui falar com o PostgreSQL local (sudo -u postgres psql). Se o seu Postgres roda em Docker ou outra máquina, me avise."; exit 1; }
SENHA=$(openssl rand -hex 16)
if [ "$(P -c "select 1 from pg_roles where rolname='$DB_USUARIO'")" = 1 ]; then P -c "ALTER USER $DB_USUARIO WITH PASSWORD '$SENHA'"; echo "• usuário $DB_USUARIO já existia: senha redefinida"
else P -c "CREATE USER $DB_USUARIO WITH PASSWORD '$SENHA'"; echo "✔ usuário $DB_USUARIO criado"; fi
if [ "$(P -c "select 1 from pg_database where datname='$DB_NOME'")" = 1 ]; then echo "• banco $DB_NOME já existia"
else P -c "CREATE DATABASE $DB_NOME OWNER $DB_USUARIO"; echo "✔ banco $DB_NOME criado"; fi
P -d "$DB_NOME" -c "GRANT ALL ON SCHEMA public TO $DB_USUARIO" >/dev/null
PORTA=$(P -c "show port")
URL="postgresql://$DB_USUARIO:$SENHA@127.0.0.1:$PORTA/$DB_NOME"
PGPASSWORD="$SENHA" psql -qtAX "$URL" -c "select 'conexão ok'" 2>/dev/null | sed 's/^/✔ /' || echo "! teste de login falhou: confira o pg_hba.conf (método scram-sha-256/md5 para 127.0.0.1)"
echo; echo "Cole no instalador (e DESMARQUE \"Exigir conexão criptografada\"):"; echo; echo "  $URL"; echo
