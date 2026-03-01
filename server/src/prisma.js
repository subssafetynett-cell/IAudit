import pkgPg from 'pg';
const { Pool } = pkgPg;
import { PrismaPg } from '@prisma/adapter-pg';
import pkgPrisma from '../generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { PrismaClient } = pkgPrisma;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000 // 15 seconds
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
