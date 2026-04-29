import pkgPg from 'pg';
const { Pool } = pkgPg;
import { PrismaPg } from '@prisma/adapter-pg';
import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string
let connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

// Append libpq compatibility for modern SSL handling if missing
if (!connectionString.includes('uselibpqcompat') && connectionString.includes('sslmode=require')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString += `${separator}uselibpqcompat=true`;
}

const poolConfig = {
    connectionString,
    connectionTimeoutMillis: 30000, // 30 seconds for external DBs
    max: 5,
    idleTimeoutMillis: 30000
};

// Explicitly handle SSL for Neon/External
if (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')) {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

console.log('Database Pool: Initializing connection...');
const pool = new Pool(poolConfig);

// Verify database connectivity on startup
pool.query('SELECT 1')
    .then(() => console.log('Database: Connectivity verified (SELECT 1 passed).'))
    .catch(err => {
        console.error('Database: Verification FAILED.');
        console.error('Database: Error Details:', err);
    });

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { pool };
export default prisma;
