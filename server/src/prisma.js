import pkgPrisma from '../generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

// --- Connection Logic moved from YML to Code ---
let connectionString = (process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');

// Fallback: Construct connection string if DATABASE_URL is missing
if (!connectionString || connectionString === 'undefined' || connectionString === 'null') {
    const user = process.env.POSTGRES_USER;
    const pass = process.env.POSTGRES_PASSWORD;
    const db = process.env.POSTGRES_DB;
    const host = process.env.POSTGRES_HOST || 'db';
    const port = process.env.POSTGRES_PORT || '5432';
    
    if (user && pass && db) {
        connectionString = `postgresql://${user}:${pass}@${host}:${port}/${db}?schema=public`;
        console.log('[DATABASE] Constructing connection string from components...');
    }
}

// SSL Handling: Neon and other external providers require SSL
const isExternal = connectionString.includes('neon.tech') || !connectionString.includes('@db:');
const sslConfig = connectionString.includes('sslmode=require') || connectionString.includes('ssl=true') || isExternal
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // 30s timeout for stability
    ssl: sslConfig
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
});

// Robust Connection Retry Logic (Replacing Docker depends_on logic)
const verifyConnection = async (retries = 10, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            client.release();
            console.log('[DATABASE] Successfully connected via pg Pool');
            return true;
        } catch (err) {
            console.error(`[DATABASE] Connection attempt ${i + 1} failed: ${err.message}`);
            if (i === retries - 1) return false;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
};

// Start connection verification in the background
verifyConnection();

export const handlePrismaError = (error, context) => {
    console.error(`--- PRISMA ERROR in ${context} ---`);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    if (error.meta) console.error('Meta:', JSON.stringify(error.meta, null, 2));
    console.error('Stack:', error.stack);
    console.error('----------------------------------');
};

export default prisma;
