import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string by removing potential quotes and whitespace
const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

// Standard Prisma Client initialization
// Note: Prisma 5/6/7 handles SSL automatically via the connection string query parameters (?sslmode=require)
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionString,
        },
    },
});

export default prisma;
