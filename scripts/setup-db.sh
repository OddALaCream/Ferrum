#!/usr/bin/env bash
# Crea el rol y la base de datos de desarrollo en el PostgreSQL LOCAL.
# Uso (desde la raíz del repo):  bash scripts/setup-db.sh
# Lee las credenciales de .env. Es idempotente.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Falta .env. Ejecute:  cp .env.example .env"; exit 1; }
set -a; . ./.env; set +a

command -v psql >/dev/null || { echo "No se encontró 'psql'. Instale PostgreSQL 16 o agréguelo al PATH."; exit 1; }

export PGPASSWORD="${PG_ADMIN_PASSWORD}"
ADMIN=(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${PG_ADMIN_USER}" -v ON_ERROR_STOP=1 -q -t -A)

echo ">> Creando rol '${DB_USER}'..."
if [ "$("${ADMIN[@]}" -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]; then
  "${ADMIN[@]}" -d postgres -c "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}'"
else
  "${ADMIN[@]}" -d postgres -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}'"
fi

echo ">> Creando base '${DB_NAME}'..."
if [ "$("${ADMIN[@]}" -d postgres -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
  "${ADMIN[@]}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8'"
fi

# citext y pgcrypto son extensiones "trusted" en PG13+, pero se crean con el
# superusuario por si la instalación local es restrictiva.
echo ">> Habilitando extensiones citext y pgcrypto..."
"${ADMIN[@]}" -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo "Listo. Siguiente paso:  cd src/backend && npm run migration:run && npm run seed:dev"
