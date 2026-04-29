import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const rawConnectionString = process.env.DATABASE_URL || '';
// Clean the connection string
const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

console.log('Prisma: Initializing native connection engine...');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionString,
        },
    },
    log: ['error', 'warn'],
});

// Test connection
prisma.$connect()
    .then(() => console.log('Prisma: Native connection verified successfully.'))
    .catch(err => {
        console.error('Prisma: Connection verification FAILED.');
        console.error('Prisma: Error Details:', err);
    });

export default prisma;
