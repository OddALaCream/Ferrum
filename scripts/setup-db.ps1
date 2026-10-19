# Crea el rol y la base de datos de desarrollo en el PostgreSQL LOCAL (Windows).
# Uso (desde la raíz del repo, en PowerShell):  .\scripts\setup-db.ps1
# Lee las credenciales de .env. Es idempotente.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path .env)) { throw "Falta .env. Ejecute:  copy .env.example .env" }

# Cargar .env en un diccionario
$cfg = @{}
Get-Content .env | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  $cfg[$k.Trim()] = $v.Trim().Trim('"')
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "No se encontró 'psql'. Agregue la carpeta bin de PostgreSQL al PATH (p. ej. C:\Program Files\PostgreSQL\16\bin)."
}

$env:PGPASSWORD = $cfg['PG_ADMIN_PASSWORD']
function Admin([string]$db, [string]$sql) {
  & psql -h $cfg['DB_HOST'] -p $cfg['DB_PORT'] -U $cfg['PG_ADMIN_USER'] -d $db -v ON_ERROR_STOP=1 -q -t -A -c $sql
  if ($LASTEXITCODE -ne 0) { throw "psql falló: $sql" }
}

$u = $cfg['DB_USER']; $p = $cfg['DB_PASSWORD']; $d = $cfg['DB_NAME']

Write-Host ">> Creando rol '$u'..."
if ((Admin 'postgres' "SELECT 1 FROM pg_roles WHERE rolname='$u'") -ne '1') {
  Admin 'postgres' "CREATE ROLE ""$u"" WITH LOGIN PASSWORD '$p'"
} else {
  Admin 'postgres' "ALTER ROLE ""$u"" WITH LOGIN PASSWORD '$p'"
}

Write-Host ">> Creando base '$d'..."
if ((Admin 'postgres' "SELECT 1 FROM pg_database WHERE datname='$d'") -ne '1') {
  Admin 'postgres' "CREATE DATABASE ""$d"" OWNER ""$u"" ENCODING 'UTF8'"
}

Write-Host ">> Habilitando extensiones citext y pgcrypto..."
Admin $d "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

Write-Host "Listo. Siguiente paso:  cd src\backend; npm run migration:run; npm run seed:dev"
