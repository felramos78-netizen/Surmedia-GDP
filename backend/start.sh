#!/bin/sh
set -e

echo ""
echo "========================================="
echo "  GDP Surmedia — Iniciando servidor"
echo "========================================="

# Verificar variables de entorno críticas
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL no está definida."
  echo "       En Railway → backend service → Variables → agrega:"
  echo "       DATABASE_URL = \${{Postgres.DATABASE_URL}}"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "ADVERTENCIA: JWT_SECRET no definida. Usando valor inseguro (solo desarrollo)."
fi

echo "[1/2] Sincronizando schema con la base de datos..."
npx prisma db push --accept-data-loss --skip-generate
echo "      Schema sincronizado OK"

echo "[2/2] Iniciando servidor Fastify..."
exec node dist/server.js
