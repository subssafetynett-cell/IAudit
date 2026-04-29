import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string
const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');
// Force clean the env var for the binary engine
process.env.DATABASE_URL = connectionString;

console.log('Prisma: Initializing with Binary Engine...');

const prisma = new PrismaClient({
    log: ['error', 'warn'],
});

// Test connection
prisma.$connect()
    .then(() => console.log('Prisma: Binary connection verified successfully.'))
    .catch(err => {
        console.error('Prisma: Connection verification FAILED.');
        console.error('Prisma: Error Details:', err);
    });

export default prisma;
