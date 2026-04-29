import pkgPg from 'pg';
const { Pool } = pkgPg;
import { PrismaPg } from '@prisma/adapter-pg';
import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string by removing potential quotes and whitespace
const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

const poolConfig = {
    connectionString,
    connectionTimeoutMillis: 20000, // 20 seconds
    max: 5, 
    idleTimeoutMillis: 30000 
};

// Automatically enable SSL for external databases (Neon, AWS, etc.)
if (connectionString.includes('neon.tech') || connectionString.includes('aws.com') || connectionString.includes('sslmode=require')) {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { pool };
export default prisma;
