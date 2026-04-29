#!/bin/sh
set -e

echo "Starting Server Initialization..."

# Run database synchronization
echo "Syncing database schema..."
npx prisma db push --accept-data-loss

# Start the application
echo "Starting the application..."
exec node src/index.js
