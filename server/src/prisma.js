import pkgPrisma from '../generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string by removing potential quotes and whitespace
const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

// Prisma 7+ requires driver adapters, so we initialize a pg Pool and wrap it.
const pool = new Pool({ 
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

// Pass the adapter to the PrismaClient options
const prisma = new PrismaClient({ 
    adapter,
    log: ['query', 'info', 'warn', 'error'],
});

// Helper to log detailed Prisma errors
export const handlePrismaError = (error, context) => {
    console.error(`--- PRISMA ERROR in ${context} ---`);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    if (error.meta) console.error('Meta:', JSON.stringify(error.meta, null, 2));
    console.error('Stack:', error.stack);
    console.error('----------------------------------');
};

// Test connection on startup
pool.query('SELECT 1', (err) => {
    if (err) {
        console.error('[DATABASE] Connection failed:', err.message);
    } else {
        console.log('[DATABASE] Successfully connected via pg Pool');
    }
});

export default prisma;
