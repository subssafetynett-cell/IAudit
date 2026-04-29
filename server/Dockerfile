# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
# Install ALL dependencies (including devDeps for prisma generate)
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.js ./

# Generate Prisma Client (uses dummy URL to satisfy validation)
# We generate into the custom path defined in schema.prisma
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate

COPY . .

# Stage 2: Production Runtime
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies (OpenSSL is still recommended for some engines/adapters)
RUN apk add --no-cache openssl

# Copy only production dependencies if you want to be small, 
# but often easier to copy builder node_modules to avoid prisma mismatch
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.js ./
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/src ./src

ENV NODE_ENV=production
EXPOSE 3001

# Note: In production, you should run migrations/db push as a separate CI step 
# or a sidecar, NOT in a background setTimeout.
CMD ["node", "src/index.js"]
