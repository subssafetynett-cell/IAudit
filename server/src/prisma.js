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
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Pass the adapter to the PrismaClient options
const prisma = new PrismaClient({ adapter });

export default prisma;
