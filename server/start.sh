#!/bin/sh
set -e

echo "Starting Server Initialization..."

# Run database synchronization with retry
echo "Syncing database schema (with retries)..."
until npx prisma db push --accept-data-loss; do
  echo "Prisma push failed, retrying in 5s..."
  sleep 5
done

# Start the application
echo "Starting the application..."
exec node src/index.js
